import { NextRequest, NextResponse } from 'next/server';

/**
 * app/api/syllabus/urls/route.ts
 *
 * Stage 1: シラバス URL リスト取得
 *
 * 修正点:
 *   - /v1/crawl（非同期ジョブ）→ /v1/scrape（同期）に変更
 *   - NEXT_PUBLIC_FIRECRAWL_API_KEY → FIRECRAWL_API_KEY（サーバー側環境変数）
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, department, grade, year } = await request.json();

    if (!schoolId || !department || !grade || !year) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (schoolId, department, grade, year)' },
        { status: 400 }
      );
    }

    // ✅ サーバー側環境変数（NEXT_PUBLIC_ を外した）
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY が設定されていません（Vercel 環境変数を確認してください）' },
        { status: 500 }
      );
    }

    const syllabusUrl = buildSyllabusSearchUrl(schoolId, department, grade, year);
    console.log('[urls] Scraping URL list from:', syllabusUrl);

    // ✅ /v1/scrape（同期エンドポイント）を使用
    //    /v1/crawl は非同期ジョブ（ポーリングが必要）なので Vercel では使えない
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: syllabusUrl,
        formats: ['links'],   // リンク一覧だけ取得（markdown/html 不要）
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('[urls] FireCrawl scrape failed:', errorText);
      return NextResponse.json(
        { error: 'URLリスト取得に失敗しました', details: errorText },
        { status: scrapeResponse.status }
      );
    }

    const scrapeData = await scrapeResponse.json();

    // FireCrawl v1/scrape の links レスポンスからシラバス URL を抽出
    const allLinks: string[] = scrapeData?.data?.links ?? scrapeData?.links ?? [];
    const syllabusUrls = extractSyllabusUrls(allLinks, schoolId);

    console.log(`[urls] Found ${syllabusUrls.length} syllabus URLs`);

    return NextResponse.json({
      schoolId,
      department,
      grade,
      year,
      totalUrls: syllabusUrls.length,
      urls: syllabusUrls,
    });
  } catch (error) {
    console.error('[urls] API error:', error);
    return NextResponse.json(
      { error: 'URLリスト取得処理でエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * シラバス検索 URL を構築する
 */
function buildSyllabusSearchUrl(
  schoolId: string,
  department: string,
  grade: number,
  year: number
): string {
  const baseUrl = 'https://syllabus.kosen-k.go.jp';
  const deptCode = departmentToCode(department);
  return (
    `${baseUrl}/Pages/PublicSyllabus` +
    `?school_id=${schoolId}&dept_code=${deptCode}&grade=${grade}&year=${year}`
  );
}

/**
 * 学科名 → シラバスシステムコード変換
 *
 * ⚠️ 実際の dept_code は学校ごとに異なります。
 *    公式シラバスサイト URL を確認して調整してください。
 */
function departmentToCode(department: string): string {
  // 長野高専（新課程）
  const codeMap: Record<string, string> = {
    '工学科':             '01',
    '情報エレクトロニクス系': '02',
    '機械ロボティクス系':   '03',
    '都市デザイン系':       '04',
    // 長野高専（旧課程）
    '機械工学科':         '11',
    '電気電子工学科':     '12',
    '電子制御工学科':     '13',
    '電子情報工学科':     '14',
    '環境都市工学科':     '15',
  };
  // 完全一致
  if (codeMap[department]) return codeMap[department];
  // 部分一致フォールバック
  const partial = Object.keys(codeMap).find((k) => department.includes(k) || k.includes(department));
  return partial ? codeMap[partial] : '01';
}

/**
 * スクレイプ結果からシラバスページ URL を抽出する
 */
function extractSyllabusUrls(links: string[], schoolId: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of links) {
    if (!url || seen.has(url)) continue;
    try {
      new URL(url); // URL 形式チェック
    } catch {
      continue;
    }
    if (isSyllabusDetailUrl(url, schoolId)) {
      seen.add(url);
      result.push(url);
    }
  }
  return result;
}

/**
 * 個別シラバスページの URL かどうかを判定する
 */
function isSyllabusDetailUrl(url: string, schoolId: string): boolean {
  return (
    url.includes('syllabus.kosen-k.go.jp') &&
    (url.includes('/Details/') || url.includes('subject_id=') || url.includes('syllabus_id=')) &&
    url.includes(`school_id=${schoolId}`)
  );
}
