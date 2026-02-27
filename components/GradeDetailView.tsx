'use client';

import { useState } from 'react';
import { Subject, Grade } from '@/lib/types';
import { gradeCalculator } from '@/lib/gradeCalculator';
import { storage } from '@/lib/storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GradeDetailViewProps {
  subject: Subject | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function GradeDetailView({ subject, isOpen, onClose, onSave }: GradeDetailViewProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Subject | null>(subject);
  const [newGradeData, setNewGradeData] = useState({
    criteriaId: '',
    points: 0,
  });

  if (!formData) return null;

  const status = gradeCalculator.getGradeStatus(formData);
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
    onSave();
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
    onSave();
  };

  const attendance = gradeCalculator.attendancePercentage(formData);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formData.name} - 成績詳細</DialogTitle>
          <DialogDescription>
            成績、評価基準、および出席状況を確認・編集できます
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="criteria">評価基準</TabsTrigger>
            <TabsTrigger value="all-grades">すべての成績</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className={`p-4 ${
                status.status === 'safe' ? 'bg-blue-50 border-blue-200' :
                status.status === 'risk' ? 'bg-orange-50 border-orange-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="text-sm text-slate-600">現在の成績</div>
                <div className={`text-3xl font-bold ${
                  status.status === 'safe' ? 'text-blue-700' :
                  status.status === 'risk' ? 'text-orange-700' :
                  'text-red-700'
                }`}>
                  {isNaN(status.value) ? 0 : status.value}
                </div>
                <div className="text-xs text-slate-600 mt-2">
                  ステータス: <span className="font-semibold">{status.status === 'safe' ? '安全' : status.status === 'risk' ? 'リスク' : '不可'}</span>
                </div>
              </Card>

              <Card className="p-4 bg-slate-50">
                <div className="text-sm text-slate-600">予測最終成績</div>
                <div className="text-3xl font-bold text-slate-700">{isNaN(status.predictedFinal) ? 0 : status.predictedFinal}</div>
                <div className="text-xs text-slate-600 mt-2">
                  (最終テストで100%の場合)
                </div>
              </Card>

              <Card className="p-4 bg-slate-50">
                <div className="text-sm text-slate-600">合格に必要な点数</div>
                <div className="text-3xl font-bold text-slate-700">{isNaN(status.needsToPass) ? 0 : status.needsToPass}</div>
                <div className="text-xs text-slate-600 mt-2">
                  最終試験での点数 (満点100)
                </div>
              </Card>

              <Card className="p-4 bg-slate-50">
                <div className="text-sm text-slate-600">出席率</div>
                <div className="text-3xl font-bold text-slate-700">{attendance}%</div>
                <div className="text-xs text-slate-600 mt-2">
                  欠席: {formData.absences}回
                  {status.absenceWarning && <span className="text-red-600"> ⚠️</span>}
                </div>
              </Card>
            </div>

            {status.absenceWarning && (
              <Card className="p-3 bg-red-50 border-red-200">
                <div className="text-sm text-red-800">
                  <strong>欠席警告:</strong> 欠席上限を超えました!
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Criteria Tab */}
          <TabsContent value="criteria" className="space-y-4">
            <div className="space-y-3">
              {criteriaAverages.map(criteria => (
                <Card key={criteria.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-slate-900">{criteria.name}</div>
                        <div className="text-xs text-slate-600">
                          ウェイト: {criteria.weight}% • {criteria.count}件の成績
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-700">
                          {criteria.average.toFixed(1)} / {criteria.maxPoints}
                        </div>
                        <div className="text-sm text-slate-600">{criteria.percentage.toFixed(0)}%</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, criteria.percentage)}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* All Grades Tab */}
          <TabsContent value="all-grades" className="space-y-4">
            {/* Add Grade Form */}
            <Card className="p-4 bg-slate-50">
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">新しい成績を追加</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">評価基準</Label>
                    <select
                      value={newGradeData.criteriaId}
                      onChange={e => setNewGradeData({ ...newGradeData, criteriaId: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                    >
                      <option value="">基準を選択</option>
                      {formData.evaluationCriteria.map(criteria => (
                        <option key={criteria.id} value={criteria.id}>
                          {criteria.name} (満点 {criteria.maxPoints})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">得点</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newGradeData.points}
                      onChange={e => setNewGradeData({ ...newGradeData, points: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button onClick={handleAddGrade} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  成績を追加
                </Button>
              </div>
            </Card>

            {/* Grades List */}
            {formData.grades.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                まだ成績がありません。上記から追加してください!
              </div>
            ) : (
              <div className="space-y-2">
                {[...formData.grades].reverse().map(grade => {
                  const criteria = formData.evaluationCriteria.find(c => c.id === grade.criteriaId);
                  const [isEditing, setIsEditing] = useState(false);
                  const [editedPoints, setEditedPoints] = useState(grade.points);
                  
                  const handleEditGrade = () => {
                    const updated = {
                      ...formData,
                      grades: formData.grades.map(g => 
                        g.id === grade.id ? { ...g, points: editedPoints } : g
                      ),
                    };
                    setFormData(updated);
                    storage.updateSubject(subject!.id, updated);
                    setIsEditing(false);
                    onSave();
                  };
                  
                  return (
                    <Card key={grade.id} className="p-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-slate-900">{criteria?.name}</div>
                            <div className="text-xs text-slate-600">{grade.date}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max={criteria?.maxPoints}
                              value={editedPoints}
                              onChange={e => setEditedPoints(parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                            <span className="text-sm">/ {criteria?.maxPoints}</span>
                            <Button
                              size="sm"
                              onClick={handleEditGrade}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditing(false)}
                            >
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold text-sm text-slate-900">{criteria?.name}</div>
                            <div className="text-xs text-slate-600">{grade.date}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-slate-700">
                              {grade.points} / {criteria?.maxPoints}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditing(true)}
                            >
                              編集
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteGrade(grade.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={onClose}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
