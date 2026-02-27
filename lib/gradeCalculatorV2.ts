'use client';

import { Subject, GradeStatus, GPAData, CourseType } from './types';

/**
 * Enhanced Grade Calculator V2 with:
 * - Intelligent absence limit calculation
 * - GPA computation
 * - Course classification handling
 * - Failure prevention logic
 */

export const gradeCalculatorV2 = {
  // Calculate absolute absence limit based on class type and total classes (KOSEN-specific)
  calculateAbsenceLimit: (subject: Subject): number => {
    const classCount = subject.classesPerSemester || 40;
    
    // KOSEN strict rules: Different thresholds per class type
    if (subject.classType === 'experiment') {
      // 実験・実習: 1/10 で不可
      return Math.ceil(classCount / 10);
    } else if (subject.classType === 'practical') {
      // 実習: 1/10 で不可
      return Math.ceil(classCount / 10);
    } else {
      // 講義・演習: 1/3 で不可
      return Math.floor(classCount / 3);
    }
  },

  // Calculate remaining attendance allowed (for alert purposes)
  calculateRemainingAttendance: (subject: Subject): number => {
    const limit = gradeCalculatorV2.calculateAbsenceLimit(subject);
    return Math.max(0, limit - subject.absences);
  },

  // Calculate subject grade from evaluation criteria
  calculateSubjectGrade: (subject: Subject): number => {
    if (subject.evaluationCriteria.length === 0 || subject.grades.length === 0) {
      return 0;
    }

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const criteria of subject.evaluationCriteria) {
      const criteriaGrades = subject.grades.filter(g => g.criteriaId === criteria.id);
      if (criteriaGrades.length === 0) continue;

      const avgPoints = criteriaGrades.reduce((sum, g) => sum + g.points, 0) / criteriaGrades.length;
      const percentScore = (avgPoints / criteria.maxPoints) * 100;
      totalWeightedScore += percentScore * criteria.weight;
      totalWeight += criteria.weight;
    }

    return totalWeight === 0 ? 0 : Math.round(totalWeightedScore / totalWeight);
  },

  // Predict final grade assuming perfect score on final exam
  predictFinalGrade: (
    subject: Subject,
    continuousGrade: number = 0,
    finalExamWeight: number = 0.4
  ): number => {
    if (continuousGrade === 0 || isNaN(continuousGrade)) return 0;
    const predicted = continuousGrade * (1 - finalExamWeight) + finalExamWeight * 100;
    return isNaN(predicted) ? 0 : Math.round(predicted);
  },

  // Points needed in final exam to pass
  pointsNeededToPass: (
    subject: Subject,
    passingGrade: number = 60,
    finalExamWeight: number = 0.4
  ): number => {
    const continuousGrade = gradeCalculatorV2.calculateSubjectGrade(subject);
    
    if (continuousGrade >= passingGrade || continuousGrade === 0) return 0;
    
    const neededFromFinal =
      (passingGrade - continuousGrade * (1 - finalExamWeight)) / finalExamWeight;

    const result = Math.ceil(Math.max(0, neededFromFinal));
    return isNaN(result) ? 0 : result;
  },

  // Check if student can still pass based on absences and grades
  canStillPass: (subject: Subject): boolean => {
    const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(subject);
    const currentGrade = gradeCalculatorV2.calculateSubjectGrade(subject);
    
    // Cannot pass if exceeded absence limit
    if (subject.absences > absenceLimit) {
      return false;
    }
    
    // Can pass if current grade is already passing
    if (currentGrade >= subject.passingGrade) {
      return true;
    }
    
    // Check if points needed to pass is achievable
    const needsToPass = gradeCalculatorV2.pointsNeededToPass(subject, subject.passingGrade);
    return needsToPass <= 100;
  },

  // Calculate GPA for a single subject (4.0 scale)
  calculateSubjectGPA: (subject: Subject): number => {
    const grade = gradeCalculatorV2.calculateSubjectGrade(subject);
    
    if (grade >= 90) return 4.0;
    if (grade >= 80) return 3.0;
    if (grade >= 70) return 2.0;
    if (grade >= 60) return 1.0;
    return 0.0; // Failed
  },

  // Calculate overall GPA data for display
  calculateGPA: (subjects: Subject[]): GPAData => {
    let totalPoints = 0;
    let earnedPoints = 0;
    let totalCredits = 0;
    let earnedCredits = 0;

    for (const subject of subjects) {
      const gpa = gradeCalculatorV2.calculateSubjectGPA(subject);
      const credits = subject.credits || 1;
      
      totalPoints += gpa * credits;
      totalCredits += credits;
      
      if (gpa > 0) {
        earnedPoints += gpa * credits;
        earnedCredits += credits;
      }
    }

    return {
      totalGPA: totalCredits === 0 ? 0 : totalPoints / totalCredits,
      semesterGPA: earnedCredits === 0 ? 0 : earnedPoints / earnedCredits,
      credits: totalCredits,
      earnedCredits: earnedCredits,
    };
  },

  // Get comprehensive grade status
  getGradeStatus: (subject: Subject): GradeStatus => {
    const currentGrade = gradeCalculatorV2.calculateSubjectGrade(subject);
    const predictedFinal = gradeCalculatorV2.predictFinalGrade(subject, currentGrade);
    const needsToPass = gradeCalculatorV2.pointsNeededToPass(subject, subject.passingGrade);
    const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(subject);
    const remainingAttendance = gradeCalculatorV2.calculateRemainingAttendance(subject);
    const hasAbsenceWarning = subject.absences > absenceLimit; // 不可 status
    const canPass = gradeCalculatorV2.canStillPass(subject);
    const gpa = gradeCalculatorV2.calculateSubjectGPA(subject);

    let status: 'safe' | 'risk' | 'fail';

    if (subject.absences > absenceLimit) {
      // 不可: Already exceeded absence limit
      status = 'fail';
    } else if (remainingAttendance <= 2) {
      // Danger: Only 2 or fewer absences remaining
      status = 'risk';
    } else if (!canPass) {
      // Failed due to impossible grade
      status = 'fail';
    } else if (currentGrade >= 60) {
      // Safe zone
      status = 'safe';
    } else if (currentGrade >= 30) {
      // At risk but still possible to pass
      status = 'risk';
    } else {
      // Mathematically impossible
      status = 'fail';
    }

    return {
      value: isNaN(currentGrade) ? 0 : currentGrade,
      status,
      predictedFinal: isNaN(predictedFinal) ? 0 : predictedFinal,
      needsToPass: isNaN(needsToPass) ? 0 : needsToPass,
      absenceWarning: hasAbsenceWarning,
      canPass,
      gpa,
    };
  },

  // Get intelligent color based on status and absences
  getIntelligentColor: (status: GradeStatus): 'blue' | 'orange' | 'red' => {
    if (status.status === 'fail') {
      // 不可: Red alert
      return 'red';
    } else if (status.status === 'risk') {
      // 危険: Orange warning
      return 'orange';
    }
    // 安全: Blue safe
    return 'blue';
  },

  // Get human-readable status label in Japanese
  getStatusLabel: (status: GradeStatus): string => {
    if (status.status === 'fail') return '不可';
    if (status.status === 'risk') return '危険';
    return '安全';
  },
};
