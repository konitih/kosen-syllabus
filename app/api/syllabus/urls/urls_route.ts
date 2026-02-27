import { NextRequest, NextResponse } from 'next/server';
import { KOSEN_SCHOOLS } from '@/lib/kosenList';

/**
 * app/api/syllabus/urls/route.ts   ← ファイル名は必ず "route.ts" にすること
 *
 * Stage 1: 科目一覧ページをスクレイピングしてシラバス個別URLリストを取得
 */
export async function POST(request: NextRequest) {
  // ── リクエストボディのパース ────────────────────────────────────────────
  let body: { schoolId?: string; department?: string; grade?: number; year?: number };
  try {
    body = await request.json();
  } catch {
    console.error('[urls] リクエストボディのパースに失敗しました');
    return NextResponse.json(
      { error: 'リクエストボディが不正なJSONです' },
      { status: 400 }
    );
  }

  const { schoolId, department, grade, year } = body;

  // ── 必須パラメータチェック ──────────────────────────────────────────────
  if (!schoolId || !department || !grade || !year) {
    const missing = [
      !schoolId && 'schoolId',
      !department && 'department',
      !grade && 'grade',
      !year && 'year',
    ]
      .filter(Boolean)
      .join(', ');
    console.error(`[urls] 必須パラメータ不足: ${missing}`);
    return NextResponse.json(
      { error: `必須パラメータが不足しています: ${missing}` },
      { status: 400 }
    );
  }

  // ── Firecrawl APIキーチェック ───────────────────────────────────────────
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error('[urls] FIRECRAWL_API_KEY が環境変数に設定されていません');
    return NextResponse.json(
      { error: 'サーバー設定エラー: FIRECRAWL_API_KEY が未設定です。Vercel環境変数を確認してください。' },
      { status: 500 }
    );
  }

  // ── kosenList から department_id を引く ────────────────────────────────
  const school = KOSEN_SCHOOLS.find((s) => s.syllabusId === schoolId);
  if (!school) {
    console.error(`[urls] school_id=${schoolId} に対応する学校がkosenListに存在しません`);
    return NextResponse.json(
      { error: `school_id="${schoolId}" に対応する学校が見つかりません。kosenList.ts を確認してください。` },
      { status: 400 }
    );
  }

  const deptObj = school.departments.find(
    (d) => d.name === department || d.label === department
  );

  if (!deptObj?.departmentId) {
    const available = school.departments.map((d) => d.name).join(', ');
    console.error(
      `[urls] department_id not found: schoolId=${schoolId}, dept="${department}". ` +
      `利用可能な学科: ${available}`
    );
    return NextResponse.json(
      {
        error:
          `学科 "${department}" のdepartment_idが見つかりません。` +
          `利用可能な学科: ${available}`,
        totalUrls: 0,
        urls: [],
      },
      { status: 400 }
    );
  }

  const departmentId = deptObj.departmentId;

  // ── スクレイピング対象URL構築 ───────────────────────────────────────────
  const subjectsUrl = buildSubjectsUrl(schoolId, departmentId, year);
  console.log(`[urls] Scraping: ${subjectsUrl}`);
  console.log(`[urls] Params: school=${school.name}, dept=${department}(id=${departmentId}), year=${year}, grade=${grade}`);

  // ── Firecrawl API呼び出し ──────────────────────────────────────────────
  let scrapeResponse: Response;
  try {
    scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: subjectsUrl,
        formats: ['links'],
        timeout: 30000,
      }),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error(`[urls] Firecrawl fetch自体が失敗しました: ${msg}`);
    return NextResponse.json(
      { error: `Firecrawlへのリクエストが失敗しました: ${msg}` },
      { status: 502 }
    );
  }

  if (!scrapeResponse.ok) {
    const errorText = await scrapeResponse.text().catch(() => '(レスポンスボディ取得失敗)');
    console.error(
      `[urls] Firecrawl APIエラー: HTTP ${scrapeResponse.status} ${scrapeResponse.statusText}\n` +
      `  URL: ${subjectsUrl}\n` +
      `  Body: ${errorText.slice(0, 500)}`
    );
    return NextResponse.json(
      {
        error:
          `Firecrawl APIエラー (HTTP ${scrapeResponse.status}): ${errorText.slice(0, 200)}`,
        scrapedUrl: subjectsUrl,
      },
      { status: 502 }
    );
  }

  // ── レスポンスパース ────────────────────────────────────────────────────
  let scrapeData: Record<string, unknown>;
  try {
    scrapeData = await scrapeResponse.json();
  } catch {
    console.error('[urls] FirecrawlレスポンスのJSONパースに失敗');
    return NextResponse.json(
      { error: 'FirecrawlレスポンスのJSONパースに失敗しました' },
      { status: 502 }
    );
  }

  const allLinks: string[] =
    (scrapeData?.data as { links?: string[] })?.links ??
    (scrapeData?.links as string[]) ??
    [];

  console.log(`[urls] Firecrawlから取得したリンク総数: ${allLinks.length}`);

  if (allLinks.length === 0) {
    console.warn(
      `[urls] リンクが0件でした。スクレイピング対象URLを確認してください: ${subjectsUrl}\n` +
      `  scrapeData keys: ${Object.keys(scrapeData).join(', ')}`
    );
  }

  // ── PublicSyllabus URLだけ抽出 ─────────────────────────────────────────
  const syllabusUrls = extractSyllabusUrls(allLinks, schoolId, departmentId);
  console.log(
    `[urls] 抽出したシラバスURL数: ${syllabusUrls.length} / 全リンク: ${allLinks.length}`
  );

  if (syllabusUrls.length === 0 && allLinks.length > 0) {
    // リンクはあるが条件に合うURLがない → デバッグ用にサンプルを出力
    const sample = allLinks.slice(0, 5).join('\n  ');
    console.warn(
      `[urls] PublicSyllabusURLが0件。リンクサンプル:\n  ${sample}\n` +
      `  フィルター条件: hostname=syllabus.kosen-k.go.jp, /PublicSyllabus, subject_id, school_id=${schoolId}, department_id=${departmentId}`
    );
  }

  return NextResponse.json({
    schoolId,
    department,
    departmentId,
    grade,
    year,
    scrapedUrl: subjectsUrl,
    totalLinks: allLinks.length,
    totalUrls: syllabusUrls.length,
    urls: syllabusUrls,
  });
}

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

