'use client';

import { useState, useEffect } from 'react';
import { Subject, Grade } from '@/lib/types';
import { gradeCalculatorV2 } from '@/lib/gradeCalculatorV2';
import { storage } from '@/lib/storage';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface GradeDetailViewSheetProps {
  subject: Subject | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GradeDetailViewSheet({
  subject,
  isOpen,
  onClose,
}: GradeDetailViewSheetProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Subject | null>(subject);
  const [newGradeData, setNewGradeData] = useState({
    criteriaId: '',
    points: 0,
  });
  const [absenceInput, setAbsenceInput] = useState(0);

  // Sync formData when subject changes
  useEffect(() => {
    if (subject) {
      setFormData(subject);
      setAbsenceInput(subject.absences);
    }
  }, [subject, isOpen]);

  if (!formData) return null;

  const status = gradeCalculatorV2.getGradeStatus(formData);
  const color = gradeCalculatorV2.getIntelligentColor(status);
  const statusLabel = gradeCalculatorV2.getStatusLabel(status);
  const remainingAttendance = gradeCalculatorV2.calculateRemainingAttendance(formData);
  const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(formData);

  const criteriaAverages = formData.evaluationCriteria.map(criteria => {
    const gradesForCriteria = formData.grades.filter(g => g.criteriaId === criteria.id);
    const average =
      gradesForCriteria.length > 0
        ? gradesForCriteria.reduce((sum, g) => sum + g.points, 0) / gradesForCriteria.length
        : 0;
    const percentage = criteria.maxPoints > 0 ? (average / criteria.maxPoints) * 100 : 0;
    return {
      id: criteria.id,
      name: criteria.name,
      weight: criteria.weight,
      maxPoints: criteria.maxPoints,
      average,
      percentage,
      count: gradesForCriteria.length,
    };
  });

  const handleAddGrade = () => {
    if (!newGradeData.criteriaId || newGradeData.points < 0) {
      toast({
        title: 'エラー',
        description: 'すべてのフィールドを正しく入力してください',
        variant: 'destructive',
      });
      return;
    }

    const newGrade: Grade = {
      id: crypto.randomUUID(),
      criteriaId: newGradeData.criteriaId,
      points: newGradeData.points,
      date: new Date().toISOString().split('T')[0],
    };

    const updated = {
      ...formData,
      grades: [...formData.grades, newGrade],
    };

    setFormData(updated);
    storage.updateSubject(subject!.id, updated);
    setNewGradeData({ criteriaId: '', points: 0 });

    toast({
      title: '成功',
      description: '成績を追加しました',
    });
  };

  const handleDeleteGrade = (gradeId: string) => {
    const updated = {
      ...formData,
      grades: formData.grades.filter(g => g.id !== gradeId),
    };

    setFormData(updated);
    storage.updateSubject(subject!.id, updated);

    toast({
      title: '成功',
      description: '成績を削除しました',
    });
  };

  const handleUpdateAbsence = () => {
    const updated = {
      ...formData,
      absences: absenceInput,
    };

    setFormData(updated);
    storage.updateSubject(subject!.id, updated);

    toast({
      title: '成功',
      description: '欠席数を更新しました',
    });
  };

  // Get color class names
  const getColorClasses = () => {
    switch (color) {
      case 'red':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-600',
          header: 'bg-red-100',
        };
      case 'orange':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-700',
          icon: 'text-orange-600',
          header: 'bg-orange-100',
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-700',
          icon: 'text-blue-600',
          header: 'bg-blue-100',
        };
    }
  };

  const colors = getColorClasses();

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${color === 'red' ? 'bg-red-600' : color === 'orange' ? 'bg-orange-600' : 'bg-blue-600'}`} />
            {formData.name}
          </SheetTitle>
          <SheetDescription>
            {formData.instructor} • {formData.credits}単位 • {formData.classType === 'experiment' ? '実験' : formData.classType === 'practical' ? '実習' : '講義'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status Summary */}
          <Card className={`p-4 ${colors.bg} border ${colors.border}`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">ステータス</span>
                <span className={`font-bold text-lg ${colors.text}`}>{statusLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-slate-600">現在の成績</div>
                  <div className="text-2xl font-bold text-slate-900">{status.value}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">予測最終成績</div>
                  <div className="text-2xl font-bold text-slate-900">{status.predictedFinal}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Attendance Management */}
          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              {remainingAttendance <= 2 && (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
              出席状況管理
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">欠席数</Label>
                  <span className={`text-sm font-semibold ${
                    remainingAttendance <= 2 ? 'text-orange-600' : 
                    remainingAttendance <= 5 ? 'text-amber-600' : 
                    'text-green-600'
                  }`}>
                    残り {remainingAttendance} 回
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={absenceInput}
                    onChange={e => setAbsenceInput(parseInt(e.target.value) || 0)}
                    className="flex-1"
                  />
                  <Button onClick={handleUpdateAbsence} size="sm">
                    更新
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-sm text-slate-600 mb-2">
                  {formData.absences}/{absenceLimit} (許容上限)
                </div>
                <Progress
                  value={(formData.absences / absenceLimit) * 100}
                  className="h-2"
                />
              </div>

              {remainingAttendance <= 2 && (
                <div className="bg-orange-50 border border-orange-200 rounded p-2 text-sm text-orange-700">
                  ⚠️ 欠席可能回数があと {remainingAttendance} 回のみです。注意してください。
                </div>
              )}
            </div>
          </Card>

          {/* Grades Breakdown */}
          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-4">評価内訳</h3>
            <div className="space-y-3">
              {criteriaAverages.map(criteria => (
                <div key={criteria.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">
                      {criteria.name} ({criteria.weight}%)
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {criteria.average.toFixed(1)}/{criteria.maxPoints}
                    </span>
                  </div>
                  <Progress
                    value={criteria.percentage}
                    className="h-2"
                  />
                  <div className="text-xs text-slate-500">
                    {criteria.count}件の成績
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Add Grade Section */}
          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-4">成績を追加</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm">評価基準を選択</Label>
                <select
                  value={newGradeData.criteriaId}
                  onChange={e => setNewGradeData({ ...newGradeData, criteriaId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- 選択してください --</option>
                  {formData.evaluationCriteria.map(criteria => (
                    <option key={criteria.id} value={criteria.id}>
                      {criteria.name} (最大 {criteria.maxPoints}点)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm">得点</Label>
                <Input
                  type="number"
                  min="0"
                  value={newGradeData.points}
                  onChange={e => setNewGradeData({ ...newGradeData, points: parseInt(e.target.value) || 0 })}
                  placeholder="得点を入力"
                  className="mt-1"
                />
              </div>

              <Button onClick={handleAddGrade} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                成績を追加
              </Button>
            </div>
          </Card>

          {/* Existing Grades List */}
          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-4">登録済み成績</h3>
            {formData.grades.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                まだ成績がありません
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {formData.grades.map(grade => {
                  const criteria = formData.evaluationCriteria.find(c => c.id === grade.criteriaId);
                  return (
                    <div
                      key={grade.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm text-slate-900">
                          {criteria?.name}
                        </div>
                        <div className="text-xs text-slate-500">{grade.date}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">
                          {grade.points}/{criteria?.maxPoints}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteGrade(grade.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
