'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SubjectPoolEntry } from '@/lib/types';
import { subjectPool } from '@/lib/storage';
import { GripVertical, BookOpen, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ── ドラッグ可能な科目カード ───────────────────────────────────────────────
function DraggablePoolItem({ entry }: { entry: SubjectPoolEntry }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `pool-${entry.subject.id}`,
    data: { type: 'poolEntry', entry },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 999 : undefined,
  };

  const classTypeLabel =
    entry.subject.classType === 'experiment' ? '実験'
    : entry.subject.classType === 'practical' ? '実習'
    : '講義';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 p-2 rounded-lg border bg-white text-sm
        select-none touch-none
        ${isDragging
          ? 'shadow-xl border-blue-400 ring-2 ring-blue-300'
          : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
        }
      `}
    >
      {/* ドラッグハンドル */}
      <div
        {...attributes}
        {...listeners}
        className="text-slate-400 hover:text-slate-600 flex-shrink-0"
        aria-label="ドラッグして時間割へ配置"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* 科目情報 */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">{entry.subject.name}</div>
        <div className="text-xs text-slate-500">
          {entry.subject.credits}単位 · {classTypeLabel}
          {entry.subject.instructor && ` · ${entry.subject.instructor}`}
        </div>
      </div>
    </div>
  );
}

// ── 科目プールパネル本体 ──────────────────────────────────────────────────
interface SubjectPoolPanelProps {
  /** プールエントリ一覧（親から渡す） */
  entries: SubjectPoolEntry[];
  /** 「追加取得」ボタンを押したときのコールバック */
  onRequestAdd: () => void;
}

export function SubjectPoolPanel({ entries, onRequestAdd }: SubjectPoolPanelProps) {
  // ソース別にグループ化
  const groups = entries.reduce<Record<string, SubjectPoolEntry[]>>((acc, e) => {
    const key = `${e.sourceSchoolId}__${e.sourceDepartment}`;
    (acc[key] ??= []).push(e);
    return acc;
  }, {});

  return (
    <Card className="flex flex-col h-full overflow-hidden border-slate-200">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-slate-800 text-sm">科目プール</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {entries.length}件
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestAdd}
          className="text-xs h-7 px-2"
        >
          + 追加取得
        </Button>
      </div>

      {/* 説明 */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex-shrink-0">
        <p className="text-xs text-blue-600">
          科目を時間割のマスへ<strong>ドラッグ</strong>して配置してください
        </p>
      </div>

      {/* 科目リスト */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {entries.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">科目プールが空です</p>
            <p className="text-xs mt-1">「+ 追加取得」からシラバスを取得してください</p>
          </div>
        ) : (
          Object.entries(groups).map(([key, groupEntries]) => {
            const [, dept] = key.split('__');
            return (
              <div key={key}>
                <p className="text-xs font-semibold text-slate-500 mb-2 px-1 truncate">
                  {dept}
                </p>
                <div className="space-y-1.5">
                  {groupEntries.map((entry) => (
                    <DraggablePoolItem key={entry.subject.id} entry={entry} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
