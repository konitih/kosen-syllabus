'use client';

import { Subject, ClassType, EvaluationCriteria } from './types';

interface FireCrawlResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
  };
  error?: string;
}

interface ExtractedSyllabus {
  subjects: Subject[];
  errors: string[];
}

/**
 * Fetches syllabus data from KOSEN syllabus site using FireCrawl API
 * This is a client-side function that calls a server endpoint
 */
export const syllabusFetcher = {
  /**
   * Fetch syllabi for a specific KOSEN, department, grade, and semester
   */
  fetchSyllabi: async (
    schoolName: string,
    department: string,
    grade: number,
    semester: 'spring' | 'fall'
  ): Promise<ExtractedSyllabus> => {
    try {
      // Construct the URL based on KOSEN naming convention
      // This is a typical pattern for KOSEN syllabus sites
      const syllabusUrl = `https://syllabus.kosen-k.go.jp/`;

      // Call the server endpoint to fetch and parse
      const response = await fetch('/api/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          department,
          grade,
          semester,
          syllabusUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[v0] Syllabus fetch error:', error);
      return {
        subjects: [],
        errors: [
          error instanceof Error ? error.message : '不明なエラーが発生しました',
        ],
      };
    }
  },

  /**
   * Parse raw syllabus HTML/markdown to extract subject information
   */
  parseRawSyllabus: (content: string): ExtractedSyllabus => {
    const subjects: Subject[] = [];
    const errors: string[] = [];

    try {
      // Parse subject data from HTML/markdown
      // This is a placeholder implementation - actual parsing depends on HTML structure
      const subjectPattern =
        /科目名[:：]\s*([^\n]+)|授業種別[:：]\s*([^\n]+)|単位数[:：]\s*(\d+)/gi;
      const matches = Array.from(content.matchAll(subjectPattern));

      if (matches.length === 0) {
        errors.push('シラバスから科目情報を抽出できませんでした');
        return { subjects, errors };
      }

      // Group matches by subject
      let currentSubject: Partial<Subject> | null = null;

      matches.forEach((match) => {
        const [fullMatch, name, classTypeStr, credits] = match;

        if (name && !currentSubject) {
          currentSubject = {
            id: `subject-${Date.now()}-${Math.random()}`,
            name: name.trim(),
            classType: 'lecture' as ClassType,
            courseType: 'required',
            instructor: '未入力',
            credits: 1,
            passingGrade: 60,
            evaluationCriteria: [],
            grades: [],
            absences: 0,
            absenceRecords: [],
            absenceThreshold: 13,
            classesPerSemester: 30,
            semester: 'spring',
            academicYear: new Date().getFullYear(),
          };
        }

        if (classTypeStr && currentSubject) {
          const classTypeMap: { [key: string]: ClassType } = {
            '講義': 'lecture',
            'こうぎ': 'lecture',
            '演習': 'lecture',
            'えんしゅう': 'lecture',
            '実験': 'experiment',
            'じっけん': 'experiment',
            '実習': 'practical',
            'じっしゅう': 'practical',
          };
          const normalizedType = classTypeStr
            .trim()
            .split(/[・/]/)[0]
            .toLowerCase();
          currentSubject.classType = classTypeMap[normalizedType] || 'lecture';
        }

        if (credits && currentSubject) {
          currentSubject.credits = parseInt(credits);
          currentSubject.classesPerSemester = parseInt(credits) * 15; // Typically 15 weeks
          currentSubject.absenceThreshold = Math.ceil(
            currentSubject.classesPerSemester / 10
          ); // 1/10 for practical
        }

        if (currentSubject && fullMatch.includes('\n')) {
          subjects.push(currentSubject as Subject);
          currentSubject = null;
        }
      });

      if (currentSubject) {
        subjects.push(currentSubject as Subject);
      }
    } catch (error) {
      errors.push(
        `解析エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    }

    return { subjects, errors };
  },

  /**
   * Create default subjects when API fails
   */
  createDefaultSubjects: (
    grade: number,
    semester: 'spring' | 'fall'
  ): Subject[] => {
    const defaultSubjects = [
      {
        name: '国語',
        courseType: 'required' as const,
        classType: 'lecture' as const,
      },
      {
        name: '数学',
        courseType: 'required' as const,
        classType: 'lecture' as const,
      },
      {
        name: '英語',
        courseType: 'required' as const,
        classType: 'lecture' as const,
      },
      {
        name: 'プログラミング演習',
        courseType: 'required' as const,
        classType: 'practical' as const,
      },
      {
        name: '物理実験',
        courseType: 'required' as const,
        classType: 'experiment' as const,
      },
    ];

    return defaultSubjects.map((subject, index) => ({
      id: `default-subject-${index}`,
      name: subject.name,
      instructor: '未入力',
      courseType: subject.courseType,
      classType: subject.classType,
      credits: 2,
      passingGrade: 60,
      evaluationCriteria: [
        {
          id: `criteria-${index}-1`,
          name: '試験',
          weight: 70,
          maxPoints: 100,
        },
        {
          id: `criteria-${index}-2`,
          name: '課題',
          weight: 20,
          maxPoints: 100,
        },
        {
          id: `criteria-${index}-3`,
          name: '出席',
          weight: 10,
          maxPoints: 100,
        },
      ],
      grades: [],
      absences: 0,
      absenceRecords: [],
      absenceThreshold:
        subject.classType === 'experiment' ? 3 : 10,
      classesPerSemester:
        subject.classType === 'experiment' ? 30 : 30,
      semester,
      academicYear: new Date().getFullYear(),
    }));
  },
};
