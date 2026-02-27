import { Subject } from './types';
import { SyllabusDetail, syllabusCache } from './syllabusDetailExtractor';

/**
 * KOSEN Nagano specific syllabus service
 * Encapsulates all Nagano-specific logic and URL patterns
 */

const NAGANO_KOSEN_ID = '20';
const NAGANO_KOSEN_NAME = '長野工業高等専門学校';
const NAGANO_KOSEN_BASE_URL = 'https://syllabus.kosen-k.go.jp';

/**
 * Department mappings for Nagano KOSEN
 * Maps department names to their codes in the syllabus system
 */
export const NAGANO_DEPARTMENTS: Record<string, { code: string; name: string }> = {
  '電子情報工学科': { code: '01', name: '電子情報工学科' },
  '機械工学科': { code: '02', name: '機械工学科' },
  '電気工学科': { code: '03', name: '電気工学科' },
  '土木工学科': { code: '04', name: '土木工学科' },
  '建築学科': { code: '05', name: '建築学科' },
  '物質工学科': { code: '06', name: '物質工学科' },
  '環境工学科': { code: '07', name: '環境工学科' },
};

/**
 * Build Nagano KOSEN specific syllabus URL
 */
export function buildNaganoSyllabusUrl(
  department: string,
  grade: number,
  year: number = 2024
): string {
  const deptCode = getDepartmentCode(department);
  return `${NAGANO_KOSEN_BASE_URL}/Pages/PublicSyllabus?school_id=${NAGANO_KOSEN_ID}&dept_code=${deptCode}&grade=${grade}&year=${year}`;
}

/**
 * Get department code by name
 */
export function getDepartmentCode(departmentName: string): string {
  const match = Object.entries(NAGANO_DEPARTMENTS).find(
    ([name]) => name === departmentName || name.includes(departmentName)
  );

  if (match) {
    return match[1].code;
  }

  // Fallback to first department if not found
  return '01';
}

/**
 * Get all available departments for Nagano KOSEN
 */
export function getNaganoAvailableDepartments(): string[] {
  return Object.keys(NAGANO_DEPARTMENTS);
}

/**
 * Service interface for Nagano syllabus operations
 */
export const kosenNaganoService = {
  /**
   * Get cached syllabi for Nagano KOSEN
   */
  getCachedSyllabi(department: string, grade: number, year: number): SyllabusDetail[] | null {
    const cacheKey = syllabusCache.generateKey(NAGANO_KOSEN_ID, department, grade, year);
    return syllabusCache.get(cacheKey);
  },

  /**
   * Save syllabi to cache
   */
  cacheSyllabi(
    department: string,
    grade: number,
    year: number,
    syllabi: SyllabusDetail[],
    expiryHours: number = 24
  ): void {
    const cacheKey = syllabusCache.generateKey(NAGANO_KOSEN_ID, department, grade, year);
    syllabusCache.save(cacheKey, syllabi, expiryHours);
  },

  /**
   * Clear cache for specific parameters
   */
  clearCache(department: string, grade: number, year: number): void {
    const cacheKey = syllabusCache.generateKey(NAGANO_KOSEN_ID, department, grade, year);
    syllabusCache.clear(cacheKey);
  },

  /**
   * Clear all Nagano KOSEN caches
   */
  clearAllCaches(): void {
    syllabusCache.clearAll();
  },

  /**
   * Generate syllabus search URL for Nagano KOSEN
   */
  generateSearchUrl(department: string, grade: number, year?: number): string {
    return buildNaganoSyllabusUrl(department, grade, year || new Date().getFullYear());
  },

  /**
   * Extract subject identifier from Nagano syllabus URL
   */
  extractSubjectIdFromUrl(url: string): string | null {
    // Nagano syllabus URLs typically have pattern like:
    // /Pages/PublicSyllabus/Details/XXXXX or ?id=XXXXX
    const match = url.match(/(\?|&)id=([^&]+)/i) || url.match(/Details\/([^/]+)/i);
    return match ? match[2] : null;
  },

  /**
   * Validate if URL is from Nagano KOSEN
   */
  isNaganoSyllabusUrl(url: string): boolean {
    return url.includes(NAGANO_KOSEN_BASE_URL) || url.includes('nagano') && url.includes('syllabus');
  },

  /**
   * Convert multiple SyllabusDetail objects to Subject objects for Nagano
   */
  convertToSubjects(
    syllabi: SyllabusDetail[],
    semester: 'spring' | 'fall',
    academicYear: number
  ): Subject[] {
    return syllabi.map((detail, index) => {
      const classesPerSemester = detail.credits * 15;
      const absenceThreshold = detail.classType === 'experiment'
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
        courseType: 'required',
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

  /**
   * Get recommended grades for Nagano KOSEN based on class type
   */
  getRecommendedEvaluationCriteria(classType: 'lecture' | 'practical' | 'experiment') {
    // Standard evaluation ratios for Nagano KOSEN
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

    // Default for lecture
    return [
      { name: '試験', percentage: 70 },
      { name: '課題・小テスト', percentage: 20 },
      { name: '出席', percentage: 10 },
    ];
  },

  /**
   * Validate Nagano KOSEN specific constraints
   */
  validateNaganoConstraints(subjects: Subject[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check total credits for 5th year (typical limit)
    const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);
    if (totalCredits > 80) {
      errors.push(`総単位数が多い: ${totalCredits}単位（推奨: 60〜80単位）`);
    }

    // Check evaluation criteria distribution
    for (const subject of subjects) {
      const totalWeight = subject.evaluationCriteria.reduce((sum, e) => sum + e.weight, 0);
      if (totalWeight !== 100) {
        errors.push(`${subject.name}: 評価割合の合計が${totalWeight}%です（100%である必要があります）`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Get course level description for display
   */
  getCourseLevelDescription(grade: number): string {
    const descriptions: Record<number, string> = {
      1: '1年生（基礎科目）',
      2: '2年生（基礎科目）',
      3: '3年生（基礎専門科目）',
      4: '4年生（専門科目）',
      5: '5年生（応用専門科目）',
    };

    return descriptions[grade] || `${grade}年生`;
  },
};
