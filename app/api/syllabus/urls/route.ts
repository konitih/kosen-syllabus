import { NextRequest, NextResponse } from 'next/server';

/**
 * Stage 1: URLリスト取得
 *
 * 修正点:
 *  - /v1/crawl（非同期・ジョブIDポーリング必要）→ /v1/scrape（同期）に切替
 *  - NEXT_PUBLIC_ prefix を削除（サーバー専用キー）
 *  - year をリクエストボディから受け取り、現在年を上限としてバリデーション
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, department, grade, year } = await request.json();

    if (!schoolId || !department || !grade) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています (schoolId, department, grade)' },
        { status: 400 }
      );
    }

    // サーバーサイド専用キー（NEXT_PUBLIC_ は不要・危険）
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY が環境変数に設定されていません' },
        { status: 500 }
      );
    }

    // 年度は現在年を上限とする
    const currentYear = new Date().getFullYear();
    const academicYear = Math.min(Number(year) || currentYear, currentYear);

    const listingUrl = buildSyllabusListingUrl(schoolId, department, Number(grade), academicYear);
    console.log('[syllabus/urls] Scraping listing page:', listingUrl);

    // /v1/crawl（非同期）ではなく /v1/scrape（同期）を使用
    // 一覧ページを1回スクレイプしてリンクを抽出する
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: listingUrl,
        formats: ['markdown', 'links'],
        timeout: 25000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('[syllabus/urls] FireCrawl error:', errorText);
      return NextResponse.json(
        { error: 'シラバス一覧ページの取得に失敗しました', details: errorText },
        { status: scrapeResponse.status }
      );
    }

    const scrapeData = await scrapeResponse.json();

    // `links` フィールドから詳細ページURLを抽出
    // FireCrawl は formats:['links'] で全リンクを返す
    const rawLinks: string[] = scrapeData.data?.links ?? scrapeData.links ?? [];

    // Markdownからも補完抽出（linksが空の場合のフォールバック）
    const markdownLinks = extractLinksFromMarkdown(
      scrapeData.data?.markdown ?? scrapeData.markdown ?? '',
      listingUrl
    );

    const allLinks = [...new Set([...rawLinks, ...markdownLinks])];
    const syllabusUrls = filterSyllabusDetailUrls(allLinks, schoolId);

    console.log(
      `[syllabus/urls] Found ${syllabusUrls.length} detail URLs from ${allLinks.length} total links`
    );

    return NextResponse.json({
      schoolId,
      department,
      grade,
      year: academicYear,
      totalUrls: syllabusUrls.length,
      urls: syllabusUrls,
      listingUrl,
    });
  } catch (error) {
    console.error('[syllabus/urls] Unexpected error:', error);
    return NextResponse.json(
      { error: 'URLリスト取得中に予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * 長野高専シラバス一覧ページのURLを構築
 * https://syllabus.kosen-k.go.jp/Pages/PublicSyllabus?school_id=XX&dept_code=YY&grade=Z&year=YYYY
 */
function buildSyllabusListingUrl(
  schoolId: string,
  department: string,
  grade: number,
  year: number
): string {
  const BASE = 'https://syllabus.kosen-k.go.jp';
  const deptCode = DEPT_CODES[department] ?? '01';
  const params = new URLSearchParams({
    school_id: schoolId,
    dept_code: deptCode,
    grade: String(grade),
    year: String(year),
  });
  return `${BASE}/Pages/PublicSyllabus?${params}`;
}

/**
 * 学科名 → コードのマッピング（長野高専）
 */
const DEPT_CODES: Record<string, string> = {
  '電子情報工学科': '01',
  '機械工学科': '02',
  '電気工学科': '03',
  '土木工学科': '04',
  '建築学科': '05',
  '物質工学科': '06',
  '環境工学科': '07',
};

/**
 * Markdownテキストからリンクを抽出
 * [テキスト](URL) 形式と <URL> 形式に対応
 */
function extractLinksFromMarkdown(markdown: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const base = new URL(baseUrl);

  // Markdown link pattern: [text](url)
  const mdPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdPattern.exec(markdown)) !== null) {
    urls.push(resolveUrl(match[2].trim(), base));
  }

  // Raw URL pattern: http(s)://...
  const rawPattern = /https?:\/\/[^\s"'<>)]+/g;
  while ((match = rawPattern.exec(markdown)) !== null) {
    urls.push(match[0].trim());
  }

  return urls.filter(Boolean);
}

/**
 * 相対URLを絶対URLに解決
 */
function resolveUrl(href: string, base: URL): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

/**
 * URLリストからシラバス詳細ページのみをフィルタ
 * - 同じドメインのもの
 * - URLに Detail, syllabus, course などのキーワードを含む
 * - 重複排除 + バリデーション
 */
function filterSyllabusDetailUrls(urls: string[], schoolId: string): string[] {
  const SYLLABUS_BASE = 'https://syllabus.kosen-k.go.jp';

  const DETAIL_PATTERNS = [
    /\/Pages\/PublicSyllabus\/Details/i,
    /syllabus[_-]?detail/i,
    /[?&]subject_id=/i,
    /[?&]id=\d+/i,
  ];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    if (!url) continue;

    // バリデーション
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      continue;
    }

    // 同じドメインのみ
    if (!url.startsWith(SYLLABUS_BASE)) continue;

    // 一覧ページ自体は除外
    if (!DETAIL_PATTERNS.some((p) => p.test(url))) continue;

    // 重複排除
    const key = parsedUrl.pathname + parsedUrl.search;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push(url);
  }

  return result;
}
