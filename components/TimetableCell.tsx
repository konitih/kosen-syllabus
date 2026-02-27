'use client';

import { useState } from 'react';
import { Subject } from '@/lib/types';
import { storage } from '@/lib/storage';
import { gradeCalculatorV2 } from '@/lib/gradeCalculatorV2';
import { Button } from '@/components/ui/button';
import { AlertCircle, Plus } from 'lucide-react';

interface TimetableCellProps {
  subject?: Subject;
  period: number;
  dayOfWeek: number;
  onSelect: (subject: Subject | null) => void;
  onAddSubject?: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TimetableCell({
  subject,
  period,
  dayOfWeek,
  onSelect,
  onAddSubject,
}: TimetableCellProps) {
  const [isToggling, setIsToggling] = useState(false);

  if (!subject) {
    return (
      <Button
        variant="outline"
        className="w-full h-24 p-2 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-all"
        onClick={onAddSubject}
      >
        <Plus className="w-6 h-6 text-slate-400" />
      </Button>
    );
  }

  const status = gradeCalculatorV2.getGradeStatus(subject);
  
  // Auto-assign background color based on status and absences (intelligent coloring)
  const intelligentColor = gradeCalculatorV2.getIntelligentColor(status);
  let bgColor = 'bg-blue-50 border-blue-200';
  let textColor = 'text-blue-700';
  let iconColor = 'text-blue-600';

  if (intelligentColor === 'red') {
    bgColor = 'bg-red-50 border-red-200';
    textColor = 'text-red-700';
    iconColor = 'text-red-600';
  } else if (intelligentColor === 'orange') {
    bgColor = 'bg-orange-50 border-orange-200';
    textColor = 'text-orange-700';
    iconColor = 'text-orange-600';
  }

  const borderStyle = intelligentColor === 'red'
    ? 'border-2 border-red-500 animate-pulse'
    : `border border-slate-200 ${bgColor}`;

  const handleAbsenceToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsToggling(true);
    const config = storage.getConfig();
    const idx = config.timetable.subjects.findIndex(s => s.id === subject.id);
    if (idx !== -1) {
      const updated = { ...config.timetable.subjects[idx] };
      updated.absences = (updated.absences || 0) + 1;
      storage.updateSubject(subject.id, updated);
    }
    setIsToggling(false);
  };

  return (
    <div 
      className={`w-full h-24 p-2 flex flex-col items-start justify-between rounded-lg cursor-pointer transition-all ${borderStyle} bg-white relative group hover:shadow-md`}
      onClick={() => onSelect(subject)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(subject);
        }
      }}
    >
      <div className="w-full flex-1">
        <div className="text-sm font-semibold text-slate-900 line-clamp-2 hover:underline">
          {subject.name}
        </div>
      </div>

      <div className="w-full flex items-center justify-between gap-2">
        <div className={`text-lg font-bold ${textColor}`}>
          {status.value || 0}
        </div>
        {intelligentColor === 'red' && (
          <AlertCircle className={`w-4 h-4 ${iconColor} flex-shrink-0 animate-pulse`} />
        )}
      </div>
      
      {/* Absence toggle button */}
      <button
        onClick={handleAbsenceToggle}
        disabled={isToggling}
        className="absolute bottom-1 right-1 text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        title="欠席"
      >
        欠{subject.absences || 0}
      </button>
    </div>
  );
}
