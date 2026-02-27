import { NextRequest, NextResponse } from 'next/server';
import { validateSyllabusDetail, syllabusDetailToSubject } from '@/lib/syllabusDetailExtractor';
import type { SyllabusDetail } from '@/lib/syllabusDetailExtractor';

/**
 * Stage 2: 個別シラバス詳細スクレイピング
 *
 * 修正点:
 *  - NEXT_PUBLIC_FIRECRAWL_API_KEY → FIRECRAWL_API_KEY（サーバー専用）
 *  - Vercel timeout 対策: 25秒のタイムアウトを明示
 *  - 評価割合バリデーション強化（100%正規化）
 */
export async function POST(request: NextRequest) {
  try {
    const { syllabusUrl, semester, academicYear, index, total } = await request.json();

    if (!syllabusUrl) {
      return NextResponse.json({ error: 'syllabusUrl は必須です' }, { status: 400 });
    }

    // サーバーサイド専用キー
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY が環境変数に設定されていません' },
        { status: 500 }
      );
    }

    // URLバリデーション
    try {
      new URL(syllabusUrl);
    } catch {
      return NextResponse.json({ error: '無効なURLです', url: syllabusUrl }, { status: 400 });
    }

    // 年度バリデーション（未来年度を弾く）
    const currentYear = new Date().getFullYear();
    const validYear = Math.min(Number(academicYear) || currentYear, currentYear);

    console.log(`[syllabus/detail] (${index ?? '?'}/${total ?? '?'}) Scraping: ${syllabusUrl}`);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: syllabusUrl,
        formats: ['markdown'],
        // waitFor はセレクタ文字列ではなくミリ秒数(number)を指定
        // コンテンツが描画されるまで最大2秒待つ
        waitFor: 2000,
        timeout: 25000,
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error(`[syllabus/detail] FireCrawl error for ${syllabusUrl}:`, errorText);
      return NextResponse.json(
        {
          success: false,
          url: syllabusUrl,
          error: 'ページのスクレイピングに失敗しました',
          index,
          total,
        },
        { status: scrapeResponse.status }
      );
    }

    const scrapeData = await scrapeResponse.json();
    const markdown = scrapeData.data?.markdown ?? scrapeData.markdown ?? '';

    if (!markdown || markdown.trim().length < 50) {
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

    // 構造化データ抽出
    const syllabusDetail = extractSyllabusDetail(markdown, syllabusUrl);

    // バリデーション + 正規化
    const validation = validateSyllabusDetail(syllabusDetail);

    if (!validation.isValid) {
      console.warn(`[syllabus/detail] Validation failed for ${syllabusUrl}:`, validation.errors);
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

    return NextResponse.json({
      success: true,
      url: syllabusUrl,
      data: validation.data,
      subject,
      index,
      total,
    });
  } catch (error) {
    console.error('[syllabus/detail] Unexpected error:', error);
    return NextResponse.json(
      { error: '詳細スクレイピング処理でエラーが発生しました' },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------
// Extraction helpers (長野高専 / 全高専共通フォーマット対応)
// -----------------------------------------------------------------------

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

function extractSubjectName(content: string, url: string): string {
  const patterns = [
    /科目名\s*[:：]\s*([^\n]+)/i,
    /授業科目名\s*[:：]\s*([^\n]+)/i,
    /Course\s+Name\s*[:：]\s*([^\n]+)/i,
    /^#{1,3}\s+(?!#+)(.+)/m,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    const name = m?.[1]?.trim();
    if (name && name.length > 0 && name.length < 80) return name;
  }
  // URLから最後のセグメントをフォールバック
  return decodeURIComponent(url.split('/').pop()?.replace(/[?#].*/, '') ?? 'Unknown');
}

function extractInstructor(content: string): string {
  const patterns = [
    /担当教員\s*[:：]\s*([^\n]+)/i,
    /担当者\s*[:：]\s*([^\n]+)/i,
    /Instructor\s*[:：]\s*([^\n]+)/i,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    const name = m?.[1]?.trim();
    if (name) return name;
  }
  return '未入力';
}

function extractCredits(content: string): number {
  const patterns = [/単位数\s*[:：]\s*(\d+)/i, /(\d+)\s*単位/i, /Credits?\s*[:：]\s*(\d+)/i];
  for (const p of patterns) {
    const m = content.match(p);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 10) return n;
    }
  }
  return 2;
}

function extractTerm(content: string): 'spring' | 'fall' | 'both' {
  const hasFront = /前期/.test(content);
  const hasBack = /後期/.test(content);
  if (hasFront && hasBack) return 'both';
  if (hasBack) return 'fall';
  return 'spring'; // デフォルトは前期
}

function extractClassType(content: string): 'lecture' | 'practical' | 'experiment' {
  if (/実験/.test(content)) return 'experiment';
  if (/実習|演習/.test(content)) return 'practical';
  return 'lecture';
}

function extractEvaluationCriteria(
  content: string
): Array<{ name: string; percentage: number }> {
  const criteria: Map<string, number> = new Map();

  // テーブル形式: | 名前 | XX% |
  const tableRe = /\|\s*([^|\d][^|]{1,40}?)\s*\|\s*(\d{1,3})\s*%?\s*\|/g;
  let m;
  while ((m = tableRe.exec(content)) !== null) {
    const name = m[1].trim();
    const pct = parseInt(m[2], 10);
    if (pct > 0 && pct <= 100 && name.length > 0 && !/^[-\s=]+$/.test(name)) {
      criteria.set(name, pct);
    }
  }

  // リスト形式: - 試験: 70%
  const listRe = /[-・]\s*([^:\n]{2,30}?)\s*[:：]\s*(\d{1,3})\s*%/g;
  while ((m = listRe.exec(content)) !== null) {
    const name = m[1].trim();
    const pct = parseInt(m[2], 10);
    if (pct > 0 && pct <= 100) criteria.set(name, pct);
  }

  // インライン: 試験70% 課題20%
  const inlineRe = /([^\d\n%]{2,20}?)(\d{1,3})\s*%/g;
  while ((m = inlineRe.exec(content)) !== null) {
    const name = m[1].trim().replace(/^[^ぁ-ん亜-龯a-zA-Z]+/, '');
    const pct = parseInt(m[2], 10);
    if (pct > 0 && pct <= 100 && name.length >= 2 && !name.includes('http')) {
      if (!criteria.has(name)) criteria.set(name, pct);
    }
  }

  const result = Array.from(criteria.entries()).map(([name, percentage]) => ({
    name,
    percentage,
  }));

  // デフォルト（何も抽出できなかった場合）
  if (result.length === 0) {
    return [
      { name: '試験', percentage: 70 },
      { name: '課題', percentage: 20 },
      { name: '出席', percentage: 10 },
    ];
  }

  return result;
}

function extractDescription(content: string): string | undefined {
  const patterns = [
    /(?:概要|授業概要|Description|Overview)\s*[:：]\s*([^\n]+(?:\n(?![#|])[^\n]+){0,3})/i,
    /(?:目標|到達目標)\s*[:：]\s*([^\n]+)/i,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (m) return m[1].trim().slice(0, 400);
  }
  return undefined;
}
