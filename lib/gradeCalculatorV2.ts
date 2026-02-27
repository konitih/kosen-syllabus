'use client';

import { Subject, GradeStatus, GPAData } from './types';

/**
 * Grade Calculator V2
 *
 * 欠席判定ルール（高専準拠）:
 *   講義・演習: 総授業時間の 1/3 以上欠席 → 即・不可
 *   実験・実習: 総授業時間の 1/10 以上欠席 → 即・不可
 *
 * ─── Step 2 変更点 ────────────────────────────────────────────────────────
 *  ❌ 旧: subject.absences > absenceLimit  （限界値は超えない限り risk）
 *  ✅ 新: subject.absences >= absenceLimit （限界値に達した瞬間に即・不可）
 *
 *  理由: 「1/3以上で不可」＝ absences が threshold に到達した時点で不可。
 *        到達した後の次の欠席を待たない。
 * ────────────────────────────────────────────────────────────────────────────
 */

export const gradeCalculatorV2 = {
  /**
   * 欠席可能上限を計算する。
   * この値を「超えた（>=）」ら即・不可。
   */
  calculateAbsenceLimit: (subject: Subject): number => {
    const classCount = subject.classesPerSemester || 40;
    if (subject.classType === 'experiment' || subject.classType === 'practical') {
      return Math.ceil(classCount / 10); // 1/10 以上で不可
    }
    return Math.floor(classCount / 3); // 1/3 以上で不可
  },

  /** 残り欠席可能数（0以下で即・不可） */
  calculateRemainingAttendance: (subject: Subject): number => {
    const limit = gradeCalculatorV2.calculateAbsenceLimit(subject);
    return limit - subject.absences; // マイナスも返す（超過分を表示するため）
  },

  calculateSubjectGrade: (subject: Subject): number => {
    if (subject.evaluationCriteria.length === 0 || subject.grades.length === 0) return 0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const criteria of subject.evaluationCriteria) {
      const criteriaGrades = subject.grades.filter(g => g.criteriaId === criteria.id);
      if (criteriaGrades.length === 0) continue;

      const avgPoints =
        criteriaGrades.reduce((sum, g) => sum + g.points, 0) / criteriaGrades.length;
      const percentScore = (avgPoints / criteria.maxPoints) * 100;
      totalWeightedScore += percentScore * criteria.weight;
      totalWeight += criteria.weight;
    }

    return totalWeight === 0 ? 0 : Math.round(totalWeightedScore / totalWeight);
  },

  predictFinalGrade: (
    subject: Subject,
    continuousGrade: number = 0,
    finalExamWeight: number = 0.4
  ): number => {
    if (continuousGrade === 0 || isNaN(continuousGrade)) return 0;
    const predicted = continuousGrade * (1 - finalExamWeight) + finalExamWeight * 100;
    return isNaN(predicted) ? 0 : Math.round(predicted);
  },

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

  canStillPass: (subject: Subject): boolean => {
    const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(subject);
    // ✅ >= に変更: 限界値に達した時点で不可
    if (subject.absences >= absenceLimit) return false;

    const currentGrade = gradeCalculatorV2.calculateSubjectGrade(subject);
    if (currentGrade >= subject.passingGrade) return true;

    const needsToPass = gradeCalculatorV2.pointsNeededToPass(subject, subject.passingGrade);
    return needsToPass <= 100;
  },

  calculateSubjectGPA: (subject: Subject): number => {
    const grade = gradeCalculatorV2.calculateSubjectGrade(subject);
    if (grade >= 90) return 4.0;
    if (grade >= 80) return 3.0;
    if (grade >= 70) return 2.0;
    if (grade >= 60) return 1.0;
    return 0.0;
  },

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
      earnedCredits,
    };
  },

  getGradeStatus: (subject: Subject): GradeStatus => {
    const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(subject);
    const remaining = gradeCalculatorV2.calculateRemainingAttendance(subject);
    const currentGrade = gradeCalculatorV2.calculateSubjectGrade(subject);
    const predictedFinal = gradeCalculatorV2.predictFinalGrade(subject, currentGrade);
    const needsToPass = gradeCalculatorV2.pointsNeededToPass(subject, subject.passingGrade);
    const canPass = gradeCalculatorV2.canStillPass(subject);
    const gpa = gradeCalculatorV2.calculateSubjectGPA(subject);

    // ✅ Step 2: 欠席が上限に達したら即・不可（>=）
    const absenceExceeded = subject.absences >= absenceLimit;

    let status: 'safe' | 'risk' | 'fail';

    if (absenceExceeded) {
      // 欠席超過 → 即・不可
      status = 'fail';
    } else if (remaining <= 2) {
      // 残り2回以下 → 危険
      status = 'risk';
    } else if (!canPass) {
      // 数学的に合格不可
      status = 'fail';
    } else if (currentGrade >= 60) {
      status = 'safe';
    } else if (currentGrade >= 30) {
      status = 'risk';
    } else {
      status = 'fail';
    }

    return {
      value: isNaN(currentGrade) ? 0 : currentGrade,
      status,
      predictedFinal: isNaN(predictedFinal) ? 0 : predictedFinal,
      needsToPass: isNaN(needsToPass) ? 0 : needsToPass,
      absenceWarning: absenceExceeded, // 不可レベルの欠席かどうか
      canPass,
      gpa,
    };
  },

  getIntelligentColor: (status: GradeStatus): 'blue' | 'orange' | 'red' => {
    if (status.status === 'fail') return 'red';
    if (status.status === 'risk') return 'orange';
    return 'blue';
  },

  getStatusLabel: (status: GradeStatus): string => {
    if (status.status === 'fail') return '不可';
    if (status.status === 'risk') return '危険';
    return '安全';
  },
};
