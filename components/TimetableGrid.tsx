'use client';

import { useDroppable } from '@dnd-kit/core';
import { Subject } from '@/lib/types';
import { TimetableCell } from './TimetableCell';
import { Card } from '@/components/ui/card';

const SHORT_DAYS = ['月', '火', '水', '木', '金'];

// ── ドロップ可能なセルラッパー ────────────────────────────────────────────
function DroppableCell({
  id,
  children,
  isEmpty,
}: {
  id: string;
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-lg transition-all duration-150
        ${isOver && isEmpty ? 'ring-2 ring-blue-400 ring-offset-1 bg-blue-50 scale-[1.02]' : ''}
        ${isOver && !isEmpty ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
      `}
    >
      {children}
    </div>
  );
}

// ── TimetableGrid 本体 ────────────────────────────────────────────────────
interface TimetableGridProps {
  subjects: Subject[];
  periodsPerDay: number;
  onSelectSubject: (subject: Subject) => void;
  /** 手動追加モーダルを開くコールバック（D&Dが使えない環境向けのフォールバック） */
  onAddSubject?: (dayOfWeek: number, period: number) => void;
  /** 時間割から科目を外すコールバック */
  onRemoveSubject?: (subjectId: string) => void;
}

export function TimetableGrid({
  subjects,
  periodsPerDay,
  onSelectSubject,
  onAddSubject,
  onRemoveSubject,
}: TimetableGridProps) {
  // dayOfWeek-period → Subject のマップ
  const subjectMap = new Map<string, Subject>();
  subjects.forEach((s) => {
    if (s.dayOfWeek !== undefined && s.period !== undefined) {
      subjectMap.set(`${s.dayOfWeek}-${s.period}`, s);
    }
  });

  return (
    <Card className="p-4 overflow-x-auto">
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Weekly Timetable</h2>

        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: '52px repeat(5, 1fr)' }}
        >
          {/* ヘッダー行 */}
          <div />
          {SHORT_DAYS.map((day) => (
            <div key={day} className="font-semibold text-slate-700 text-center text-sm py-1">
              {day}
            </div>
          ))}

          {/* 時限行 */}
          {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((period) => (
            <div key={period} className="contents">
              {/* 時限ラベル */}
              <div className="font-semibold text-slate-500 text-sm flex items-center justify-center">
                P{period}
              </div>

              {/* 5曜日分のセル */}
              {[0, 1, 2, 3, 4].map((dayOfWeek) => {
                const cellId = `cell-${dayOfWeek}-${period}`;
                const subject = subjectMap.get(`${dayOfWeek}-${period}`);

                return (
                  <DroppableCell key={cellId} id={cellId} isEmpty={!subject}>
                    <TimetableCell
                      subject={subject}
                      period={period}
                      dayOfWeek={dayOfWeek}
                      onSelect={(s) => s && onSelectSubject(s)}
                      onAddSubject={() => onAddSubject?.(dayOfWeek, period)}
                      onRemove={onRemoveSubject}
                    />
                  </DroppableCell>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
