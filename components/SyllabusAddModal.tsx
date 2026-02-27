'use client';

import { useState, useMemo } from 'react';
import { SemesterType, Subject } from '@/lib/types';
import { subjectPool, getCurrentAcademicYear } from '@/lib/storage';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getAllRegions, getSchoolsByRegion, Department } from '@/lib/kosenList';
import { processInChunks } from '@/lib/chunkedProcessor';
import { Book, Loader, AlertCircle, Check, Database, X } from 'lucide-react';

interface SyllabusAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 取得完了後に親へ通知（プール更新イベントを飛ばすが、念のため） */
  onComplete?: (count: number) => void;
}

export function SyllabusAddModal({ isOpen, onClose, onComplete }: SyllabusAddModalProps) {
  const { toast } = useToast();

  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [department, setDepartment] = useState('');
  const [grade, setGrade] = useState(1);
  const [semester, setSemester] = useState<SemesterType>('spring');

  const [isLoading, setIsLoading] = useState(false);
  const [progressStage, setProgressStage] = useState<'idle' | 'urls' | 'details'>('idle');
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });
  const [fetchedCount, setFetchedCount] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const regions = useMemo(() => getAllRegions(), []);
  const availableSchools = useMemo(
    () => (selectedRegion ? getSchoolsByRegion(selectedRegion) : []),
    [selectedRegion]
  );
  const availableDepartments = useMemo((): Department[] => {
    if (!selectedSchoolId) return [];
    return availableSchools.find((s) => s.id === selectedSchoolId)?.departments ?? [];
  }, [selectedSchoolId, availableSchools]);
  const departmentGroups = useMemo(() => {
    const hasEra = availableDepartments.some((d) => d.era !== undefined);
    if (!hasEra) return { grouped: false as const, departments: availableDepartments };
    const current = availableDepartments.filter((d) => d.era === 'current' || !d.era);
    const legacy = availableDepartments.filter((d) => d.era === 'legacy');
    return { grouped: true as const, current, legacy };
  }, [availableDepartments]);
  const selectedSyllabusId = useMemo(
    () => availableSchools.find((s) => s.id === selectedSchoolId)?.syllabusId ?? '',
    [selectedSchoolId, availableSchools]
  );

  const resetForm = () => {
    setSelectedRegion('');
    setSelectedSchoolId('');
    setDepartment('');
    setGrade(1);
    setSemester('spring');
    setFetchedCount(null);
    setFetchError(null);
    setProgressStage('idle');
    setCurrentProgress({ current: 0, total: 0 });
  };

  const handleClose = () => {
    if (isLoading) return;
    resetForm();
    onClose();
  };

  const handleFetch = async () => {
    if (!selectedSyllabusId || !department) {
      toast({ title: 'エラー', description: '学校と学科を選択してください', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setProgressStage('urls');
    setCurrentProgress({ current: 0, total: 0 });
    setFetchedCount(null);
    setFetchError(null);

    const academicYear = getCurrentAcademicYear();

    try {
      // Stage 1: URL 取得
      const urlRes = await fetch('/api/syllabus/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: selectedSyllabusId, department, grade, year: academicYear }),
      });

      if (!urlRes.ok) {
        let msg = `HTTP ${urlRes.status}`;
        try { const d = await urlRes.json(); msg = d.error ?? d.message ?? msg; } catch {}
        throw new Error(`URL取得失敗: ${msg}`);
      }

      const urlData = await urlRes.json();
      const syllabusUrls: string[] = urlData.urls ?? [];
      setCurrentProgress({ current: 0, total: syllabusUrls.length });

      if (syllabusUrls.length === 0) {
        throw new Error(`シラバスURLが0件でした（school=${selectedSyllabusId}, dept=${department}）`);
      }

      // Stage 2: 詳細取得
      setProgressStage('details');
      const results = await processInChunks(
        syllabusUrls,
        async (url: string, index: number, total: number) => {
          const res = await fetch('/api/syllabus/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ syllabusUrl: url, semester, academicYear, index: index + 1, total }),
          });
          if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try { const d = await res.json(); msg = d.error ?? d.message ?? msg; } catch {}
            throw new Error(msg);
          }
          return await res.json();
        },
        {
          chunkSize: 2,
          delayBetweenChunks: 500,
          onProgress: (current, total) => setCurrentProgress({ current, total }),
          onError: (error, _i, url) => console.warn(`[add-modal] failed: ${url}`, error),
        }
      );

      const newSubjects: Subject[] = results.successful
        .filter((r) => r.success && r.subject)
        .map((r) => r.subject as Subject);

      if (newSubjects.length === 0) {
        throw new Error(`${syllabusUrls.length}件を処理しましたが科目を抽出できませんでした`);
      }

      // ✅ 科目プールへ追加（同じ school+dept は上書きマージ）
      subjectPool.addEntries(newSubjects, selectedSyllabusId, department);
      setFetchedCount(newSubjects.length);
      onComplete?.(newSubjects.length);

      toast({
        title: '追加取得完了',
        description: `${newSubjects.length}件を科目プールに追加しました`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '不明なエラー';
      setFetchError(msg);
      toast({ title: '取得失敗', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setProgressStage('idle');
    }
  };

  if (!isOpen) return null;

  return (
    // shadcn Dialog の代わりに、SSR 安全なシンプルなオーバーレイを使用
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">シラバスを追加取得</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500">
          別の学科・学年のシラバスを取得して科目プールに追加します（一般科目・選択科目にも対応）
        </p>

        {/* フォーム */}
        <div className="space-y-3">
          {/* 地域 */}
          <div>
            <Label className="text-xs font-medium text-slate-600">地域</Label>
            <select
              value={selectedRegion}
              onChange={(e) => { setSelectedRegion(e.target.value); setSelectedSchoolId(''); setDepartment(''); }}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">地域を選択</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* 学校 */}
          <div>
            <Label className="text-xs font-medium text-slate-600">学校</Label>
            <select
              value={selectedSchoolId}
              onChange={(e) => { setSelectedSchoolId(e.target.value); setDepartment(''); }}
              disabled={!selectedRegion}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">学校を選択</option>
              {availableSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* 学科 */}
          <div>
            <Label className="text-xs font-medium text-slate-600">学科</Label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={!selectedSchoolId}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
            >
              <option value="">学科を選択</option>
              {departmentGroups.grouped ? (
                <>
                  {departmentGroups.current.length > 0 && (
                    <optgroup label="新カリキュラム">
                      {departmentGroups.current.map((d) => (
                        <option key={d.name} value={d.name}>{d.label ?? d.name}</option>
                      ))}
                    </optgroup>
                  )}
                  {departmentGroups.legacy.length > 0 && (
                    <optgroup label="旧カリキュラム">
                      {departmentGroups.legacy.map((d) => (
                        <option key={d.name} value={d.name}>{d.label ?? d.name}</option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                departmentGroups.departments.map((d) => (
                  <option key={d.name} value={d.name}>{d.label ?? d.name}</option>
                ))
              )}
            </select>
          </div>

          {/* 学年 + 学期 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-slate-600">学年</Label>
              <select
                value={grade}
                onChange={(e) => setGrade(parseInt(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[1, 2, 3, 4, 5].map((g) => <option key={g} value={g}>{g}年生</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-600">学期</Label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as SemesterType)}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="spring">春学期</option>
                <option value="fall">秋学期</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            📅 学年度は自動設定（{getCurrentAcademicYear()}年度）
          </p>
        </div>

        {/* 進捗 */}
        {isLoading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {progressStage === 'urls' ? 'URLリスト取得中...' : 'シラバス解析中...'}
                </span>
              </div>
              <span className="text-xs text-blue-700">
                {currentProgress.current}/{currentProgress.total}
              </span>
            </div>
            {currentProgress.total > 0 && (
              <div className="w-full bg-blue-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* 成功 */}
        {fetchedCount !== null && !isLoading && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">
              <strong>{fetchedCount}件</strong>を科目プールに追加しました。
              時間割へD&Dで配置できます。
            </p>
          </div>
        )}

        {/* エラー */}
        {fetchError && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{fetchError}</p>
          </div>
        )}

        {/* ボタン */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1">
            {fetchedCount !== null ? '閉じる' : 'キャンセル'}
          </Button>
          <Button
            onClick={handleFetch}
            disabled={isLoading || !selectedSyllabusId || !department}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <><Loader className="w-4 h-4 mr-2 animate-spin" />取得中...</>
            ) : (
              <><Book className="w-4 h-4 mr-2" />{fetchError ? '再試行' : '取得開始'}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
