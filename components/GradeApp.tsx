'use client';

import { useState, useEffect } from 'react';
import { Subject } from '@/lib/types';
import { storage } from '@/lib/storage';
import { eventEmitter } from '@/lib/events';
import { gradeCalculatorV2 } from '@/lib/gradeCalculatorV2';
import { Onboarding } from './Onboarding';
import { DashboardStats } from './DashboardStats';
import { TimetableGrid } from './TimetableGrid';
import { SubjectModal } from './SubjectModal';
import { GradeDetailViewSheet } from './GradeDetailViewSheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function GradeApp() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newSubjectDayOfWeek, setNewSubjectDayOfWeek] = useState<number | null>(null);
  const [newSubjectPeriod, setNewSubjectPeriod] = useState<number | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  // Load subjects from storage on mount
  useEffect(() => {
    const config = storage.getConfig();
    setSubjects(config.timetable.subjects);
    setOnboardingComplete(config.onboardingComplete);
    setIsLoading(false);
  }, []);

  // Subscribe to real-time events instead of polling
  useEffect(() => {
    const unsubscribeUpdate = eventEmitter.on('subject:updated', () => {
      const config = storage.getConfig();
      setSubjects(config.timetable.subjects);
    });

    const unsubscribeAdd = eventEmitter.on('subject:added', () => {
      const config = storage.getConfig();
      setSubjects(config.timetable.subjects);
    });

    const unsubscribeDelete = eventEmitter.on('subject:deleted', () => {
      const config = storage.getConfig();
      setSubjects(config.timetable.subjects);
    });

    const unsubscribeAbsence = eventEmitter.on('absence:added', () => {
      const config = storage.getConfig();
      setSubjects(config.timetable.subjects);
    });

    return () => {
      unsubscribeUpdate();
      unsubscribeAdd();
      unsubscribeDelete();
      unsubscribeAbsence();
    };
  }, []);

  const handleAddSubject = (dayOfWeek?: number, period?: number) => {
    setSelectedSubject(null);
    setNewSubjectDayOfWeek(dayOfWeek ?? null);
    setNewSubjectPeriod(period ?? null);
    setIsSubjectModalOpen(true);
  };

  const handleEditSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsSubjectModalOpen(true);
  };

  const handleViewDetails = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDetailViewOpen(true);
  };

  const handleClearAll = () => {
    if (confirm('本当にすべての教科データを削除してもよろしいですか?')) {
      storage.clear();
      setSubjects([]);
      toast({
        title: '完了',
        description: 'すべてのデータを削除しました',
      });
    }
  };

  const handleModalSave = () => {
    setIsSubjectModalOpen(false);
    // Data syncs automatically via event emitter
  };

  const handleDetailSave = () => {
    setIsDetailViewOpen(false);
    // Data syncs automatically via event emitter
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">読み込み中...</p>
      </div>
    );
  }

  // Show onboarding if not complete
  if (!onboardingComplete) {
    return <Onboarding onComplete={() => setOnboardingComplete(true)} />;
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">高専成績管理プラットフォーム</h1>
          <p className="text-slate-600 mt-2 text-sm sm:text-base">
            完全自動シラバス連携・実験専用落単防止アラート搭載
          </p>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleAddSubject()} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            科目を追加
          </Button>
          <Button
            variant="outline"
            onClick={handleClearAll}
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            全削除
          </Button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <DashboardStats subjects={subjects} />

      {/* Timetable Grid */}
      {subjects.length > 0 ? (
        <div className="space-y-4">
          {/* Unscheduled subjects indicator */}
          {subjects.some(s => !s.dayOfWeek || !s.period) && (
            <Card className="p-4 bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-amber-900">
                    {subjects.filter(s => !s.dayOfWeek || !s.period).length}件の未割当科目があります
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    時間割ウィジェットで科目をドラッグ&ドロップするか、空きコマをクリックして割り当ててください
                  </p>
                </div>
              </div>
            </Card>
          )}

          <TimetableGrid
            subjects={subjects.filter(s => s.dayOfWeek !== undefined && s.period !== undefined)}
            periodsPerDay={5}
            onSelectSubject={handleViewDetails}
            onAddSubject={handleAddSubject}
            unscheduledSubjects={subjects.filter(s => !s.dayOfWeek || !s.period)}
          />

          {/* Subject Grid View */}
          <Card className="p-4">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">すべての科目</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map(subject => {
                const status = gradeCalculatorV2.getGradeStatus(subject);
                const color = gradeCalculatorV2.getIntelligentColor(status);
                const statusLabel = gradeCalculatorV2.getStatusLabel(status);

                return (
                  <Card
                    key={subject.id}
                    className={`p-4 cursor-pointer hover:shadow-lg transition-all border-l-4 ${
                      color === 'red'
                        ? 'border-l-red-600 bg-red-50 hover:bg-red-100'
                        : color === 'orange'
                        ? 'border-l-orange-600 bg-orange-50 hover:bg-orange-100'
                        : 'border-l-blue-600 bg-blue-50 hover:bg-blue-100'
                    }`}
                    onClick={() => handleViewDetails(subject)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-slate-900 flex-1">{subject.name}</h3>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded ${
                            color === 'red'
                              ? 'bg-red-200 text-red-800'
                              : color === 'orange'
                              ? 'bg-orange-200 text-orange-800'
                              : 'bg-blue-200 text-blue-800'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="text-sm text-slate-600 space-y-1">
                        <div>成績: {status.value} 点</div>
                        <div>予測: {status.predictedFinal} 点</div>
                        <div className="font-medium">
                          欠席: {subject.absences}/{gradeCalculatorV2.calculateAbsenceLimit(subject)}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSubject(subject);
                          }}
                          className="flex-1"
                        >
                          編集
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(subject);
                          }}
                          className="flex-1"
                        >
                          詳細
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-12 text-center">
          <div className="space-y-4">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
              科目がありません
            </h3>
            <p className="text-slate-600 text-sm sm:text-base">
              シラバスから自動取得した科目を時間割に割り当てるか、手動で追加してください
            </p>
            <Button onClick={() => handleAddSubject()} className="gap-2">
              <Plus className="w-4 h-4" />
              科目を追加
            </Button>
          </div>
        </Card>
      )}

      {/* Modals & Sheets */}
      <SubjectModal
        subject={selectedSubject}
        isOpen={isSubjectModalOpen}
        onClose={() => {
          setIsSubjectModalOpen(false);
          setNewSubjectDayOfWeek(null);
          setNewSubjectPeriod(null);
        }}
        onSave={handleModalSave}
        defaultDayOfWeek={newSubjectDayOfWeek ?? undefined}
        defaultPeriod={newSubjectPeriod ?? undefined}
      />

      <GradeDetailViewSheet
        subject={selectedSubject}
        isOpen={isDetailViewOpen}
        onClose={() => {
          setIsDetailViewOpen(false);
          // Data sync happens automatically via event emitter
        }}
      />
    </div>
  );
}
