'use client';

import { useState, useMemo } from 'react';
import { SchoolInfo, SemesterType, Subject } from '@/lib/types';
import { storage, subjectPool, getCurrentAcademicYear } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, ChevronRight, Book, Loader, AlertCircle, Database } from 'lucide-react';
import { getAllRegions, getSchoolsByRegion, Department } from '@/lib/kosenList';
import { processInChunks } from '@/lib/chunkedProcessor';

interface OnboardingProps {
  onComplete: () => void;
}

// ステップ数を4→3に削減（年度選択を廃止し「確認」と「シラバス取得」を統合）
// Step 1: 学校情報（学校・学科・学年・学期）
// Step 2: 確認
// Step 3: シラバス取得 → 科目プールへ保存

export function Onboarding({ onComplete }: OnboardingProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedSubjects, setFetchedSubjects] = useState<Subject[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [progressStage, setProgressStage] = useState<'idle' | 'urls' | 'details'>('idle');
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0 });
  const [failedUrls, setFailedUrls] = useState<Array<{ url: string; reason: string }>>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // 年度は内部で自動設定（UIには表示しない）
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    schoolName: '',
    department: '',
    grade: 1,
    semester: 'spring',
    academicYear: getCurrentAcademicYear(),
  });

  const regions = useMemo(() => getAllRegions(), []);
  const availableSchools = useMemo(
    () => (selectedRegion ? getSchoolsByRegion(selectedRegion) : []),
    [selectedRegion]
  );
  const availableDepartments = useMemo((): Department[] => {
    if (!selectedSchoolId) return [];
    const school = availableSchools.find((s) => s.id === selectedSchoolId);
    return school?.departments ?? [];
  }, [selectedSchoolId, availableSchools]);

  const departmentGroups = useMemo(() => {
    const hasEra = availableDepartments.some((d) => d.era !== undefined);
    if (!hasEra) return { grouped: false as const, departments: availableDepartments };
    const current = availableDepartments.filter((d) => d.era === 'current' || !d.era);
    const legacy = availableDepartments.filter((d) => d.era === 'legacy');
    return { grouped: true as const, current, legacy };
  }, [availableDepartments]);

  // 選択中の学校の syllabusId
  const selectedSyllabusId = useMemo(
    () => availableSchools.find((s) => s.id === selectedSchoolId)?.syllabusId ?? '',
    [selectedSchoolId, availableSchools]
  );

  const handleNext = () => {
    if (step === 1) {
      if (!schoolInfo.schoolName.trim() || !schoolInfo.department.trim()) {
        toast({ title: 'エラー', description: '学校と学科を選択してください', variant: 'destructive' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  };

  // ── シラバス取得 ──────────────────────────────────────────────────────────
  const handleFetchSyllabus = async () => {
    setIsLoading(true);
    setProgressStage('urls');
    setCurrentProgress({ current: 0, total: 0 });
    setFailedUrls([]);
    setFetchError(null);

    const academicYear = getCurrentAcademicYear(); // 常に自動設定

    try {
      // Stage 1: URLリスト取得
      const urlResponse = await fetch('/api/syllabus/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSyllabusId,
          department: schoolInfo.department,
          grade: schoolInfo.grade,
          year: academicYear,
        }),
      });

      if (!urlResponse.ok) {
        let errMsg = `HTTP ${urlResponse.status}`;
        try {
          const errData = await urlResponse.json();
          errMsg = errData.error ?? errData.message ?? errMsg;
        } catch {
          const errText = await urlResponse.text().catch(() => '');
          if (errText) errMsg += `: ${errText.slice(0, 200)}`;
        }
        throw new Error(`URL取得失敗: ${errMsg}`);
      }

      const urlData = await urlResponse.json();
      const syllabusUrls: string[] = urlData.urls ?? [];
      setCurrentProgress({ current: 0, total: syllabusUrls.length });

      if (syllabusUrls.length === 0) {
        const parts: string[] = [];
        if (urlData.error) parts.push(urlData.error);
        if (urlData.scrapedUrl) parts.push(`対象URL: ${urlData.scrapedUrl}`);
        if (typeof urlData.totalLinks === 'number')
          parts.push(`取得リンク数: ${urlData.totalLinks}件（シラバスURL: 0件）`);
        if (!parts.length)
          parts.push(`school_id=${selectedSyllabusId}, dept="${schoolInfo.department}", year=${academicYear}`);
        const msg = `シラバスURLが0件でした。${parts.join(' / ')}`;
        setFetchError(msg);
        toast({ title: 'シラバスURLが見つかりません', description: msg, variant: 'destructive' });
        setProgressStage('idle');
        setIsLoading(false);
        return;
      }

      // Stage 2: 個別詳細取得
      setProgressStage('details');
      const results = await processInChunks(
        syllabusUrls,
        async (url: string, index: number, total: number) => {
          const detailResponse = await fetch('/api/syllabus/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              syllabusUrl: url,
              semester: schoolInfo.semester,
              academicYear,
              index: index + 1,
              total,
            }),
          });

          if (!detailResponse.ok) {
            let errMsg = `HTTP ${detailResponse.status}`;
            try {
              const errData = await detailResponse.json();
              errMsg = errData.error ?? errData.message ?? errMsg;
            } catch {
              const errText = await detailResponse.text().catch(() => '');
              if (errText) errMsg += `: ${errText.slice(0, 100)}`;
            }
            throw new Error(`詳細取得失敗: ${errMsg}`);
          }

          return await detailResponse.json();
        },
        {
          chunkSize: 2,
          delayBetweenChunks: 500,
          onProgress: (current, total) => setCurrentProgress({ current, total }),
          onError: (error, _index, url) => {
            setFailedUrls((prev) => [...prev, { url: url as string, reason: error.message }]);
          },
        }
      );

      const newSubjects: Subject[] = [];
      for (const result of results.successful) {
        if (result.success && result.subject) {
          newSubjects.push(result.subject);
        }
      }

      if (newSubjects.length === 0) {
        const msg = `${syllabusUrls.length}件のURLを処理しましたが科目を抽出できませんでした。`;
        setFetchError(msg);
        toast({ title: 'シラバス解析に失敗しました', description: msg, variant: 'destructive' });
      } else {
        setFetchedSubjects(newSubjects);
        toast({
          title: '取得完了',
          description: `${newSubjects.length}件を科目プールに追加しました。時間割から配置できます。`,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '不明なエラー';
      setFetchError(msg);
      toast({ title: 'エラー', description: `シラバス取得失敗: ${msg}`, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setProgressStage('idle');
    }
  };

  // ── セットアップ完了 ─────────────────────────────────────────────────────
  // ✅ Step 3変更点: 科目を timetable.subjects ではなく subjectPool に保存
  const completeOnboarding = () => {
    // 年度を自動設定してschoolInfoを更新
    const finalSchoolInfo = { ...schoolInfo, academicYear: getCurrentAcademicYear() };
    storage.updateSchoolInfo(finalSchoolInfo);

    if (fetchedSubjects.length > 0) {
      subjectPool.addEntries(fetchedSubjects, selectedSyllabusId, schoolInfo.department);
    }

    storage.completeOnboarding();
    toast({
      title: 'セットアップ完了！',
      description: fetchedSubjects.length > 0
        ? `${fetchedSubjects.length}件を科目プールに保存しました。時間割画面からD&Dで配置できます。`
        : 'セットアップが完了しました。後から科目を手動追加できます。',
    });
    onComplete();
  };

  const STEP_LABELS = ['学校情報', '確認', 'シラバス'];

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

        {/* Progress Steps (3 steps) */}
        <div className="flex justify-center gap-8 mb-8 sm:mb-12">
          {([1, 2, 3] as const).map((stepNum) => (
            <div key={stepNum} className="flex flex-col items-center">
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
              <div className="text-sm font-medium text-slate-700">{STEP_LABELS[stepNum - 1]}</div>
              {stepNum < 3 && (
                <div className={`h-1 w-16 mt-2 rounded-full ${stepNum < step ? 'bg-green-500' : 'bg-slate-300'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="p-4 sm:p-8 bg-white">
          {/* ────────────────────────────────── */}
          {/* Step 1: 学校情報（学年・学期含む）  */}
          {/* ────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">学校情報を入力</h2>
                <p className="text-slate-500 text-sm">学校・学科・学年・学期を選択してください</p>
              </div>

              <div className="space-y-4">
                {/* 地域 */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">地域</Label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => {
                      setSelectedRegion(e.target.value);
                      setSelectedSchoolId('');
                      setSchoolInfo({ ...schoolInfo, schoolName: '', department: '' });
                    }}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">地域を選択</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* 学校 */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">学校</Label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSchoolId(id);
                      const school = availableSchools.find((s) => s.id === id);
                      if (school) setSchoolInfo({ ...schoolInfo, schoolName: school.name, department: '' });
                    }}
                    disabled={!selectedRegion}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100"
                  >
                    <option value="">学校を選択</option>
                    {availableSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* 学科 */}
                <div>
                  <Label className="text-sm font-medium text-slate-700">学科</Label>
                  <select
                    value={schoolInfo.department}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, department: e.target.value })}
                    disabled={!selectedSchoolId}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100"
                  >
                    <option value="">学科を選択</option>
                    {departmentGroups.grouped ? (
                      <>
                        {departmentGroups.current.length > 0 && (
                          <optgroup label="▼ 令和4年度以降（新カリキュラム）">
                            {departmentGroups.current.map((d) => (
                              <option key={d.name} value={d.name}>{d.label ?? d.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {departmentGroups.legacy.length > 0 && (
                          <optgroup label="▼ 令和3年度以前（旧カリキュラム）">
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
                  {schoolInfo.department && (() => {
                    const sel = availableDepartments.find((d) => d.name === schoolInfo.department);
                    return sel?.note ? <p className="mt-1 text-xs text-slate-500">📍 {sel.note}</p> : null;
                  })()}
                </div>

                {/* 学年 + 学期（横並び） */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">学年</Label>
                    <select
                      value={schoolInfo.grade}
                      onChange={(e) => setSchoolInfo({ ...schoolInfo, grade: parseInt(e.target.value) })}
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {[1, 2, 3, 4, 5].map((g) => <option key={g} value={g}>{g}年生</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">学期</Label>
                    <select
                      value={schoolInfo.semester}
                      onChange={(e) => setSchoolInfo({ ...schoolInfo, semester: e.target.value as SemesterType })}
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="spring">春学期（前期）</option>
                      <option value="fall">秋学期（後期）</option>
                    </select>
                  </div>
                </div>

                {/* 年度は自動設定の案内のみ */}
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                  📅 学年度は自動設定されます（{getCurrentAcademicYear()}年度）
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── */}
          {/* Step 2: 確認     */}
          {/* ──────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">入力内容を確認</h2>
                <p className="text-slate-500 text-sm">以下の内容でよろしいですか？</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-lg space-y-3">
                {[
                  ['学校名', schoolInfo.schoolName],
                  ['学科', schoolInfo.department],
                  ['学年', `${schoolInfo.grade}年生`],
                  ['学期', schoolInfo.semester === 'spring' ? '春学期（前期）' : '秋学期（後期）'],
                  ['学年度（自動）', `${getCurrentAcademicYear()}年度`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm">{label}</span>
                    <span className="font-semibold text-slate-900 text-sm">{value}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  次のステップでシラバスを取得し、<strong>科目プール</strong>に保存します。
                  時間割画面からドラッグ＆ドロップで配置できます。
                </p>
              </div>
            </div>
          )}

          {/* ──────────────────── */}
          {/* Step 3: シラバス取得  */}
          {/* ──────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">シラバスを取得</h2>
                <p className="text-slate-500 text-sm">
                  {isLoading ? '取得中...' : '取得した科目は「科目プール」に保存され、時間割へD&Dで配置できます'}
                </p>
              </div>

              {/* 進捗表示 */}
              {isLoading && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="font-semibold text-blue-900 text-sm">
                          {progressStage === 'urls' ? 'URLリスト取得中...' : 'シラバス解析中...'}
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
                          width: currentProgress.total > 0
                            ? `${(currentProgress.current / currentProgress.total) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border ${progressStage !== 'idle' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                      <p className="text-xs font-semibold text-slate-600">Stage 1</p>
                      <p className="text-sm text-slate-700">URLリスト取得</p>
                      {progressStage === 'urls' && <p className="text-xs text-blue-600 mt-1">進行中...</p>}
                      {progressStage === 'details' && <p className="text-xs text-green-600 mt-1">✓ 完了</p>}
                    </div>
                    <div className={`p-3 rounded-lg border ${progressStage === 'details' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                      <p className="text-xs font-semibold text-slate-600">Stage 2</p>
                      <p className="text-sm text-slate-700">詳細解析</p>
                      {progressStage === 'details' && <p className="text-xs text-blue-600 mt-1">進行中...</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* 成功結果 */}
              {fetchedSubjects.length > 0 && !isLoading && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-green-700" />
                    <p className="text-sm text-green-700 font-semibold">
                      {fetchedSubjects.length}件を科目プールに準備完了
                    </p>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {fetchedSubjects.map((s) => (
                      <div key={s.id} className="text-sm text-green-700 bg-white p-2 rounded border border-green-100 flex justify-between">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs opacity-75">{s.credits}単位</span>
                      </div>
                    ))}
                  </div>
                  {failedUrls.length > 0 && (
                    <p className="text-xs text-amber-700 mt-2">{failedUrls.length}件は解析失敗</p>
                  )}
                </div>
              )}

              {/* エラー表示 */}
              {fetchError && !isLoading && fetchedSubjects.length === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-red-700 font-semibold mb-1">取得に失敗しました</p>
                      <p className="text-xs text-red-600">{fetchError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 取得ボタン */}
              {!isLoading && fetchedSubjects.length === 0 && (
                <Button
                  onClick={handleFetchSyllabus}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base"
                >
                  <Book className="w-4 h-4 mr-2" />
                  {fetchError ? '再度取得する' : 'シラバスを自動取得'}
                </Button>
              )}
              {fetchedSubjects.length > 0 && !isLoading && (
                <Button onClick={handleFetchSyllabus} variant="outline" className="w-full">
                  再取得する
                </Button>
              )}

              {/* スキップ案内 */}
              {!isLoading && fetchedSubjects.length === 0 && !fetchError && (
                <p className="text-center text-xs text-slate-400">
                  後から「シラバス追加取得」でいつでも取得できます
                </p>
              )}
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
              disabled={isLoading || (step === 3 && fetchedSubjects.length === 0)}
              className="px-3 sm:px-6 gap-2 bg-blue-600 hover:bg-blue-700 text-sm sm:text-base"
            >
              {step === 3 ? (
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
          時間割は後からドラッグ＆ドロップで作成できます
        </p>
      </div>
    </div>
  );
}
