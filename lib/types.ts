// Type definitions for KOSEN grade management platform

// Course classification types
export type CourseType = 'required' | 'elective' | 'specialized' | 'general';
export type ClassType = 'lecture' | 'practical' | 'experiment'; // 講義・演習 / 実験・実習
export type SemesterType = 'spring' | 'fall';
export type AcademicYear = number; // e.g., 2024 for 2024-2025 school year

// School information for onboarding
export interface SchoolInfo {
  schoolName: string;
  department: string; // e.g., 情報工学科
  grade: number; // 1-5 for KOSEN
  semester: SemesterType;
  academicYear: AcademicYear;
}

// Absence history tracking
export interface AbsenceRecord {
  id: string;
  date: string; // ISO date
  reason?: string; // 病欠, 公欠, etc.
  approved: boolean; // whether absence was officially approved
}

export interface EvaluationCriteria {
  id: string;
  name: string;
  weight: number; // percentage, should sum to 100 per subject
  maxPoints: number;
}

export interface Grade {
  id: string;
  criteriaId: string;
  points: number;
  date: string; // ISO date
}

export interface Subject {
  id: string;
  name: string;
  instructor: string; // 担当教員
  courseType: CourseType; // 必修, 選択など
  classType: ClassType; // 講義・演習 / 実験・実習
  credits: number; // 単位数
  passingGrade: number; // 合格ライン（通常60）
  evaluationCriteria: EvaluationCriteria[];
  grades: Grade[];
  absences: number;
  absenceRecords: AbsenceRecord[]; // detailed absence history
  absenceThreshold: number; // calculated from classesPerSemester
  classesPerSemester: number; // course-specific class count
  dayOfWeek?: number; // 0-6, Monday-Sunday (optional for fetched subjects)
  period?: number; // 1-8 (typical school periods, optional for fetched subjects)
  semester: SemesterType;
  academicYear: AcademicYear;
}

export interface TimetableConfig {
  subjects: Subject[];
  periodsPerDay: number;
}

export interface AppConfig {
  schoolInfo: SchoolInfo;
  timetable: TimetableConfig;
  classesPerSemester: number; // default for absence calculation
  onboardingComplete: boolean; // track if user has completed setup
}

export interface GradeStatus {
  value: number; // calculated grade
  status: 'safe' | 'risk' | 'fail';
  predictedFinal: number;
  needsToPass: number; // points needed to pass final
  absenceWarning: boolean;
  canPass: boolean; // whether student can still pass
  gpa: number; // calculated GPA for the subject
}

export interface GPAData {
  totalGPA: number; // cumulative GPA
  semesterGPA: number; // current semester GPA
  credits: number; // total credits
  earnedCredits: number; // credits earned (passed courses)
}
