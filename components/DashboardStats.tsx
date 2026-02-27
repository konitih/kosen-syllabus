'use client';

import { Subject } from '@/lib/types';
import { gradeCalculatorV2 } from '@/lib/gradeCalculatorV2';
import { AlertCircle, CheckCircle, TrendingUp, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface DashboardStatsProps {
  subjects: Subject[];
}

export function DashboardStats({ subjects }: DashboardStatsProps) {
  const stats = subjects.map(subject => ({
    subject,
    status: gradeCalculatorV2.getGradeStatus(subject),
  }));

  const safeCount = stats.filter(s => s.status.status === 'safe').length;
  const riskCount = stats.filter(s => s.status.status === 'risk').length;
  const failCount = stats.filter(s => s.status.status === 'fail').length;

  const avgGrade =
    stats.length > 0
      ? Math.round(stats.reduce((sum, s) => sum + s.status.value, 0) / stats.length)
      : 0;

  const subjectsWithWarnings = stats.filter(s => s.status.absenceWarning).length;
  
  // Calculate GPA
  const gpaData = gradeCalculatorV2.calculateGPA(subjects);
  const displayGPA = gpaData.totalGPA.toFixed(2);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6 mb-6">
      {/* GPA Card */}
      <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
        <div className="flex flex-col items-center gap-2">
          <Award className="w-6 h-6 text-purple-600" />
          <div className="text-2xl font-bold text-purple-700">{displayGPA}</div>
          <div className="text-xs text-purple-600 text-center">GPA</div>
        </div>
      </Card>

      {/* Average Grade */}
      <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-2">
          <div className="text-2xl font-bold text-slate-700">{avgGrade}</div>
          <div className="text-xs text-slate-600 text-center">平均成績</div>
        </div>
      </Card>

      {/* Safe Subjects */}
      <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
        <div className="flex flex-col items-center gap-2">
          <CheckCircle className="w-6 h-6 text-blue-600" />
          <div className="text-2xl font-bold text-blue-700">{safeCount}</div>
          <div className="text-xs text-blue-600 text-center">安全</div>
        </div>
      </Card>

      {/* Risk Subjects */}
      <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="w-6 h-6 text-orange-600" />
          <div className="text-2xl font-bold text-orange-700">{riskCount}</div>
          <div className="text-xs text-orange-600 text-center">リスク</div>
        </div>
      </Card>

      {/* Fail Subjects */}
      <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div className="text-2xl font-bold text-red-700">{failCount}</div>
          <div className="text-xs text-red-600 text-center">不可</div>
        </div>
      </Card>

      {/* Absence Warnings */}
      <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
        <div className="flex flex-col items-center gap-2">
          <TrendingUp className="w-6 h-6 text-amber-600" />
          <div className="text-2xl font-bold text-amber-700">{subjectsWithWarnings}</div>
          <div className="text-xs text-amber-600 text-center">欠席注意</div>
        </div>
      </Card>
    </div>
  );
}
