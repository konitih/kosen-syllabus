/**
 * lib/evaluationNormalizer.ts
 *
 * 評価割合の合計を100%に正規化するユーティリティ
 * syllabusDetailExtractor.ts の validateEvaluationTotal / normalizeEvaluationPercentages
 * と同じロジックを、アプリ全体から使いやすい形で再エクスポートします。
 *
 * 使い方:
 *   import { normalizeToHundred, isEvaluationValid } from '@/lib/evaluationNormalizer';
 */

export interface EvaluationItem {
  id?: string;
  name: string;
  weight: number;    // パーセンテージ（0〜100）
  maxPoints?: number;
}

/** 合計が100%かどうかを許容誤差±2%で判定 */
export function isEvaluationValid(items: EvaluationItem[]): boolean {
  if (!items || items.length === 0) return false;
  const total = items.reduce((s, i) => s + i.weight, 0);
  return Math.abs(total - 100) <= 2;
}

/**
 * 評価割合を100%に正規化する
 *
 * - 既に100%ならそのまま返す
 * - 合計が0なら等分割する
 * - それ以外は比率を保ちながら丸め、端数を最大項目に加算
 */
export function normalizeToHundred(items: EvaluationItem[]): EvaluationItem[] {
  if (items.length === 0) return items;

  const total = items.reduce((s, i) => s + i.weight, 0);

  if (total === 100) return items;

  // 合計0 → 等分割
  if (total === 0) {
    const equal = Math.floor(100 / items.length);
    const remainder = 100 - equal * items.length;
    return items.map((item, idx) => ({
      ...item,
      weight: equal + (idx === 0 ? remainder : 0),
    }));
  }

  // 比率で丸め（小数点以下切り捨て）
  const normalized = items.map((item) => ({
    ...item,
    weight: Math.floor((item.weight / total) * 100),
  }));

  // 端数を最大項目に加算して合計を100に調整
  const currentTotal = normalized.reduce((s, i) => s + i.weight, 0);
  const diff = 100 - currentTotal;

  if (diff !== 0) {
    // 最大weightのインデックスを探す
    const maxIdx = normalized.reduce(
      (maxI, item, i, arr) => (item.weight > arr[maxI].weight ? i : maxI),
      0
    );
    normalized[maxIdx].weight += diff;
  }

  return normalized;
}

/**
 * Subject.evaluationCriteria（weight フィールド）を正規化して返す
 * 変換なしで返すのは合計がすでに100%の場合のみ
 */
export function normalizeSubjectEvaluation<T extends EvaluationItem>(criteria: T[]): T[] {
  if (isEvaluationValid(criteria)) return criteria;

  const normalized = normalizeToHundred(criteria as EvaluationItem[]);
  // 型を保持しながら weight だけ上書き
  return criteria.map((item, i) => ({ ...item, weight: normalized[i].weight }));
}
