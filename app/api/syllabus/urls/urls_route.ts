import { NextRequest, NextResponse } from 'next/server';
import { KOSEN_SCHOOLS } from '@/lib/kosenList';

/**
 * app/api/syllabus/urls/route.ts
 *
 * Stage 1: 科目一覧ページをスクレイピングしてシラバス個別URLリストを取得
 *
 * ── 修正点 ──────────────────────────────────────────────────────────────
 *  ❌ 旧: /Pages/PublicSyllabus?school_id=XX&dept_code=XX&grade=XX
 *  ✅ 新: /Pages/PublicSubjects?school_id=XX&department_id=XX&year=XX
 *
 *  ❌ 旧: NEXT_PUBLIC_FIRECRAWL_API_KEY（クライアント公開 → セキュリティリスク）
 *  ✅ 新: FIRECRAWL_API_KEY（サーバー専用）
 *
 *  ❌ 旧: リンクフィルターが /Details/ を探す
 *  ✅ 新: リンクフィルターが subject_id= を含む PublicSyllabus URL を探す
 * ────────────────────────────────────────────────────────────────────────
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

    // ✅ サーバーサイド専用キー
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY が環境変数に設定されていません' },
        { status: 500 }
      );
    }

    // ── department_id を kosenList から引く ──────────────────────────────
    // Onboarding が送る schoolId は syllabusId（例: '20'）
    // department は学科名の文字列（例: '情報エレクトロニクス系'）
    const school = KOSEN_SCHOOLS.find((s) => s.syllabusId === schoolId);
    const deptObj = school?.departments.find(
      (d) => d.name === department || d.label === department
    );

    if (!deptObj?.departmentId) {
      console.warn(
        `[urls] department_id not found for schoolId=${schoolId}, dept=${department}. Falling back.`
      );
      return NextResponse.json(
        {
          error: `学科 "${department}" の department_id が見つかりません。kosenList.ts を確認してください。`,
          schoolId,
          department,
          grade,
          year,
          totalUrls: 0,
          urls: [],
        },
        { status: 200 }
      );
    }

    const departmentId = deptObj.departmentId;

    // ✅ 正しいURL: /Pages/PublicSubjects?school_id=XX&department_id=XX&year=XX
    //    ※ grade は URL パラメータに含まれない。科目一覧に全学年が載るため、
    //       フロント側で学年フィルタを行う（または全科目を取得する）。
    const subjectsUrl = buildSubjectsUrl(schoolId, departmentId, year);
    console.log('[urls] Scraping subjects list from:', subjectsUrl);

    // ✅ /v1/scrape（同期エンドポイント）
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: subjectsUrl,
        formats: ['links'], // リンク一覧だけ取得
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

    // FireCrawl v1/scrape の links レスポンスは data.links または links
    const allLinks: string[] = scrapeData?.data?.links ?? scrapeData?.links ?? [];
    console.log(`[urls] Total links found: ${allLinks.length}`);

    // PublicSyllabus?...&subject_id=... 形式のURLだけ抽出
    const syllabusUrls = extractSyllabusUrls(allLinks, schoolId, departmentId);
    console.log(`[urls] Filtered syllabus URLs: ${syllabusUrls.length}`);

    return NextResponse.json({
      schoolId,
      department,
      departmentId,
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

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

/**
 * 科目一覧ページの URL を構築する
 * 例: https://syllabus.kosen-k.go.jp/Pages/PublicSubjects?school_id=20&department_id=31&year=2025&lang=ja
 */
function buildSubjectsUrl(
  schoolId: string,
  departmentId: number,
  year: number
): string {
  const base = 'https://syllabus.kosen-k.go.jp/Pages/PublicSubjects';
  return `${base}?school_id=${schoolId}&department_id=${departmentId}&year=${year}&lang=ja`;
}

/**
 * スクレイプ結果から個別シラバスURL（PublicSyllabus?...&subject_id=...）を抽出する
 *
 * 実際の個別シラバスURL形式:
 *   https://syllabus.kosen-k.go.jp/Pages/PublicSyllabus
 *     ?school_id=20&department_id=31&subject_id=0001&year=2025&lang=ja
 */
function extractSyllabusUrls(
  links: string[],
  schoolId: string,
  departmentId: number
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of links) {
    if (!url || seen.has(url)) continue;

    // URL 形式チェック
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }

    const isKosenSyllabus =
      parsed.hostname === 'syllabus.kosen-k.go.jp' &&
      parsed.pathname.endsWith('/PublicSyllabus') &&
      parsed.searchParams.get('subject_id') !== null &&
      parsed.searchParams.get('school_id') === schoolId &&
      parsed.searchParams.get('department_id') === String(departmentId);

    if (isKosenSyllabus) {
      // lang=ja を確実に付与
      parsed.searchParams.set('lang', 'ja');
      const normalized = parsed.toString();
      seen.add(url);
      result.push(normalized);
    }
  }

  return result;
}
