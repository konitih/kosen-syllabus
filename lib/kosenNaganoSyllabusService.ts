import { Subject } from './types';
import { SyllabusDetail, syllabusCache } from './syllabusDetailExtractor';

/**
 * lib/kosenNaganoSyllabusService.ts
 *
 * 長野高専シラバスサービス
 * 学科名は kosenList.ts の Department.name と一致させてください。
 *
 * 令和4年度（2022年度）改組後の学科名:
 *   '工学科' / '情報エレクトロニクス系' / '機械ロボティクス系' / '都市デザイン系'
 * 令和3年度（2021年度）以前の旧学科名:
 *   '機械工学科' / '電気電子工学科' / '電子制御工学科' / '電子情報工学科' / '環境都市工学科'
 */

const NAGANO_KOSEN_ID = '20';
const NAGANO_KOSEN_BASE_URL = 'https://syllabus.kosen-k.go.jp';

/**
 * 長野高専学科コードマッピング
 *
 * ⚠️ シラバスシステムの実際の dept_code 値は公式サイトで要確認。
 *    下記は推定値です。
 */
export const NAGANO_DEPARTMENTS: Record<string, { code: string; name: string }> = {
  // ─── 令和4年度以降（新課程） ────────────────
  '工学科':             { code: '01', name: '工学科' },
  '情報エレクトロニクス系': { code: '02', name: '情報エレクトロニクス系' },
  '機械ロボティクス系':   { code: '03', name: '機械ロボティクス系' },
  '都市デザイン系':       { code: '04', name: '都市デザイン系' },
  // ─── 令和3年度以前（旧5学科） ────────────────
  '機械工学科':         { code: '11', name: '機械工学科' },
  '電気電子工学科':     { code: '12', name: '電気電子工学科' },
  '電子制御工学科':     { code: '13', name: '電子制御工学科' },
  '電子情報工学科':     { code: '14', name: '電子情報工学科' },
  '環境都市工学科':     { code: '15', name: '環境都市工学科' },
};

/**
 * 学科名 → コード変換
 * 完全一致 → 部分一致 → デフォルト('01') の順でフォールバック
 */
export function getDepartmentCode(departmentName: string): string {
  // 完全一致
  if (NAGANO_DEPARTMENTS[departmentName]) {
    return NAGANO_DEPARTMENTS[departmentName].code;
  }
  // 部分一致
  const partial = Object.entries(NAGANO_DEPARTMENTS).find(([key]) =>
    departmentName.includes(key) || key.includes(departmentName)
  );
  if (partial) return partial[1].code;

  console.warn(`[kosenNagano] Unknown department: "${departmentName}", using default code '01'`);
  return '01';
}

/**
 * シラバス検索 URL を構築する
 */
export function buildNaganoSyllabusUrl(
  department: string,
  grade: number,
  year: number = new Date().getFullYear()
): string {
  const deptCode = getDepartmentCode(department);
  return (
    `${NAGANO_KOSEN_BASE_URL}/Pages/PublicSyllabus` +
    `?school_id=${NAGANO_KOSEN_ID}&dept_code=${deptCode}&grade=${grade}&year=${year}`
  );
}

/** 全学科名リスト */
export function getNaganoAvailableDepartments(): string[] {
  return Object.keys(NAGANO_DEPARTMENTS);
}

/** サービスオブジェクト */
export const kosenNaganoService = {
  getCachedSyllabi(department: string, grade: number, year: number): SyllabusDetail[] | null {
    const key = syllabusCache.generateKey(NAGANO_KOSEN_ID, department, grade, year);
    return syllabusCache.get(key);
  },

  cacheSyllabi(
    department: string,
    grade: number,
    year: number,
    syllabi: SyllabusDetail[],
    expiryHours = 24
  ): void {
    const key = syllabusCache.generateKey(NAGANO_KOSEN_ID, department, grade, year);
    syllabusCache.save(key, syllabi, expiryHours);
  },

  clearCache(department: string, grade: number, year: number): void {
    const key = syllabusCache.generateKey(NAGANO_KOSEN_ID, department, grade, year);
    syllabusCache.clear(key);
  },

  clearAllCaches(): void {
    syllabusCache.clearAll();
  },

  generateSearchUrl(department: string, grade: number, year?: number): string {
    return buildNaganoSyllabusUrl(department, grade, year ?? new Date().getFullYear());
  },

  extractSubjectIdFromUrl(url: string): string | null {
    const match = url.match(/[?&]id=([^&]+)/i) || url.match(/Details\/([^/?]+)/i);
    return match ? match[1] : null;
  },

  isNaganoSyllabusUrl(url: string): boolean {
    return (
      url.includes(NAGANO_KOSEN_BASE_URL) ||
      (url.includes('nagano') && url.includes('syllabus'))
    );
  },

  convertToSubjects(
    syllabi: SyllabusDetail[],
    semester: 'spring' | 'fall',
    academicYear: number
  ): Subject[] {
    return syllabi.map((detail, index) => {
      const classesPerSemester = detail.credits * 15;
      const absenceThreshold =
        detail.classType === 'experiment'
          ? Math.ceil(classesPerSemester / 10)
          : Math.floor(classesPerSemester / 3);

      const evaluationCriteria = detail.evaluationCriteria.map((e, idx) => ({
        id: `eval-${index}-${idx}`,
        name: e.name,
        weight: e.percentage,
        maxPoints: 100,
      }));

      return {
        id: `nagano-${Date.now()}-${Math.random()}`,
        name: detail.subjectName,
        instructor: detail.instructor,
        courseType: 'required' as const,
        classType: detail.classType,
        credits: detail.credits,
        passingGrade: 60,
        evaluationCriteria,
        grades: [],
        absences: 0,
        absenceRecords: [],
        absenceThreshold,
        classesPerSemester,
        semester,
        academicYear,
      };
    });
  },

  getRecommendedEvaluationCriteria(classType: 'lecture' | 'practical' | 'experiment') {
    if (classType === 'experiment') {
      return [
        { name: '実験レポート', percentage: 40 },
        { name: '実験テスト', percentage: 40 },
        { name: '出席・実験態度', percentage: 20 },
      ];
    }
    if (classType === 'practical') {
      return [
        { name: '実習評価', percentage: 50 },
        { name: '課題・作品', percentage: 30 },
        { name: '出席', percentage: 20 },
      ];
    }
    return [
      { name: '試験', percentage: 70 },
      { name: '課題・小テスト', percentage: 20 },
      { name: '出席', percentage: 10 },
    ];
  },

  validateNaganoConstraints(subjects: Subject[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
    if (totalCredits > 80) {
      errors.push(`総単位数が多すぎます: ${totalCredits}単位（推奨: 60〜80単位）`);
    }
    for (const subject of subjects) {
      const totalWeight = subject.evaluationCriteria.reduce((sum, e) => sum + e.weight, 0);
      if (totalWeight !== 100) {
        errors.push(`${subject.name}: 評価割合の合計が${totalWeight}%です（100%にしてください）`);
      }
    }
    return { isValid: errors.length === 0, errors };
  },

  getCourseLevelDescription(grade: number): string {
    const desc: Record<number, string> = {
      1: '1年生（基礎科目）',
      2: '2年生（基礎科目）',
      3: '3年生（基礎専門科目）',
      4: '4年生（専門科目）',
      5: '5年生（応用専門科目）',
    };
    return desc[grade] ?? `${grade}年生`;
  },
};
