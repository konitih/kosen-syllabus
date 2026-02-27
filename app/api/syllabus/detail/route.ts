import { NextRequest, NextResponse } from 'next/server';
import { validateSyllabusDetail, syllabusDetailToSubject } from '@/lib/syllabusDetailExtractor';
import type { SyllabusDetail } from '@/lib/syllabusDetailExtractor';

/**
 * app/api/syllabus/detail/route.ts
 *
 * Stage 2: 個別シラバスページをスクレイピングして科目データを構造化
 *
 * ── 実際の高専Webシラバス Markdown 構造 ────────────────────────────────
 *  科目名:   # 論理回路Ⅰ
 *  基礎情報: | 担当教員 | 姜 天水 | | |
 *            | 単位の種別と単位数 | 履修単位: 1 |
 *            | 開設期 | 前期 |
 *            | 授業形態 | 授業 |
 *  評価割合: |  | 試験 | レポート | 平常点 |  | その他 | 合計 |
 *            | --- | --- | --- | --- | --- | --- | --- |
 *            | 総合評価割合 | 80 | 20 | 0 | 0 | 0 | 100 |
 * ────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: NextRequest) {
  let body: {
    syllabusUrl?: string;
    semester?: string;
    academicYear?: number;
    index?: number;
    total?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です' }, { status: 400 });
  }

  const { syllabusUrl, semester, academicYear, index, total } = body;

  if (!syllabusUrl) {
    return NextResponse.json({ error: 'syllabusUrl は必須です' }, { status: 400 });
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.error('[detail] FIRECRAWL_API_KEY が未設定です');
    return NextResponse.json(
      { error: 'サーバー設定エラー: FIRECRAWL_API_KEY が未設定です' },
      { status: 500 }
    );
  }

  try {
    new URL(syllabusUrl);
  } catch {
    return NextResponse.json({ error: '無効なURLです', url: syllabusUrl }, { status: 400 });
  }

  const currentYear = new Date().getFullYear();
  const validYear = Math.min(Number(academicYear) || currentYear, currentYear);

  console.log(`[detail] (${index ?? '?'}/${total ?? '?'}) Scraping: ${syllabusUrl}`);

  // ── Firecrawl呼び出し ─────────────────────────────────────────────────
  let scrapeResponse: Response;
  try {
    scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: syllabusUrl,
        formats: ['markdown'],
        timeout: 25000,
      }),
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error(`[detail] fetch失敗: ${msg}`);
    return NextResponse.json(
      { success: false, url: syllabusUrl, error: `Firecrawlへの接続失敗: ${msg}`, index, total },
      { status: 502 }
    );
  }

  if (!scrapeResponse.ok) {
    const errText = await scrapeResponse.text().catch(() => '');
    console.error(`[detail] Firecrawl HTTP ${scrapeResponse.status}: ${errText.slice(0, 200)}`);
    return NextResponse.json(
      {
        success: false,
        url: syllabusUrl,
        error: `Firecrawl APIエラー (HTTP ${scrapeResponse.status})`,
        index,
        total,
      },
      { status: scrapeResponse.status }
    );
  }

  const scrapeData = await scrapeResponse.json().catch(() => ({}));
  const markdown: string = scrapeData?.data?.markdown ?? scrapeData?.markdown ?? '';

  if (!markdown || markdown.trim().length < 50) {
    console.error(`[detail] Markdownが空または短すぎます: "${markdown.slice(0, 50)}"`);
    return NextResponse.json(
      {
        success: false,
        url: syllabusUrl,
        error: 'コンテンツが取得できませんでした（ページが空またはJS必須）',
        index,
        total,
      },
      { status: 200 }
    );
  }

  // ── デバッグ: Markdownの冒頭をログに出力 ─────────────────────────────
  console.log(`[detail] Markdown冒頭100文字: "${markdown.slice(0, 100).replace(/\n/g, ' ')}"`);

  // ── 構造化データ抽出 ───────────────────────────────────────────────────
  const syllabusDetail = extractSyllabusDetail(markdown, syllabusUrl);

  console.log(
    `[detail] 抽出結果: ` +
    `name="${syllabusDetail.subjectName}", ` +
    `instructor="${syllabusDetail.instructor}", ` +
    `credits=${syllabusDetail.credits}, ` +
    `term=${syllabusDetail.term}, ` +
    `classType=${syllabusDetail.classType}, ` +
    `eval=${JSON.stringify(syllabusDetail.evaluationCriteria)}`
  );

  // ── バリデーション + 正規化 ────────────────────────────────────────────
  const validation = validateSyllabusDetail(syllabusDetail);

  if (!validation.isValid) {
    console.warn(
      `[detail] バリデーション失敗 (${syllabusUrl}): ${validation.errors.join(', ')}\n` +
      `  partialData: ${JSON.stringify(syllabusDetail)}`
    );
    return NextResponse.json(
      {
        success: false,
        url: syllabusUrl,
        errors: validation.errors,
        partialData: syllabusDetail,
        index,
        total,
      },
      { status: 200 }
    );
  }

  const semester_: 'spring' | 'fall' = semester === 'fall' ? 'fall' : 'spring';
  const subject = syllabusDetailToSubject(validation.data!, semester_, validYear);

  console.log(`[detail] 成功: "${subject.name}" (${subject.credits}単位, ${subject.classType})`);

  return NextResponse.json({
    success: true,
    url: syllabusUrl,
    data: validation.data,
    subject,
    index,
    total,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 抽出ヘルパー（高専Webシラバス Markdown 形式対応）
// ─────────────────────────────────────────────────────────────────────────

function extractSyllabusDetail(markdown: string, url: string): Partial<SyllabusDetail> {
  return {
    subjectName: extractSubjectName(markdown, url),
    instructor: extractInstructor(markdown),
    credits: extractCredits(markdown),
    term: extractTerm(markdown),
    classType: extractClassType(markdown),
    evaluationCriteria: extractEvaluationCriteria(markdown),
    description: extractDescription(markdown),
  };
}

// ── 科目名 ────────────────────────────────────────────────────────────────
function extractSubjectName(content: string, url: string): string {
  // 1. h1ヘッダー: # 論理回路Ⅰ  （最初の1件）
  const h1 = content.match(/^#\s+(.+?)$/m);
  const h1Name = h1?.[1]?.trim();
  if (h1Name && h1Name.length > 0 && h1Name.length < 80) {
    // ナビゲーションや無関係ヘッダーを除外
    if (!['高専Webシラバス', 'ホーム'].includes(h1Name)) return h1Name;
  }

  // 2. テーブル内 授業科目フィールド: | 授業科目 | 論理回路Ⅰ | | |
  const tableSubject = content.match(/授業科目\s*\|\s*([^|\n]+)/);
  const tableName = tableSubject?.[1]?.trim();
  if (tableName && tableName.length > 0 && tableName.length < 80) return tableName;

  // 3. URLの subject_id をフォールバック
  try {
    const params = new URL(url).searchParams;
    return params.get('subject_id') ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ── 担当教員 ──────────────────────────────────────────────────────────────
function extractInstructor(content: string): string {
  const patterns = [
    // 高専Webシラバス公式形式（テーブル）: | 担当教員 | 姜 天水 | | |
    /担当教員\s*\|\s*([^|\n]+)/,
    // コロン形式（念のため）
    /担当教員\s*[:：]\s*([^\n|]+)/i,
    /担当者\s*[:：]\s*([^\n|]+)/i,
    /Instructor\s*[:：]\s*([^\n|]+)/i,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (!m) continue;
    // パイプや空白を除去してクリーンな名前を取得
    const name = m[1].trim().replace(/\s*\|.*$/, '').trim();
    if (name && name.length > 0 && name.length < 60) return name;
  }
  return '未入力';
}

// ── 単位数 ────────────────────────────────────────────────────────────────
function extractCredits(content: string): number {
  const patterns = [
    // 高専Webシラバス公式形式: | 単位の種別と単位数 | 履修単位: 1 |
    /単位の種別と単位数\s*\|[^|]*?(\d+)/,
    // 履修単位 / 学修単位
    /履修単位[：:\s]*(\d+)/,
    /学修単位[：:\s]*(\d+)/,
    // 汎用形式
    /単位数\s*[:：]\s*(\d+)/i,
    /(\d+)\s*単位/i,
    /Credits?\s*[:：]\s*(\d+)/i,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 10) return n;
  }
  return 2; // デフォルト
}

// ── 開講期（前期/後期/通年） ─────────────────────────────────────────────
function extractTerm(content: string): 'spring' | 'fall' | 'both' {
  // 開設期フィールドから直接取得: | 開設期 | 前期 |
  const termMatch = content.match(/開設期\s*\|\s*([^|\n]+)/);
  if (termMatch) {
    const term = termMatch[1].trim();
    if (/通年|前期.*後期|後期.*前期|前後期/.test(term)) return 'both';
    if (/後期/.test(term)) return 'fall';
    if (/前期/.test(term)) return 'spring';
  }

  // フォールバック: ページ全体から判断
  const hasFront = /前期/.test(content);
  const hasBack = /後期/.test(content);
  if (hasFront && hasBack) return 'both';
  if (hasBack) return 'fall';
  return 'spring';
}

// ── 授業種別（講義/実験/実習） ────────────────────────────────────────────
function extractClassType(content: string): 'lecture' | 'practical' | 'experiment' {
  // 授業形態フィールドから直接取得: | 授業形態 | 実験 |
  const formMatch = content.match(/授業形態\s*\|\s*([^|\n]+)/);
  if (formMatch) {
    const form = formMatch[1].trim();
    if (/実験/.test(form)) return 'experiment';
    if (/実習|演習/.test(form)) return 'practical';
    return 'lecture'; // 授業, 講義 など
  }

  // フォールバック: 科目名（h1）から判断
  const h1 = content.match(/^#\s+(.+?)$/m);
  if (h1) {
    const title = h1[1];
    if (/実験/.test(title)) return 'experiment';
    if (/実習|演習/.test(title)) return 'practical';
  }

  return 'lecture';
}

// ── 評価割合 ─────────────────────────────────────────────────────────────
//
// 高専Webシラバスの評価割合テーブル構造（実測）:
//
//   ### 評価割合
//   |  | 試験 | レポート | 平常点 |  | その他 | 合計 |
//   | --- | --- | --- | --- | --- | --- | --- |
//   | 総合評価割合 | 80 | 20 | 0 | 0 | 0 | 100 |
//   | 配点 | 80 | 20 | 0 | 0 | 0 | 100 |
//
// → ヘッダー行と値行が別れており、%記号なし。
//   "総合評価割合"行の値を採用する。
//
function extractEvaluationCriteria(
  content: string
): Array<{ name: string; percentage: number }> {
  const EVAL_KEYWORDS = ['試験', 'レポート', '平常点', 'その他', '小テスト', '出席', '報告書'];

  // ── Strategy 1: ### 評価割合 テーブル（最優先）────────────────────────
  // セクション内のテーブル行を抽出
  const evalSection = content.match(
    /###\s*評価割合([\s\S]*?)(?=\n###|\n©|$)/
  );
  const section = evalSection ? evalSection[1] : content;

  const tableLines = section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));

  let headerCols: string[] = [];
  let valueCols: string[] = [];

  for (const line of tableLines) {
    // セパレータ行 (| --- | --- | ...) をスキップ
    if (/^\|[\s|:-]+\|$/.test(line)) continue;

    // パイプで分割、先頭と末尾の空要素を除去してトリム
    const cols = line.split('|').map((c) => c.trim());
    const cells = cols.slice(1, cols.length - 1);

    if (cells.length < 2) continue;

    // ヘッダー行: 評価キーワードを含む行
    if (EVAL_KEYWORDS.some((kw) => cells.includes(kw))) {
      headerCols = cells;
      continue;
    }

    // 値行: "総合評価割合" で始まる行
    if (cells[0] === '総合評価割合' && headerCols.length > 0) {
      valueCols = cells.slice(1); // ラベル列 "総合評価割合" を除去
      break;
    }
  }

  if (headerCols.length > 0 && valueCols.length > 0) {
    // headerCols[0] は空（行ラベル用の列）→ 実際の名前は [1] から始まる
    const nameOffset = headerCols[0] === '' ? 1 : 0;
    const result: Array<{ name: string; percentage: number }> = [];

    for (let i = 0; i < valueCols.length; i++) {
      const name = headerCols[nameOffset + i] ?? '';
      const val = parseInt(valueCols[i], 10);

      // 空名・"合計"・NaN・0以下は除外
      if (!name || name === '合計' || isNaN(val) || val <= 0) continue;

      result.push({ name, percentage: val });
    }

    if (result.length > 0) {
      const total = result.reduce((s, c) => s + c.percentage, 0);
      console.log(
        `[detail] 評価割合テーブル解析成功: ` +
        `${result.map((c) => `${c.name}=${c.percentage}`).join(', ')} (合計=${total})`
      );
      return result;
    }
  }

  // ── Strategy 2: 注意点の括弧内 % ─────────────────────────────────────
  // 例: ＜成績評価＞確認試験の成績（80%）、レポート（20%）
  const notesMatch = content.match(
    /(?:＜成績評価＞|成績評価[:：]?)([\s\S]*?)(?:\n\n|\n(?=[^|\s]))/
  );
  if (notesMatch) {
    const notesText = notesMatch[1];
    const result: Array<{ name: string; percentage: number }> = [];
    // 評価区分キーワード + 括弧パーセント
    const evalItemRe =
      /(試験|筆記試験|到達度試験|確認試験|中間試験|期末試験|定期試験|小テスト|レポート|報告書|平常点|出席|課題)[^（(（\n]*?[（(（](\d+)%[）)）]/g;
    let m;
    while ((m = evalItemRe.exec(notesText)) !== null) {
      const name = m[1];
      const pct = parseInt(m[2], 10);
      if (pct > 0 && pct <= 100 && !result.find((r) => r.name === name)) {
        result.push({ name, percentage: pct });
      }
    }
    const total = result.reduce((s, c) => s + c.percentage, 0);
    if (result.length > 0 && total >= 98 && total <= 102) {
      console.log(
        `[detail] 注意点テキスト解析: ` +
        `${result.map((c) => `${c.name}=${c.percentage}`).join(', ')} (合計=${total})`
      );
      return result;
    }
  }

  // ── Strategy 3: 汎用インライン検索 ───────────────────────────────────
  const generalResult: Array<{ name: string; percentage: number }> = [];
  // キーワードの直近の%数値を取得（誤マッチを最小化するため範囲を限定）
  const generalRe =
    /(試験|筆記試験|到達度試験|確認試験|小テスト|レポート|報告書|平常点|出席|課題)[^\d（(（\n]{0,20}?(\d{1,3})\s*%/g;
  let gm;
  while ((gm = generalRe.exec(content)) !== null) {
    const name = gm[1];
    const pct = parseInt(gm[2], 10);
    if (pct > 0 && pct <= 100 && !generalResult.find((r) => r.name === name)) {
      generalResult.push({ name, percentage: pct });
    }
  }
  const generalTotal = generalResult.reduce((s, c) => s + c.percentage, 0);
  if (generalResult.length > 0 && generalTotal >= 98 && generalTotal <= 102) {
    console.log(
      `[detail] 汎用インライン解析: ` +
      `${generalResult.map((c) => `${c.name}=${c.percentage}`).join(', ')} (合計=${generalTotal})`
    );
    return generalResult;
  }

  // ── デフォルト ───────────────────────────────────────────────────────
  console.warn(
    '[detail] 評価割合の自動抽出に失敗しました。デフォルト値（試験80%/レポート20%）を使用します。'
  );
  return [
    { name: '試験', percentage: 80 },
    { name: 'レポート', percentage: 20 },
  ];
}

// ── 授業概要 ──────────────────────────────────────────────────────────────
function extractDescription(content: string): string | undefined {
  // 概要フィールド: **概要:**\n\nテキスト
  const overviewMatch = content.match(
    /\*\*概要[:：]\*\*\s*\n+\s*([^\n*|]{10,})/
  );
  if (overviewMatch) return overviewMatch[1].trim().slice(0, 400);

  // テーブル形式の概要
  const tableOverview = content.match(/(?:概要|授業概要)\s*\|\s*([^|\n]{10,})/);
  if (tableOverview) return tableOverview[1].trim().slice(0, 400);

  return undefined;
}
