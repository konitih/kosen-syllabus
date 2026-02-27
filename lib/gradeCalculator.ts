import { Subject, GradeStatus } from './types';

export const gradeCalculator = {
  // Calculate weighted average for a subject
  calculateSubjectGrade: (subject: Subject): number => {
    if (subject.evaluationCriteria.length === 0) return 0;

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const criteria of subject.evaluationCriteria) {
      const gradesForCriteria = subject.grades.filter(
        g => g.criteriaId === criteria.id
      );

      if (gradesForCriteria.length === 0) continue;

      const average =
        gradesForCriteria.reduce((sum, g) => sum + g.points, 0) /
        gradesForCriteria.length;

      // Convert to 0-100 scale based on max points
      const normalizedScore = (average / criteria.maxPoints) * 100;

      totalWeightedScore += normalizedScore * (criteria.weight / 100);
      totalWeight += criteria.weight;
    }

    // Only return if we have weighted grades
    if (totalWeight === 0) return 0;
    
    return Math.round(totalWeightedScore);
  },

  // Predict final grade if final exam is taken
  predictFinalGrade: (
    subject: Subject,
    continuousGrade: number = 0,
    finalExamWeight: number = 0.4 // Final exam is typically 40% of final grade
  ): number => {
    if (continuousGrade === 0 || isNaN(continuousGrade)) return 0;
    const predicted = continuousGrade * (1 - finalExamWeight) + finalExamWeight * 100;
    return isNaN(predicted) ? 0 : Math.round(predicted);
  },

  // Calculate points needed in final exam to pass
  pointsNeededToPass: (
    subject: Subject,
    passingGrade: number = 60,
    finalExamWeight: number = 0.4
  ): number => {
    const continuousGrade = gradeCalculator.calculateSubjectGrade(subject);
    
    if (continuousGrade >= passingGrade || continuousGrade === 0) return 0; // Already passing or no grades yet
    
    const neededFromFinal =
      (passingGrade - continuousGrade * (1 - finalExamWeight)) /
      finalExamWeight;

    const result = Math.ceil(Math.max(0, neededFromFinal));
    return isNaN(result) ? 0 : result;
  },

  // Get color-coded status
  getGradeStatus: (subject: Subject): GradeStatus => {
    const currentGrade = gradeCalculator.calculateSubjectGrade(subject);
    const predictedFinal = gradeCalculator.predictFinalGrade(subject, currentGrade);
    const needsToPass = gradeCalculator.pointsNeededToPass(subject);
    
    // Check absence warning (more than 1/3 of classes)
    const absenceThreshold = subject.absenceThreshold || Math.floor(subject.absenceThreshold);
    const hasAbsenceWarning = subject.absences > absenceThreshold;

    let status: 'safe' | 'risk' | 'fail';

    if (currentGrade >= 60) {
      status = 'safe'; // Blue
    } else if (currentGrade >= 30) {
      status = 'risk'; // Cyan to red gradient
    } else {
      status = 'fail'; // Black - mathematically impossible to pass
    }

    return {
      value: isNaN(currentGrade) ? 0 : currentGrade,
      status,
      predictedFinal: isNaN(predictedFinal) ? 0 : predictedFinal,
      needsToPass: isNaN(needsToPass) ? 0 : needsToPass,
      absenceWarning: hasAbsenceWarning,
    };
  },

  // Calculate percentage of classes attended
  attendancePercentage: (subject: Subject): number => {
    const totalClasses = subject.absenceThreshold * 3; // threshold is 1/3
    const attended = Math.max(0, totalClasses - subject.absences);
    return Math.round((attended / totalClasses) * 100);
  },
};
