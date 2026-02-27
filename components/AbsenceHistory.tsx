'use client';

import { Subject } from '@/lib/types';
import { gradeCalculatorV2 } from '@/lib/gradeCalculator';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2, CheckCircle } from 'lucide-react';
import { storage } from '@/lib/storage';

interface AbsenceHistoryProps {
  subject: Subject;
  onUpdate: () => void;
}

export function AbsenceHistory({ subject, onUpdate }: AbsenceHistoryProps) {
  const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(subject);
  const absencePercentage = Math.min(
    100,
    Math.round((subject.absences / absenceLimit) * 100)
  );
  const isOverLimit = subject.absences > absenceLimit;

  const handleRemoveAbsence = (recordId: string) => {
    const updated = {
      ...subject,
      absenceRecords: subject.absenceRecords?.filter(r => r.id !== recordId) || [],
      absences: Math.max(0, (subject.absences || 0) - 1),
    };
    storage.updateSubject(subject.id, updated);
    onUpdate();
  };

  const handleApproveAbsence = (recordId: string) => {
    const updated = {
      ...subject,
      absenceRecords:
        subject.absenceRecords?.map(r =>
          r.id === recordId ? { ...r, approved: !r.approved } : r
        ) || [],
    };
    storage.updateSubject(subject.id, updated);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      {/* Absence Summary */}
      <Card className="p-4 bg-slate-50">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm font-medium text-slate-600">欠席状況</div>
              <div className="text-3xl font-bold text-slate-900 mt-1">
                {subject.absences} / {absenceLimit}
              </div>
            </div>
            <div className={`text-center p-4 rounded-lg ${
              isOverLimit
                ? 'bg-red-100 border-2 border-red-500'
                : absencePercentage > 70
                ? 'bg-orange-100 border border-orange-300'
                : 'bg-blue-100 border border-blue-300'
            }`}>
              <div className="text-sm font-medium">
                {isOverLimit ? '上限超過' : '上限まで'}
              </div>
              <div className="text-2xl font-bold mt-1">
                {absencePercentage}%
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isOverLimit
                  ? 'bg-red-500'
                  : absencePercentage > 70
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, absencePercentage)}%` }}
            />
          </div>

          {/* Warning message */}
          {isOverLimit && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                <div className="font-semibold">欠席上限を超えています</div>
                <div>この教科の単位取得が危機的状況です</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Absence Records */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-3">欠席記録</h3>
        {subject.absenceRecords && subject.absenceRecords.length > 0 ? (
          <div className="space-y-2">
            {subject.absenceRecords.map(record => (
              <Card
                key={record.id}
                className={`p-3 flex items-center justify-between ${
                  record.approved ? 'bg-green-50 border-green-200' : 'bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {record.approved && (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {record.date}
                    </div>
                    {record.reason && (
                      <div className="text-xs text-slate-600">
                        {record.reason === '病欠' && '病気のため'}
                        {record.reason === '公欠' && '公式な欠席'}
                        {record.reason === '遅刻' && '遅刻'}
                        {!['病欠', '公欠', '遅刻'].includes(record.reason) &&
                          record.reason}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApproveAbsence(record.id)}
                    className="text-xs"
                  >
                    {record.approved ? '未認可' : '認可'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAbsence(record.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center bg-blue-50 border-blue-200">
            <div className="text-sm text-blue-700">
              欠席がありません
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
