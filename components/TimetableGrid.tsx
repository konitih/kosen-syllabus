'use client';

import { useState } from 'react';
import { Subject } from '@/lib/types';
import { TimetableCell } from './TimetableCell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { storage } from '@/lib/storage';
import { ChevronDown } from 'lucide-react';

interface TimetableGridProps {
  subjects: Subject[];
  periodsPerDay: number;
  onSelectSubject: (subject: Subject) => void;
  onAddSubject?: (dayOfWeek: number, period: number) => void;
  unscheduledSubjects?: Subject[];
}

const DAYS = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日'];
const SHORT_DAYS = ['月', '火', '水', '木', '金'];

export function TimetableGrid({
  subjects,
  periodsPerDay,
  onSelectSubject,
  onAddSubject,
  unscheduledSubjects = [],
}: TimetableGridProps) {
  const [selectedCellDayOfWeek, setSelectedCellDayOfWeek] = useState<number | null>(null);
  const [selectedCellPeriod, setSelectedCellPeriod] = useState<number | null>(null);
  const [showSubjectSelector, setShowSubjectSelector] = useState(false);

  // Create a map of day/period -> subject for quick lookup
  const subjectMap = new Map<string, Subject>();
  subjects.forEach(subject => {
    if (subject.dayOfWeek !== undefined && subject.period !== undefined) {
      const key = `${subject.dayOfWeek}-${subject.period}`;
      subjectMap.set(key, subject);
    }
  });

  const handleAddSubjectClick = (dayOfWeek: number, period: number) => {
    setSelectedCellDayOfWeek(dayOfWeek);
    setSelectedCellPeriod(period);
    if (unscheduledSubjects.length > 0) {
      setShowSubjectSelector(true);
    } else {
      onAddSubject?.(dayOfWeek, period);
    }
  };

  const handleSelectUnscheduledSubject = (subject: Subject) => {
    if (selectedCellDayOfWeek !== null && selectedCellPeriod !== null) {
      storage.updateSubject(subject.id, {
        dayOfWeek: selectedCellDayOfWeek,
        period: selectedCellPeriod,
      });
      setShowSubjectSelector(false);
      setSelectedCellDayOfWeek(null);
      setSelectedCellPeriod(null);
    }
  };

  return (
    <Card className="p-4 overflow-x-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Weekly Timetable</h2>
          {unscheduledSubjects.length > 0 && (
            <span className="text-sm text-slate-600">
              {unscheduledSubjects.length}件の未割当科目
            </span>
          )}
        </div>
        
        <div className="grid gap-4" style={{ 
          gridTemplateColumns: `80px repeat(5, 1fr)` 
        }}>
          {/* Header row */}
          <div className="font-semibold text-slate-700 text-sm text-center"></div>
          {SHORT_DAYS.map(day => (
            <div key={day} className="font-semibold text-slate-700 text-center text-sm">
              {day}
            </div>
          ))}

          {/* Period rows */}
          {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(period => (
            <div key={period} className="contents">
              <div className="font-semibold text-slate-600 text-sm flex items-center justify-center">
                P{period}
              </div>

              {Array.from({ length: 5 }, (_, i) => i).map(dayOfWeek => {
                const key = `${dayOfWeek}-${period}`;
                const subject = subjectMap.get(key);

                return (
                  <div key={key}>
                    <TimetableCell
                      subject={subject}
                      period={period}
                      dayOfWeek={dayOfWeek}
                      onSelect={(s) => s && onSelectSubject(s)}
                      onAddSubject={() => handleAddSubjectClick(dayOfWeek, period)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Subject selector dropdown */}
        {showSubjectSelector && unscheduledSubjects.length > 0 && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">科目を選択</h3>
              <button
                onClick={() => setShowSubjectSelector(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {unscheduledSubjects.map(subject => (
                <Button
                  key={subject.id}
                  variant="outline"
                  onClick={() => handleSelectUnscheduledSubject(subject)}
                  className="justify-start text-left h-auto py-2"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">{subject.name}</span>
                    <span className="text-xs text-slate-500">
                      {subject.credits}単位
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Card>
  );
}
