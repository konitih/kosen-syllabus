'use client';

import { useState } from 'react';
import { Subject, EvaluationCriteria, Grade } from '@/lib/types';
import { storage } from '@/lib/storage';
import { gradeCalculator } from '@/lib/gradeCalculator';
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
import { Trash2, Plus, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SubjectModalProps {
  subject: Subject | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  defaultDayOfWeek?: number;
  defaultPeriod?: number;
}

export function SubjectModal({ subject, isOpen, onClose, onSave, defaultDayOfWeek, defaultPeriod }: SubjectModalProps) {
  const { toast } = useToast();
  const config = storage.getConfig();
  const [formData, setFormData] = useState<Subject>(
    subject || {
      id: crypto.randomUUID(),
      name: '',
      instructor: '',
      courseType: 'required',
      classType: 'lecture',
      credits: 1,
      passingGrade: 60,
      evaluationCriteria: [
        { id: crypto.randomUUID(), name: '出席', weight: 10, maxPoints: 100 },
        { id: crypto.randomUUID(), name: '課題', weight: 20, maxPoints: 100 },
        { id: crypto.randomUUID(), name: '中間テスト', weight: 30, maxPoints: 100 },
        { id: crypto.randomUUID(), name: '最終テスト', weight: 40, maxPoints: 100 },
      ],
      grades: [],
      absenceRecords: [],
      absences: 0,
      absenceThreshold: Math.floor(config.classesPerSemester / 3),
      classesPerSemester: config.classesPerSemester,
      dayOfWeek: defaultDayOfWeek ?? 0,
      period: defaultPeriod ?? 1,
      semester: config.schoolInfo.semester,
      academicYear: config.schoolInfo.academicYear,
    }
  );

  const handleSave = () => {
    // Validate weights sum to 100
    const totalWeight = formData.evaluationCriteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight !== 100) {
      toast({
        title: 'エラー',
        description: `ウェイトの合計が100%である必要があります。現在は ${totalWeight}%です`,
        variant: 'destructive',
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: 'エラー',
        description: '教科名は必須です',
        variant: 'destructive',
      });
      return;
    }

    if (subject) {
      storage.updateSubject(subject.id, formData);
    } else {
      storage.addSubject(formData);
    }

    toast({
      title: '成功',
      description: subject ? '教科を更新しました' : '教科を追加しました',
    });

    onSave();
    onClose();
  };

  const handleDelete = () => {
    if (subject && confirm('この教科を削除してもよろしいですか?')) {
      storage.deleteSubject(subject.id);
      toast({
        title: '成功',
        description: '教科を削除しました',
      });
      onSave();
      onClose();
    }
  };

  const status = formData.evaluationCriteria.length > 0
    ? gradeCalculator.getGradeStatus(formData)
    : { value: 0, status: 'safe', predictedFinal: 0, needsToPass: 0, absenceWarning: false };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subject ? '教科を編集' : '新しい教科を追加'}</DialogTitle>
          <DialogDescription>
            {subject ? '教科の情報を編集します' : '新しい教科の情報を入力してください'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">基本情報</TabsTrigger>
            <TabsTrigger value="criteria">評価基準</TabsTrigger>
            <TabsTrigger value="grades">成績</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4">
            <div>
              <Label>教科名</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: 数学"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>授業種別</Label>
                <select
                  value={formData.classType}
                  onChange={e => {
                    const classType = e.target.value as 'lecture' | 'practical' | 'experiment';
                    // Auto-adjust absence threshold based on class type
                    const newThreshold =
                      classType === 'experiment'
                        ? Math.ceil(formData.classesPerSemester / 10)
                        : Math.floor(formData.classesPerSemester / 3);
                    setFormData({
                      ...formData,
                      classType,
                      absenceThreshold: newThreshold,
                    });
                  }}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="lecture">講義・演習</option>
                  <option value="practical">実習</option>
                  <option value="experiment">実験</option>
                </select>
              </div>
              <div>
                <Label>単位数</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.credits}
                  onChange={e => {
                    const credits = parseInt(e.target.value) || 1;
                    setFormData({
                      ...formData,
                      credits,
                      classesPerSemester: credits * 15,
                    });
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>曜日 (0=月曜, 4=金曜)</Label>
                <Input
                  type="number"
                  min="0"
                  max="4"
                  value={formData.dayOfWeek}
                  onChange={e =>
                    setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>時間割 (1-8)</Label>
                <Input
                  type="number"
                  min="1"
                  max="8"
                  value={formData.period}
                  onChange={e =>
                    setFormData({ ...formData, period: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>欠席数</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.absences}
                  onChange={e =>
                    setFormData({ ...formData, absences: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>欠席可能上限</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.absenceThreshold}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      absenceThreshold: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>


          </TabsContent>

          {/* Evaluation Criteria Tab */}
          <TabsContent value="criteria" className="space-y-4">
            <div className="space-y-3">
              {formData.evaluationCriteria.map((criteria, idx) => (
                <Card key={criteria.id} className="p-4">
                  <div className="grid grid-cols-3 gap-3 items-end">
                    <div>
                      <Label className="text-xs">評価基準</Label>
                      <Input
                        value={criteria.name}
                        onChange={e => {
                          const newCriteria = [...formData.evaluationCriteria];
                          newCriteria[idx].name = e.target.value;
                          setFormData({ ...formData, evaluationCriteria: newCriteria });
                        }}
                        placeholder="例: 出席"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">ウェイト %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.weight}
                        onChange={e => {
                          const newCriteria = [...formData.evaluationCriteria];
                          newCriteria[idx].weight = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, evaluationCriteria: newCriteria });
                        }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">最大得点</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={criteria.maxPoints}
                          onChange={e => {
                            const newCriteria = [...formData.evaluationCriteria];
                            newCriteria[idx].maxPoints = parseInt(e.target.value) || 1;
                            setFormData({ ...formData, evaluationCriteria: newCriteria });
                          }}
                          className="mt-1 flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newCriteria = formData.evaluationCriteria.filter(
                              (_, i) => i !== idx
                            );
                            setFormData({ ...formData, evaluationCriteria: newCriteria });
                          }}
                          className="mt-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => {
                const newCriteria: EvaluationCriteria = {
                  id: crypto.randomUUID(),
                  name: '新しい評価基準',
                  weight: 0,
                  maxPoints: 100,
                };
                setFormData({
                  ...formData,
                  evaluationCriteria: [...formData.evaluationCriteria, newCriteria],
                });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              評価基準を追加
            </Button>

            <div className="text-xs text-slate-600">
              ウェイト合計: {formData.evaluationCriteria.reduce((sum, c) => sum + c.weight, 0)}%
            </div>
          </TabsContent>

          {/* Grades Tab */}
          <TabsContent value="grades" className="space-y-4">
            {formData.grades.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                まだ成績がありません。詳細ビューから成績を追加してください。
              </div>
            ) : (
              <div className="space-y-3">
                {formData.grades.map(grade => {
                  const criteria = formData.evaluationCriteria.find(c => c.id === grade.criteriaId);
                  return (
                    <Card key={grade.id} className="p-3">
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{criteria?.name}</div>
                          <div className="text-xs text-slate-600">{grade.date}</div>
                        </div>
                        <div className="text-lg font-bold text-slate-700">
                          {grade.points} / {criteria?.maxPoints}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newGrades = formData.grades.filter(g => g.id !== grade.id);
                            setFormData({ ...formData, grades: newGrades });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Status Preview */}
        <Card className="p-3 bg-slate-50">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-sm font-semibold text-slate-700">{isNaN(status.value) ? 0 : status.value}</div>
              <div className="text-xs text-slate-600">現在</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">{isNaN(status.predictedFinal) ? 0 : status.predictedFinal}</div>
              <div className="text-xs text-slate-600">予測</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">{isNaN(status.needsToPass) ? 0 : status.needsToPass}</div>
              <div className="text-xs text-slate-600">必要点 (最終)</div>
            </div>
            <div>
              <div className={`text-sm font-semibold ${
                status.status === 'safe' ? 'text-blue-700' :
                status.status === 'risk' ? 'text-orange-700' :
                'text-red-700'
              }`}>
                {status.status === 'safe' ? '安全' : status.status === 'risk' ? 'リスク' : '不可'}
              </div>
              <div className="text-xs text-slate-600">ステータス</div>
            </div>
          </div>
        </Card>

        <DialogFooter className="flex gap-2 justify-between">
          {subject && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              削除
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>
              {subject ? '更新' : '追加'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