/**
 * 科目一覧ページのURLを構築
 * 例: https://syllabus.kosen-k.go.jp/Pages/PublicSubjects?school_id=20&department_id=31&year=2025&lang=ja
 */
function buildSubjectsUrl(schoolId: string, departmentId: number, year: number): string {
  return (
    `https://syllabus.kosen-k.go.jp/Pages/PublicSubjects` +
    `?school_id=${schoolId}&department_id=${departmentId}&year=${year}&lang=ja`
  );
}

/**
 * リンク一覧から個別シラバスURLを抽出
 * 対象形式: https://syllabus.kosen-k.go.jp/Pages/PublicSyllabus?school_id=XX&department_id=XX&subject_id=XXXX&year=XXXX
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

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }

    const isTarget =
      parsed.hostname === 'syllabus.kosen-k.go.jp' &&
      (parsed.pathname.endsWith('/PublicSyllabus') ||
        parsed.pathname.includes('/PublicSyllabus')) &&
      parsed.searchParams.get('subject_id') !== null &&
      parsed.searchParams.get('school_id') === String(schoolId) &&
      parsed.searchParams.get('department_id') === String(departmentId);

    if (isTarget) {
      parsed.searchParams.set('lang', 'ja');
      const normalized = parsed.toString();
      seen.add(url);
      result.push(normalized);
    }
  }

  return result;
}
