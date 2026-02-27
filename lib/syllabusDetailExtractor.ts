import { Subject } from './types';

/**
 * Extracted syllabus detail from LLM parsing
 */
export interface SyllabusDetail {
  subjectName: string;
  instructor: string;
  credits: number;
  term: 'spring' | 'fall' | 'both';
  evaluationCriteria: {
    name: string;
    percentage: number;
  }[];
  classType: 'lecture' | 'practical' | 'experiment';
  description?: string;
}

/**
 * Validation result for evaluation criteria
 */
export interface EvaluationValidationResult {
  isValid: boolean;
  total: number;
  errors: string[];
  normalized?: {
    name: string;
    percentage: number;
  }[];
}

/**
 * Validate that evaluation criteria percentages sum to 100%
 * Allows for small rounding errors (±2%), normalizes if close
 */
export function validateEvaluationTotal(
  criteria: { name: string; percentage: number }[]
): EvaluationValidationResult {
  const errors: string[] = [];
  
  if (!criteria || criteria.length === 0) {
    return {
      isValid: false,
      total: 0,
      errors: ['評価割合が空です'],
    };
  }

  // Calculate total
  const total = criteria.reduce((sum, c) => sum + c.percentage, 0);

  // Allow for rounding errors (±2%)
  const TOLERANCE = 2;
  
  if (total === 100) {
    return {
      isValid: true,
      total: 100,
      errors: [],
    };
  }

  if (Math.abs(total - 100) <= TOLERANCE) {
    // Normalize to exactly 100%
    const normalized = normalizeEvaluationPercentages(criteria);
    return {
      isValid: true,
      total: 100,
      errors: [`警告: 元々の合計は${total}%でしたが、正規化されました`],
      normalized,
    };
  }

  // Invalid: too far from 100%
  errors.push(`評価割合の合計が${total}%です（100%である必要があります）`);
  if (total > 100) {
    errors.push(`超過分: ${total - 100}%`);
  } else {
    errors.push(`不足分: ${100 - total}%`);
  }

  return {
    isValid: false,
    total,
    errors,
  };
}

/**
 * Normalize evaluation percentages to sum to exactly 100%
 * Distributes rounding error proportionally
 */
export function normalizeEvaluationPercentages(
  criteria: { name: string; percentage: number }[]
): { name: string; percentage: number }[] {
  const total = criteria.reduce((sum, c) => sum + c.percentage, 0);
  
  if (total === 0) {
    return criteria;
  }

  const normalized = criteria.map(c => ({
    ...c,
    percentage: Math.round((c.percentage / total) * 100 * 100) / 100, // Two decimal places
  }));

  // Fix any remaining rounding error
  const normalizedTotal = normalized.reduce((sum, c) => sum + c.percentage, 0);
  const difference = 100 - normalizedTotal;
  
  if (difference !== 0 && normalized.length > 0) {
    normalized[0].percentage += difference;
  }

  return normalized;
}

/**
 * Validate a complete SyllabusDetail object
 */
export function validateSyllabusDetail(detail: any): {
  isValid: boolean;
  data?: SyllabusDetail;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!detail.subjectName || typeof detail.subjectName !== 'string') {
    errors.push('科目名が無効です');
  }

  if (!detail.instructor || typeof detail.instructor !== 'string') {
    errors.push('担当教員が無効です');
  }

  if (typeof detail.credits !== 'number' || detail.credits < 1 || detail.credits > 10) {
    errors.push('単位数が無効です（1〜10の範囲）');
  }

  if (!['spring', 'fall', 'both'].includes(detail.term)) {
    errors.push('開講期が無効です');
  }

  if (!['lecture', 'practical', 'experiment'].includes(detail.classType)) {
    errors.push('授業種別が無効です');
  }

  // Validate evaluation criteria
  if (!Array.isArray(detail.evaluationCriteria) || detail.evaluationCriteria.length === 0) {
    errors.push('評価割合が無効です');
  } else {
    const evalValidation = validateEvaluationTotal(detail.evaluationCriteria);
    if (!evalValidation.isValid) {
      errors.push(...evalValidation.errors);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Use normalized evaluation if needed
  const evalValidation = validateEvaluationTotal(detail.evaluationCriteria);
  const evaluationCriteria = evalValidation.normalized || detail.evaluationCriteria;

  return {
    isValid: true,
    data: {
      subjectName: detail.subjectName.trim(),
      instructor: detail.instructor.trim(),
      credits: detail.credits,
      term: detail.term,
      evaluationCriteria,
      classType: detail.classType,
      description: detail.description?.trim() || undefined,
    },
    errors: [],
  };
}

/**
 * Convert validated SyllabusDetail to Subject object
 */
export function syllabusDetailToSubject(
  detail: SyllabusDetail,
  semester: 'spring' | 'fall',
  academicYear: number
): Subject {
  const classesPerSemester = detail.credits * 15;
  const absenceThreshold = detail.classType === 'experiment'
    ? Math.ceil(classesPerSemester / 10)
    : Math.floor(classesPerSemester / 3);

  const evaluationCriteria = detail.evaluationCriteria.map((e, idx) => ({
    id: `eval-${idx}`,
    name: e.name,
    weight: e.percentage,
    maxPoints: 100,
  }));

  return {
    id: `subject-${Date.now()}-${Math.random()}`,
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
}

/**
 * Cache management for syllabus data
 */
export const syllabusCache = {
  /**
   * Generate cache key for a specific school/department/grade/year
   */
  generateKey(schoolId: string, department: string, grade: number, year: number): string {
    return `syllabus_cache_${schoolId}_${department}_${grade}_${year}`;
  },

  /**
   * Save syllabus data to localStorage with expiry
   */
  save(key: string, data: SyllabusDetail[], expiryHours: number = 24): void {
    if (typeof window === 'undefined') return; // Server-side safety

    const expiryTime = Date.now() + expiryHours * 60 * 60 * 1000;
    const cacheData = {
      data,
      expiryTime,
    };

    try {
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('[v0] Failed to save syllabus cache:', error);
    }
  },

  /**
   * Retrieve cached syllabus data if valid
   */
  get(key: string): SyllabusDetail[] | null {
    if (typeof window === 'undefined') return null; // Server-side safety

    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, expiryTime } = JSON.parse(cached);
      
      // Check if cache has expired
      if (Date.now() > expiryTime) {
        localStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[v0] Failed to retrieve syllabus cache:', error);
      return null;
    }
  },

  /**
   * Clear cache for a specific key
   */
  clear(key: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[v0] Failed to clear cache:', error);
    }
  },

  /**
   * Clear all syllabus caches
   */
  clearAll(): void {
    if (typeof window === 'undefined') return;

    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('syllabus_cache_'));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('[v0] Failed to clear all caches:', error);
    }
  },
};
