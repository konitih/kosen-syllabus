// Type definitions for KOSEN grade management platform

// Course classification types
export type CourseType = 'required' | 'elective' | 'specialized' | 'general';
export type ClassType = 'lecture' | 'practical' | 'experiment';
export type SemesterType = 'spring' | 'fall';
export type AcademicYear = number;

// School information for onboarding
export interface SchoolInfo {
  schoolName: string;
  department: string;
  grade: number; // 1-5
  semester: SemesterType;
  academicYear: AcademicYear; // 内部自動設定、UIには表示しない
}

// Absence history tracking
export interface AbsenceRecord {
  id: string;
  date: string; // ISO date
  reason?: string;
  approved: boolean;
}

export interface EvaluationCriteria {
  id: string;
  name: string;
  weight: number; // percentage, should sum to 100
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
  instructor: string;
  courseType: CourseType;
  classType: ClassType;
  credits: number;
  passingGrade: number;
  evaluationCriteria: EvaluationCriteria[];
  grades: Grade[];
  absences: number;
  absenceRecords: AbsenceRecord[];
  absenceThreshold: number;
  classesPerSemester: number;
  dayOfWeek?: number; // 0=月〜4=金（時間割配置後に設定）
  period?: number;    // 1〜8（時間割配置後に設定）
  semester: SemesterType;
  academicYear: AcademicYear;
}

// ─── 科目プール（スクレイプ結果の在庫） ─────────────────────────────────────
// スクレイピングで取得した全科目。時間割に配置するまではここに保管。
export interface SubjectPoolEntry {
  subject: Subject;
  sourceSchoolId: string;   // スクレイプ元の school_id
  sourceDepartment: string; // スクレイプ元の学科名
  addedAt: string;          // ISO date
}

export interface TimetableConfig {
  subjects: Subject[]; // 時間割に配置済みの科目のみ（dayOfWeek/period 必須）
  periodsPerDay: number;
}

export interface AppConfig {
  schoolInfo: SchoolInfo;
  timetable: TimetableConfig;
  classesPerSemester: number;
  onboardingComplete: boolean;
}

export interface GradeStatus {
  value: number;
  status: 'safe' | 'risk' | 'fail';
  predictedFinal: number;
  needsToPass: number;
  absenceWarning: boolean;
  canPass: boolean;
  gpa: number;
}

export interface GPAData {
  totalGPA: number;
  semesterGPA: number;
  credits: number;
  earnedCredits: number;
}
