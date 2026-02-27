'use client';

import { useState, useMemo } from 'react';
import { SchoolInfo, SemesterType, Subject } from '@/lib/types';
import { storage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronRight, Book, Loader, AlertCircle } from 'lucide-react';
import { getAllRegions, getSchoolsByRegion, Department } from '@/lib/kosenList';
import { processInChunks } from '@/lib/chunkedProcessor';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedSubjects, setFetchedSubjects] = useState<Subject[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [progressStage, setProgressStage] = useState<'idle' | 'urls' | 'details'>('idle');
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });
  const [failedUrls, setFailedUrls] = useState<Array<{ url: string; reason: string }>>([]);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    schoolName: '',
    department: '',
    grade: 1,
    semester: 'spring',
    academicYear: new Date().getFullYear(),
  });

  // 全地区リスト
  const regions = useMemo(() => getAllRegions(), []);

  // 地域で絞り込んだ学校リスト
  const availableSchools = useMemo(
    () => (selectedRegion ? getSchoolsByRegion(selectedRegion) : []),
    [selectedRegion]
  );

  // 選択した学校の学科リスト（Department[] オブジェクト配列）
  const availableDepartments = useMemo((): Department[] => {
    if (!selectedSchoolId) return [];
    const school = availableSchools.find((s) => s.id === selectedSchoolId);
    return school?.departments ?? [];
  }, [selectedSchoolId, availableSchools]);

  // 長野高専など era 区分がある場合のグループ化
  const departmentGroups = useMemo(() => {
    const hasEra = availableDepartments.some((d) => d.era !== undefined);
    if (!hasEra) {
      return { grouped: false as const, departments: availableDepartments };
    }
    const current = availableDepartments.filter((d) => d.era === 'current' || !d.era);
    const legacy = availableDepartments.filter((d) => d.era === 'legacy');
    return { grouped: true as const, current, legacy };
  }, [availableDepartments]);

  const handleNext = async () => {
    if (step === 1) {
      if (!schoolInfo.schoolName.trim() || !schoolInfo.department.trim()) {
        toast({
          title: 'エラー',
          description: '学校と学科を選択してください',
          variant: 'destructive',
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleFetchSyllabus = async () => {
    setIsLoading(true);
    setProgressStage('urls');
    setCurrentProgress({ current: 0, total: 0 });
    setFailedUrls([]);

    try {
      // Stage 1: URL リスト取得
      console.log('[v0] Stage 1: Fetching URL list...');
      const urlResponse = await fetch('/api/syllabus/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: availableSchools.find((s) => s.id === selectedSchoolId)?.syllabusId ?? '20',
          department: schoolInfo.department,
          grade: schoolInfo.grade,
          year: schoolInfo.academicYear,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error(`URL取得失敗: ${urlResponse.statusText}`);
      }

      const urlData = await urlResponse.json();
      const syllabusUrls: string[] = urlData.urls ?? [];

      console.log(`[v0] Found ${syllabusUrls.length} syllabus URLs`);
      setCurrentProgress({ current: 0, total: syllabusUrls.length });

      if (syllabusUrls.length === 0) {
        // ─── 修正: サンプルデータへのフォールバックを廃止 ───────────────────
        // URLが0件の場合はエラーを表示して終了（国語・数学・英語 等を出さない）
        const errorDetail = urlData.error
          ? `詳細: ${urlData.error}`
          : `school_id=${availableSchools.find((s) => s.id === selectedSchoolId)?.syllabusId}, ` +
            `department="${schoolInfo.department}", year=${schoolInfo.academicYear}`;
        toast({
          title: 'シラバスURLが見つかりません',
          description: `取得対象が0件でした。${errorDetail}`,
          variant: 'destructive',
        });
        setProgressStage('idle');
        setIsLoading(false);
        return;
      }

      // Stage 2: 個別シラバス詳細取得（チャンク処理）
      setProgressStage('details');
      console.log('[v0] Stage 2: Fetching detailed syllabi with chunked processing...');

      const results = await processInChunks(
        syllabusUrls,
        async (url: string, index: number, total: number) => {
          const detailResponse = await fetch('/api/syllabus/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              syllabusUrl: url,
              semester: schoolInfo.semester,
              academicYear: schoolInfo.academicYear,
              index: index + 1,
              total,
            }),
          });

          if (!detailResponse.ok) {
            throw new Error(`詳細取得失敗: ${detailResponse.statusText}`);
          }

          return await detailResponse.json();
        },
        {
          chunkSize: 2,
          delayBetweenChunks: 500,
          onProgress: (current, total) => {
            setCurrentProgress({ current, total });
          },
          onError: (error, _index, url) => {
            console.error(`[v0] Failed to fetch ${url}:`, error);
            setFailedUrls((prev) => [...prev, { url: url as string, reason: error.message }]);
          },
        }
      );

      // 成功した結果を科目リストに変換
      const newSubjects: Subject[] = [];
      for (const result of results.successful) {
        if (result.success && result.subject) {
          newSubjects.push(result.subject);
        }
      }

      if (newSubjects.length === 0) {
        // ─── 修正: サンプルデータへのフォールバックを廃止 ───────────────────
        // 失敗URLの詳細を表示してリトライを促す
        toast({
          title: 'シラバス解析に失敗しました',
          description: `${syllabusUrls.length}件を処理しましたが科目を抽出できませんでした。` +
            `ページ構造が変わった可能性があります。`,
          variant: 'destructive',
        });
      } else {
        setFetchedSubjects(newSubjects);
        toast({
          title: '成功',
          description: `${newSubjects.length}個の科目を取得しました（${results.failed.length}件失敗）`,
        });
      }
    } catch (error) {
      console.error('[v0] Syllabus fetch error:', error);
      toast({
        title: 'エラー',
        description: `シラバスの取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        variant: 'destructive',
      });
      // ─── 修正: サンプルデータへのフォールバックを廃止 ───────────────────
      // エラーをそのまま表示し、ユーザーに再試行を促す
    } finally {
      setIsLoading(false);
      setProgressStage('idle');
    }
  };

  const completeOnboarding = () => {
    storage.updateSchoolInfo(schoolInfo);
    if (fetchedSubjects.length > 0) {
      fetchedSubjects.forEach((subject) => {
        storage.addSubject(subject);
      });
    }
    storage.completeOnboarding();
    toast({
      title: '完了',
      description: 'セットアップが完了しました',
    });
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl sm:max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4 flex-wrap">
            <Book className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900">成績管理プラットフォーム</h1>
          </div>
          <p className="text-sm sm:text-lg text-slate-600">高専生向け次世代成績管理システムへようこそ</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 sm:mb-12">
          {[1, 2, 3, 4].map((stepNum) => (
            <div key={stepNum} className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-all ${
                  stepNum < step
                    ? 'bg-green-500 text-white'
                    : stepNum === step
                    ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                    : 'bg-slate-300 text-slate-600'
                }`}
              >
                {stepNum < step ? <Check className="w-6 h-6" /> : stepNum}
              </div>
              <div className="text-sm font-medium text-slate-700">
                {stepNum === 1 && '学校情報'}
                {stepNum === 2 && '学年・学期'}
                {stepNum === 3 && '確認'}
                {stepNum === 4 && 'シラバス'}
              </div>
              {stepNum < 4 && (
                <div
                  className={`h-1 w-12 mt-2 rounded-full transition-all ${
                    stepNum < step ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="p-4 sm:p-8 bg-white">
          {/* ══════════════════════════════════════════ */}
          {/* Step 1: 学校選択                           */}
          {/* ══════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">学校情報を選択</h2>
                <p className="text-slate-600 mb-6">全国の高専から選択してください</p>
              </div>

              <div className="space-y-4">
                {/* 地域選択 */}
                <div>
                  <Label htmlFor="region" className="text-sm font-medium text-slate-700">
                    地域を選択
                  </Label>
                  <select
                    id="region"
                    value={selectedRegion}
                    onChange={(e) => {
                      setSelectedRegion(e.target.value);
                      setSelectedSchoolId('');
                      setSchoolInfo({ ...schoolInfo, schoolName: '', department: '' });
                    }}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">地域を選択してください</option>
                    {regions.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 学校選択 */}
                <div>
                  <Label htmlFor="school" className="text-sm font-medium text-slate-700">
                    学校を選択
                  </Label>
                  <select
                    id="school"
                    value={selectedSchoolId}
                    onChange={(e) => {
                      const schoolId = e.target.value;
                      setSelectedSchoolId(schoolId);
                      const school = availableSchools.find((s) => s.id === schoolId);
                      if (school) {
                        setSchoolInfo({
                          ...schoolInfo,
                          schoolName: school.name,
                          department: '',
                        });
                      }
                    }}
                    disabled={!selectedRegion}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">学校を選択してください</option>
                    {availableSchools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ══════════════════════════════════════════ */}
                {/* 学科選択（era ありの場合は optgroup で分類）  */}
                {/* ══════════════════════════════════════════ */}
                <div>
                  <Label htmlFor="department" className="text-sm font-medium text-slate-700">
                    学科を選択
                  </Label>
                  <select
                    id="department"
                    value={schoolInfo.department}
                    onChange={(e) =>
                      setSchoolInfo({ ...schoolInfo, department: e.target.value })
                    }
                    disabled={!selectedSchoolId}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">学科を選択してください</option>

                    {/*
                     * ★ ここが修正の核心
                     *   dept は Department オブジェクト。
                     *   value / key には dept.name（文字列）を使い、
                     *   表示テキストには dept.label ?? dept.name を使う。
                     *   era がある場合は optgroup で新旧を分離。
                     */}
                    {departmentGroups.grouped ? (
                      <>
                        {/* 新課程 */}
                        {departmentGroups.current.length > 0 && (
                          <optgroup label="▼ 令和4年度以降入学（新カリキュラム）">
                            {departmentGroups.current.map((dept) => (
                              <option key={dept.name} value={dept.name} title={dept.note}>
                                {dept.label ?? dept.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {/* 旧課程 */}
                        {departmentGroups.legacy.length > 0 && (
                          <optgroup label="▼ 令和3年度以前入学（旧カリキュラム）">
                            {departmentGroups.legacy.map((dept) => (
                              <option key={dept.name} value={dept.name} title={dept.note}>
                                {dept.label ?? dept.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      /* era 区分なしの通常校 */
                      departmentGroups.departments.map((dept) => (
                        <option key={dept.name} value={dept.name} title={dept.note}>
                          {dept.label ?? dept.name}
                        </option>
                      ))
                    )}
                  </select>

                  {/* キャンパス注記（note がある場合のみ表示） */}
                  {schoolInfo.department && (() => {
                    const selected = availableDepartments.find(
                      (d) => d.name === schoolInfo.department
                    );
                    return selected?.note ? (
                      <p className="mt-1 text-xs text-slate-500">📍 {selected.note}</p>
                    ) : null;
                  })()}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  全国の高専から選択することで、シラバス自動取得がより正確になります
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* Step 2: 学年・学期                         */}
          {/* ══════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">学年と学期を選択</h2>
                <p className="text-slate-600 mb-6">現在の学年と学期を教えてください</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="grade" className="text-sm font-medium text-slate-700">
                    学年
                  </Label>
                  <select
                    id="grade"
                    value={schoolInfo.grade}
                    onChange={(e) =>
                      setSchoolInfo({ ...schoolInfo, grade: parseInt(e.target.value) })
                    }
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5].map((g) => (
                      <option key={g} value={g}>
                        {g}年生
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="semester" className="text-sm font-medium text-slate-700">
                    学期
                  </Label>
                  <select
                    id="semester"
                    value={schoolInfo.semester}
                    onChange={(e) =>
                      setSchoolInfo({ ...schoolInfo, semester: e.target.value as SemesterType })
                    }
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="spring">春学期</option>
                    <option value="fall">秋学期</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="academicYear" className="text-sm font-medium text-slate-700">
                    学年度
                  </Label>
                  <Input
                    id="academicYear"
                    type="number"
                    value={schoolInfo.academicYear}
                    onChange={(e) =>
                      setSchoolInfo({ ...schoolInfo, academicYear: parseInt(e.target.value) })
                    }
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* Step 3: 確認                               */}
          {/* ══════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">入力内容を確認</h2>
                <p className="text-slate-600 mb-6">以下の内容で間違いないかご確認ください</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-600">学校名</span>
                  <span className="font-semibold text-slate-900">{schoolInfo.schoolName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">学科</span>
                  <span className="font-semibold text-slate-900">{schoolInfo.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">学年</span>
                  <span className="font-semibold text-slate-900">{schoolInfo.grade}年生</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">学期</span>
                  <span className="font-semibold text-slate-900">
                    {schoolInfo.semester === 'spring' ? '春学期' : '秋学期'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">学年度</span>
                  <span className="font-semibold text-slate-900">{schoolInfo.academicYear}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  次のステップでシラバスを自動取得して、科目リストを生成します
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════ */}
          {/* Step 4: シラバス取得                        */}
          {/* ══════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">シラバスを自動取得</h2>
                <p className="text-slate-600 mb-6">
                  {isLoading
                    ? 'シラバスを取得中です...'
                    : '下のボタンをクリックして、設定内容に基づいて科目情報を自動取得します'}
                </p>
              </div>

              {isLoading && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="font-semibold text-blue-900">
                          {progressStage === 'urls' ? 'URLリスト取得中...' : 'シラバス詳細解析中...'}
                        </span>
                      </div>
                      <span className="text-sm text-blue-700">
                        {currentProgress.current}/{currentProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width:
                            currentProgress.total > 0
                              ? `${(currentProgress.current / currentProgress.total) * 100}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`p-3 rounded-lg border ${
                        progressStage !== 'idle'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-600">Stage 1</p>
                      <p className="text-sm text-slate-700">URLリスト取得</p>
                      {progressStage === 'urls' && (
                        <p className="text-xs text-blue-600 mt-1">進行中...</p>
                      )}
                      {progressStage === 'details' && (
                        <p className="text-xs text-green-600 mt-1">完了</p>
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-lg border ${
                        progressStage === 'details'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-600">Stage 2</p>
                      <p className="text-sm text-slate-700">詳細解析</p>
                      {progressStage === 'details' && (
                        <p className="text-xs text-blue-600 mt-1">進行中...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {fetchedSubjects.length > 0 && !isLoading && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-semibold mb-3">
                    成功: {fetchedSubjects.length}個の科目を取得しました
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {fetchedSubjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="text-sm text-green-700 bg-white p-2 rounded border border-green-100"
                      >
                        <div className="font-medium">{subject.name}</div>
                        <div className="text-xs opacity-75">
                          {subject.credits}単位 •{' '}
                          {subject.classType === 'experiment'
                            ? '実験'
                            : subject.classType === 'practical'
                            ? '実習'
                            : '講義'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {failedUrls.length > 0 && !isLoading && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 font-semibold">
                      {failedUrls.length}件のシラバス取得に失敗しました
                    </p>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {failedUrls.map((item, idx) => (
                      <p key={idx} className="text-xs text-amber-600">
                        {item.url}: {item.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {fetchedSubjects.length === 0 && !isLoading && (
                <Button
                  onClick={handleFetchSyllabus}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base"
                >
                  <Book className="w-4 h-4 mr-2" />
                  シラバスを自動取得
                </Button>
              )}

              {fetchedSubjects.length > 0 && !isLoading && (
                <Button onClick={handleFetchSyllabus} variant="outline" className="w-full">
                  再度取得
                </Button>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-700">
                  <span className="font-semibold">注意:</span> シラバス自動取得には{' '}
                  <code className="bg-amber-100 px-2 py-1 rounded text-xs font-mono">
                    FIRECRAWL_API_KEY
                  </code>{' '}
                  環境変数が必要です。2件ずつレートリミットを考慮して処理します。
                </p>
              </div>
            </div>
          )}

          {/* フッターボタン */}
          <div className="flex gap-2 sm:gap-4 mt-6 sm:mt-8 justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
              className="px-3 sm:px-6 text-sm sm:text-base"
            >
              戻る
            </Button>
            <Button
              onClick={handleNext}
              disabled={isLoading || (step === 4 && fetchedSubjects.length === 0)}
              className="px-3 sm:px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
            >
              {step === 4 ? (
                <>
                  <Check className="w-4 h-4" />
                  セットアップ完了
                </>
              ) : (
                <>
                  次へ
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </Card>

        <p className="text-center text-sm text-slate-600 mt-6">
          時間割を後から追加することもできます
        </p>
      </div>
    </div>
  );
}
