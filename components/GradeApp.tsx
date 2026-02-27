'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Subject, SubjectPoolEntry } from '@/lib/types';
import { storage, subjectPool } from '@/lib/storage';
import { eventEmitter } from '@/lib/events';
import { gradeCalculatorV2 } from '@/lib/gradeCalculatorV2';
import { Onboarding } from './Onboarding';
import { DashboardStats } from './DashboardStats';
import { TimetableGrid } from './TimetableGrid';
import { SubjectPoolPanel } from './SubjectPoolPanel';
import { SubjectModal } from './SubjectModal';
import { GradeDetailViewSheet } from './GradeDetailViewSheet';
import { SyllabusAddModal } from './SyllabusAddModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Database, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── ドラッグ中のゴースト表示 ─────────────────────────────────────────────
function DragGhost({ entry }: { entry: SubjectPoolEntry }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-blue-400 rounded-lg shadow-2xl text-sm font-medium text-slate-900 max-w-[200px] rotate-2 cursor-grabbing">
      <GripVertical className="w-4 h-4 text-blue-500 flex-shrink-0" />
      <span className="truncate">{entry.subject.name}</span>
    </div>
  );
}

// ── GradeApp 本体 ─────────────────────────────────────────────────────────
export function GradeApp() {
  const { toast } = useToast();

  // 時間割に配置済みの科目（"すべての科目"カードにも使用）
  const [timetableSubjects, setTimetableSubjects] = useState<Subject[]>([]);
  // 科目プール
  const [poolEntries, setPoolEntries] = useState<SubjectPoolEntry[]>([]);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  // D&D 中のアクティブアイテム（DragOverlay 用）
  const [activeDragEntry, setActiveDragEntry] = useState<SubjectPoolEntry | null>(null);

  // ── データ読み込み ────────────────────────────────────────────────────
  const refreshData = useCallback(() => {
    const config = storage.getConfig();
    setTimetableSubjects(config.timetable.subjects);
    setPoolEntries(subjectPool.getAll());
  }, []);

  useEffect(() => {
    const config = storage.getConfig();
    setTimetableSubjects(config.timetable.subjects);
    setPoolEntries(subjectPool.getAll());
    setOnboardingComplete(config.onboardingComplete);
    setIsLoading(false);
  }, []);

  // イベント購読（リアルタイム同期）
  useEffect(() => {
    const handlers = [
      eventEmitter.on('subject:updated', refreshData),
      eventEmitter.on('subject:added', refreshData),
      eventEmitter.on('subject:deleted', refreshData),
      eventEmitter.on('absence:added', refreshData),
      eventEmitter.on('pool:updated', refreshData),
    ];
    return () => handlers.forEach((unsub) => unsub());
  }, [refreshData]);

  // ── D&D センサー ──────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // 8px動かしてからドラッグ開始（誤操作防止）
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 }, // 長押し200msでドラッグ
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'poolEntry') {
      setActiveDragEntry(data.entry as SubjectPoolEntry);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragEntry(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    // ドロップ先IDは "cell-{dayOfWeek}-{period}" 形式
    const overIdStr = String(over.id);
    if (activeData?.type === 'poolEntry' && overIdStr.startsWith('cell-')) {
      const [, dayStr, periodStr] = overIdStr.split('-');
      const dayOfWeek = parseInt(dayStr);
      const period = parseInt(periodStr);
      if (!isNaN(dayOfWeek) && !isNaN(period)) {
        subjectPool.promoteToTimetable(
          (activeData.entry as SubjectPoolEntry).subject.id,
          dayOfWeek,
          period
        );
        toast({
          title: '配置しました',
          description: `「${(activeData.entry as SubjectPoolEntry).subject.name}」を${['月','火','水','木','金'][dayOfWeek]}曜${period}限に配置しました`,
        });
      }
    }
  };

  // ── ハンドラー ────────────────────────────────────────────────────────
  const handleRemoveFromTimetable = (subjectId: string) => {
    storage.deleteSubject(subjectId);
    toast({ title: '取り外しました', description: '科目を時間割から外しました。科目プールには残っています。' });
  };

  const handleAddSubjectManual = (dayOfWeek?: number, period?: number) => {
    setSelectedSubject(null);
    setIsSubjectModalOpen(true);
  };

  const handleViewDetails = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDetailViewOpen(true);
  };

  const handleClearAll = () => {
    if (!confirm('すべてのデータ（時間割・科目プール）を削除しますか？')) return;
    storage.clear();
    subjectPool.clear();
    refreshData();
    toast({ title: '完了', description: 'すべてのデータを削除しました' });
  };

  // ── ローディング & オンボーディング ─────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">読み込み中...</p>
      </div>
    );
  }

  if (!onboardingComplete) {
    return <Onboarding onComplete={() => { setOnboardingComplete(true); refreshData(); }} />;
  }

  // ── 本体レンダリング ──────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full">
        {/* ── ヘッダー ─────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">高専成績管理プラットフォーム</h1>
            <p className="text-slate-500 mt-1 text-sm">シラバス自動連携・落単防止アラート</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* 科目手動追加 */}
            <Button onClick={() => handleAddSubjectManual()} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              科目を手動追加
            </Button>

            {/* シラバス追加取得（Step 6） */}
            <Button
              variant="outline"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-2"
            >
              <Database className="w-4 h-4" />
              シラバスを追加取得
            </Button>

            {/* 全削除 */}
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

        {/* ── ダッシュボード統計（時間割科目のみ） ────────────────────── */}
        <DashboardStats subjects={timetableSubjects} />

        {/* ── メインレイアウト: 左=時間割、右=科目プール ─────────────── */}
        <div className="flex flex-col xl:flex-row gap-6 mt-6">
          {/* 時間割グリッド */}
          <div className="flex-1 min-w-0">
            <TimetableGrid
              subjects={timetableSubjects}
              periodsPerDay={5}
              onSelectSubject={handleViewDetails}
              onAddSubject={handleAddSubjectManual}
              onRemoveSubject={handleRemoveFromTimetable}
            />
          </div>

          {/* 科目プールパネル（xl以上は右サイドバー、それ以下は下に） */}
          <div className="w-full xl:w-72 xl:flex-shrink-0">
            <div className="xl:sticky xl:top-4 h-[480px] xl:h-[600px]">
              <SubjectPoolPanel
                entries={poolEntries}
                onRequestAdd={() => setIsAddModalOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* ── すべての科目（時間割に配置済みのもののみ） ───────────────── */}
        <div className="mt-6">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">すべての科目</h2>
              <span className="text-xs text-slate-400">時間割に配置済み {timetableSubjects.length} 件</span>
            </div>

            {timetableSubjects.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <p className="text-sm">時間割に科目が配置されていません</p>
                <p className="text-xs mt-1">右の科目プールから時間割へドラッグして配置してください</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {timetableSubjects.map((subject) => {
                  const status = gradeCalculatorV2.getGradeStatus(subject);
                  const color = gradeCalculatorV2.getIntelligentColor(status);
                  const statusLabel = gradeCalculatorV2.getStatusLabel(status);
                  const remaining = gradeCalculatorV2.calculateRemainingAttendance(subject);
                  const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(subject);

                  return (
                    <Card
                      key={subject.id}
                      className={`p-4 cursor-pointer hover:shadow-lg transition-all border-l-4 ${
                        color === 'red'
                          ? 'border-l-red-600 bg-red-50 hover:bg-red-100'
                          : color === 'orange'
                          ? 'border-l-orange-500 bg-orange-50 hover:bg-orange-100'
                          : 'border-l-blue-600 bg-blue-50 hover:bg-blue-100'
                      }`}
                      onClick={() => handleViewDetails(subject)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-slate-900 text-sm flex-1 leading-tight">
                            {subject.name}
                          </h3>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${
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

                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div>成績: <span className="font-semibold text-slate-700">{status.value}点</span></div>
                          <div>予測: <span className="font-semibold text-slate-700">{status.predictedFinal}点</span></div>
                          <div className={remaining <= 0 ? 'text-red-600 font-bold' : remaining <= 2 ? 'text-orange-600 font-semibold' : ''}>
                            欠席: {subject.absences}/{absenceLimit}
                            {remaining <= 0
                              ? ' 🚨超過'
                              : remaining <= 2
                              ? ` (残${remaining}回)`
                              : ` (残${remaining}回)`}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubject(subject);
                              setIsSubjectModalOpen(true);
                            }}
                            className="flex-1 h-7 text-xs"
                          >
                            編集
                          </Button>
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleViewDetails(subject); }}
                            className="flex-1 h-7 text-xs"
                          >
                            詳細
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── D&D ドラッグ中ゴースト ──────────────────────────────────────── */}
      <DragOverlay>
        {activeDragEntry && <DragGhost entry={activeDragEntry} />}
      </DragOverlay>

      {/* ── モーダル群 ──────────────────────────────────────────────────── */}
      <SubjectModal
        subject={selectedSubject}
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        onSave={() => setIsSubjectModalOpen(false)}
      />

      <GradeDetailViewSheet
        subject={selectedSubject}
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
      />

      <SyllabusAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onComplete={(count) => {
          setIsAddModalOpen(false);
          refreshData();
        }}
      />
    </DndContext>
  );
}
