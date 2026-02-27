'use client';

import { useState } from 'react';
import { Subject } from '@/lib/types';
import { storage } from '@/lib/storage';
import { gradeCalculatorV2 } from '@/lib/gradeCalculatorV2';
import { AlertCircle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimetableCellProps {
  subject?: Subject;
  period: number;
  dayOfWeek: number;
  onSelect: (subject: Subject | null) => void;
  onAddSubject?: () => void;
  /** 時間割から科目を外すコールバック（subjectId を渡す） */
  onRemove?: (subjectId: string) => void;
}

export function TimetableCell({
  subject,
  period,
  dayOfWeek,
  onSelect,
  onAddSubject,
  onRemove,
}: TimetableCellProps) {
  const [isToggling, setIsToggling] = useState(false);

  // ── 空きコマ ──────────────────────────────────────────────────────────
  if (!subject) {
    return (
      <Button
        variant="outline"
        className="w-full h-24 p-2 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all"
        onClick={onAddSubject}
        aria-label={`${dayOfWeek + 1}曜 ${period}限に科目を追加`}
      >
        <Plus className="w-5 h-5 text-slate-300" />
      </Button>
    );
  }

  const status = gradeCalculatorV2.getGradeStatus(subject);
  const intelligentColor = gradeCalculatorV2.getIntelligentColor(status);

  // ── 欠席残数（Step 5 追加） ────────────────────────────────────────────
  const remaining = gradeCalculatorV2.calculateRemainingAttendance(subject);
  const absenceLimit = gradeCalculatorV2.calculateAbsenceLimit(subject);

  // 残数の色分け
  const remainingColor =
    remaining <= 0   ? 'text-red-600 font-bold'
    : remaining <= 2 ? 'text-orange-500 font-semibold'
    :                  'text-slate-400';

  // ── セルの色スタイル ──────────────────────────────────────────────────
  let cellBg = 'border border-slate-200 bg-white';
  let gradeTextColor = 'text-blue-700';
  let iconColor = 'text-blue-600';

  if (intelligentColor === 'red') {
    cellBg = 'border-2 border-red-500 bg-red-50 animate-pulse';
    gradeTextColor = 'text-red-700';
    iconColor = 'text-red-600';
  } else if (intelligentColor === 'orange') {
    cellBg = 'border border-orange-300 bg-orange-50';
    gradeTextColor = 'text-orange-700';
    iconColor = 'text-orange-600';
  }

  const handleAbsenceToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isToggling) return;
    setIsToggling(true);
    storage.updateSubject(subject.id, { absences: (subject.absences || 0) + 1 });
    setIsToggling(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(subject.id);
  };

  return (
    <div
      className={`
        w-full h-24 p-2 flex flex-col rounded-lg cursor-pointer transition-all
        hover:shadow-md relative group
        ${cellBg}
      `}
      onClick={() => onSelect(subject)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(subject);
      }}
    >
      {/* 科目名 */}
      <div className="flex-1 overflow-hidden">
        <div className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight">
          {subject.name}
        </div>
      </div>

      {/* ── 下段：左＝成績点数、右＝残り欠席可能数 ── */}
      <div className="flex items-end justify-between gap-1 mt-auto">
        {/* 左下: 成績（既存） */}
        <div className="flex items-center gap-1">
          <span className={`text-lg font-bold leading-none ${gradeTextColor}`}>
            {status.value || 0}
          </span>
          {intelligentColor === 'red' && (
            <AlertCircle className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0`} />
          )}
        </div>

        {/* 右下: 残り欠席可能数（Step 5 追加） */}
        <div
          className={`text-xs leading-none ${remainingColor}`}
          title={`欠席: ${subject.absences}/${absenceLimit} (残り${Math.max(0, remaining)}回)`}
        >
          {remaining <= 0 ? (
            <span className="text-red-600 font-bold text-[10px]">欠席超過</span>
          ) : (
            <span>残{remaining}</span>
          )}
        </div>
      </div>

      {/* ホバー時に表示するアクションボタン群 */}
      <div className="absolute inset-x-0 top-0 flex justify-end p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* × ボタン（時間割から外す） */}
        {onRemove && (
          <button
            onClick={handleRemove}
            className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
            title="時間割から外す"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* 欠席追加ボタン（ホバー時） */}
      <button
        onClick={handleAbsenceToggle}
        disabled={isToggling}
        className="
          absolute bottom-1 right-6 text-xs px-1.5 py-0.5
          bg-slate-100 hover:bg-slate-200 rounded text-slate-600
          opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50
        "
        title="欠席を追加"
      >
        +欠
      </button>
    </div>
  );
}
