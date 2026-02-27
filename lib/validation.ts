import { z } from 'zod';

// Zod schemas for validation
export const EvaluationCriteriaSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  weight: z.number().min(0).max(100),
  maxPoints: z.number().min(1),
});

export const GradeSchema = z.object({
  id: z.string(),
  criteriaId: z.string(),
  points: z.number().min(0),
  date: z.string(),
});

export const SubjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Subject name is required'),
  evaluationCriteria: z.array(EvaluationCriteriaSchema),
  grades: z.array(GradeSchema),
  absences: z.number().min(0),
  absenceThreshold: z.number().min(0),
  dayOfWeek: z.number().min(0).max(6),
  period: z.number().min(1).max(8),
});

export const TimetableConfigSchema = z.object({
  subjects: z.array(SubjectSchema),
  periodsPerDay: z.number().min(1).max(10),
});

export const AppConfigSchema = z.object({
  timetable: TimetableConfigSchema,
  classesPerSemester: z.number().min(1),
});

// Type exports for use throughout the app
export type EvaluationCriteria = z.infer<typeof EvaluationCriteriaSchema>;
export type Grade = z.infer<typeof GradeSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type TimetableConfig = z.infer<typeof TimetableConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
