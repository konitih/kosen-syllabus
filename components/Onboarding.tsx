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
import { syllabusFetcher } from '@/lib/syllabusFetcher';
import { getAllRegions, getSchoolsByRegion, getSchoolByName } from '@/lib/kosenList';
import { processInChunks } from '@/lib/chunkedProcessor';

interface OnboardingProps {
  onComplete: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();

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
    // 修正: 現在年度をデフォルトにし、未来年度は許容しない
    academicYear: CURRENT_YEAR,
  });

  const regions = useMemo(() => getAllRegions(), []);
  const availableSchools = useMemo(
    () => (selectedRegion ? getSchoolsByRegion(selectedRegion) : []),
    [selectedRegion]
  );
  const availableDepartments = useMemo(() => {
    if (!selectedSchoolId) return [];
    const school = availableSchools.find((s) => s.id === selectedSchoolId);
    return school?.departments || [];
  }, [selectedSchoolId, availableSchools]);

  const handleNext = async () => {
    if (step === 1) {
      if (!schoolInfo.schoolName.trim() || !schoolInfo.department.trim()) {
        toast({ title: 'エラー', description: '学校と学科を選択してください', variant: 'destructive' });
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
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
  };

  const handleFetchSyllabus = async () => {
    setIsLoading(true);
    setProgressStage('urls');
    setCurrentProgress({ current: 0, total: 0 });
    setFailedUrls([]);

    try {
      // ---- Stage 1: URLリスト取得 ----------------------------------------
      console.log('[Onboarding] Stage 1: Fetching URL list...');

      // selectedSchoolId は kosenList の id フィールド（例: 'nagano'）
      // API側で school_id（数値コード）に変換するか、そのまま渡す
      const urlResponse = await fetch('/api/syllabus/urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: selectedSchoolId, // kosenList の id をそのまま渡す
          department: schoolInfo.department,
          grade: schoolInfo.grade,
          // 修正: 現在年度を上限とした値を送信
          year: Math.min(schoolInfo.academicYear, CURRENT_YEAR),
        }),
      });

      if (!urlResponse.ok) {
        const errData = await urlResponse.json().catch(() => ({}));
        throw new Error(errData.error ?? `URL取得失敗: ${urlResponse.statusText}`);
      }

      const urlData = await urlResponse.json();
      const syllabusUrls: string[] = urlData.urls ?? [];

      console.log(`[Onboarding] Found ${syllabusUrls.length} syllabus URLs`);
      setCurrentProgress({ current: 0, total: syllabusUrls.length });

      if (syllabusUrls.length === 0) {
        toast({
          title: '注意',
          description:
            'シラバスURLが見つかりませんでした。デフォルト科目を使用します。',
          variant: 'destructive',
        });
        const defaults = syllabusFetcher.createDefaultSubjects(
          schoolInfo.grade,
          schoolInfo.semester
        );
        setFetchedSubjects(defaults);
        setProgressStage('idle');
        setIsLoading(false);
        return;
      }

      // ---- Stage 2: 詳細を2件ずつ並列取得 -----------------------------------
      setProgressStage('details');
      console.log('[Onboarding] Stage 2: Chunked detail scraping...');

      const semester_ = schoolInfo.semester;
      const academicYear_ = Math.min(schoolInfo.academicYear, CURRENT_YEAR);

      const results = await processInChunks(
        syllabusUrls,
        async (url: string, index: number, total: number) => {
          const detailResponse = await fetch('/api/syllabus/detail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              syllabusUrl: url,
              semester: semester_,
              academicYear: academicYear_,
              index: index + 1,
              total,
            }),
          });

          if (!detailResponse.ok) {
            throw new Error(`詳細取得失敗 (${detailResponse.status}): ${detailResponse.statusText}`);
          }

          return detailResponse.json();
        },
        {
          chunkSize: 2,          // 2件ずつ並列処理（レートリミット配慮）
          delayBetweenChunks: 500, // 500ms クールダウン
          onProgress: (current, total) => {
            setCurrentProgress({ current, total });
          },
          onError: (error, _index, url) => {
            console.error(`[Onboarding] Failed: ${url}`, error);
            setFailedUrls((prev) => [
              ...prev,
              { url: url as string, reason: error.message },
            ]);
          },
        }
      );

      // 成功分を Subject に変換
      const newSubjects: Subject[] = [];
      for (const result of results.successful) {
        if (result?.success && result?.subject) {
          newSubjects.push(result.subject as Subject);
        }
      }

      if (newSubjects.length === 0) {
        const defaults = syllabusFetcher.createDefaultSubjects(
          schoolInfo.grade,
          schoolInfo.semester
        );
        setFetchedSubjects(defaults);
        toast({
          title: '警告',
          description: 'シラバス取得に失敗しました。デフォルト科目を使用します。',
          variant: 'destructive',
        });
      } else {
        setFetchedSubjects(newSubjects);
        toast({
          title: '完了',
          description: `${newSubjects.length}科目を取得しました（失敗: ${results.failed.length}件）`,
        });
      }
    } catch (error) {
      console.error('[Onboarding] Fetch error:', error);
      toast({
        title: 'エラー',
        description: (error as Error).message || 'シラバス取得に失敗しました',
        variant: 'destructive',
      });
      const defaults = syllabusFetcher.createDefaultSubjects(
        schoolInfo.grade,
        schoolInfo.semester
      );
      setFetchedSubjects(defaults);
    } finally {
      setIsLoading(false);
      setProgressStage('idle');
    }
  };

  const completeOnboarding = () => {
    storage.updateSchoolInfo(schoolInfo);
    fetchedSubjects.forEach((subject) => storage.addSubject(subject));
    storage.completeOnboarding();
    toast({ title: '完了', description: 'セットアップが完了しました' });
    onComplete();
  };

  // Progress label: "12 / 40 完了"
  const progressLabel =
    currentProgress.total > 0
      ? `${currentProgress.current} / ${currentProgress.total} 完了`
      : '準備中...';

  const progressPct =
    currentProgress.total > 0
      ? Math.round((currentProgress.current / currentProgress.total) * 100)
      : 0;

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
          {([1, 2, 3, 4] as const).map((stepNum) => (
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
          {/* ---- Step 1: 学校情報 ---- */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">学校情報を選択</h2>
                <p className="text-slate-600 mb-6">全国の高専から選択してください</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="region" className="text-sm font-medium text-slate-700">地域を選択</Label>
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
                    {regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="school" className="text-sm font-medium text-slate-700">学校を選択</Label>
                  <select
                    id="school"
                    value={selectedSchoolId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSchoolId(id);
                      const school = availableSchools.find((s) => s.id === id);
                      if (school) {
                        setSchoolInfo({ ...schoolInfo, schoolName: school.name, department: '' });
                      }
                    }}
                    disabled={!selectedRegion}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">学校を選択してください</option>
                    {availableSchools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="department" className="text-sm font-medium text-slate-700">学科を選択</Label>
                  <select
                    id="department"
                    value={schoolInfo.department}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, department: e.target.value })}
                    disabled={!selectedSchoolId}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">学科を選択してください</option>
                    {availableDepartments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  全国の高専から選択することで、シラバス自動取得がより正確になります
                </p>
              </div>
            </div>
          )}

          {/* ---- Step 2: 学年・学期 ---- */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">学年と学期を選択</h2>
                <p className="text-slate-600 mb-6">現在の学年と学期を教えてください</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="grade" className="text-sm font-medium text-slate-700">学年</Label>
                  <select
                    id="grade"
                    value={schoolInfo.grade}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, grade: parseInt(e.target.value) })}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1, 2, 3, 4, 5].map((g) => (
                      <option key={g} value={g}>{g}年生</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="semester" className="text-sm font-medium text-slate-700">学期</Label>
                  <select
                    id="semester"
                    value={schoolInfo.semester}
                    onChange={(e) => setSchoolInfo({ ...schoolInfo, semester: e.target.value as SemesterType })}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="spring">前期（春学期）</option>
                    <option value="fall">後期（秋学期）</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="academicYear" className="text-sm font-medium text-slate-700">
                    学年度（最大: {CURRENT_YEAR}年度）
                  </Label>
                  <Input
                    id="academicYear"
                    type="number"
                    min={2000}
                    max={CURRENT_YEAR}  // 修正: 未来年度を入力不可にする
                    value={schoolInfo.academicYear}
                    onChange={(e) => {
                      const val = Math.min(parseInt(e.target.value) || CURRENT_YEAR, CURRENT_YEAR);
                      setSchoolInfo({ ...schoolInfo, academicYear: val });
                    }}
                    className="mt-2"
                  />
                  {schoolInfo.academicYear > CURRENT_YEAR && (
                    <p className="text-xs text-red-500 mt-1">
                      未来の年度は指定できません。{CURRENT_YEAR}年度を上限としています。
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---- Step 3: 確認 ---- */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">入力内容を確認</h2>
                <p className="text-slate-600 mb-6">以下の内容で間違いないかご確認ください</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-lg space-y-4">
                {[
                  { label: '学校名', value: schoolInfo.schoolName },
                  { label: '学科', value: schoolInfo.department },
                  { label: '学年', value: `${schoolInfo.grade}年生` },
                  { label: '学期', value: schoolInfo.semester === 'spring' ? '前期' : '後期' },
                  { label: '学年度', value: `${schoolInfo.academicYear}年度` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-semibold text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  次のステップでシラバスを2件ずつ自動取得して科目リストを生成します
                </p>
              </div>
            </div>
          )}

          {/* ---- Step 4: シラバス取得 ---- */}
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
                  {/* 進捗インジケーター */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Loader className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="font-semibold text-blue-900">
                          {progressStage === 'urls'
                            ? 'URLリスト取得中...'
                            : 'シラバス詳細解析中...'}
                        </span>
                      </div>
                      {/* "12 / 40 完了" スタイルの進捗表示 */}
                      <span className="text-sm font-mono font-bold text-blue-700">
                        {progressStage === 'details' ? progressLabel : '—'}
                      </span>
                    </div>

                    {/* プログレスバー */}
                    <div className="w-full bg-blue-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width:
                            progressStage === 'details' ? `${progressPct}%` : '0%',
                        }}
                      />
                    </div>

                    {progressStage === 'details' && currentProgress.total > 0 && (
                      <p className="text-xs text-blue-600 mt-2 text-right">
                        {progressPct}% 完了
                      </p>
                    )}
                  </div>

                  {/* Stage 可視化 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`p-3 rounded-lg border transition-colors ${
                        progressStage !== 'idle'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-500">Stage 1</p>
                      <p className="text-sm font-medium text-slate-700">URLリスト取得</p>
                      {progressStage === 'urls' && (
                        <p className="text-xs text-blue-600 mt-1 animate-pulse">進行中...</p>
                      )}
                      {progressStage === 'details' && (
                        <p className="text-xs text-green-600 mt-1">✓ 完了</p>
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-lg border transition-colors ${
                        progressStage === 'details'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-500">Stage 2</p>
                      <p className="text-sm font-medium text-slate-700">詳細解析（2件並列）</p>
                      {progressStage === 'details' && (
                        <p className="text-xs text-blue-600 mt-1 animate-pulse">進行中...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 成功時の科目一覧 */}
              {fetchedSubjects.length > 0 && !isLoading && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-700 font-semibold mb-3">
                    ✓ {fetchedSubjects.length}科目を取得しました
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {fetchedSubjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="text-sm text-green-700 bg-white p-2 rounded border border-green-100"
                      >
                        <div className="font-medium">{subject.name}</div>
                        <div className="text-xs opacity-75">
                          {subject.credits}単位 ・{' '}
                          {subject.classType === 'experiment'
                            ? '実験'
                            : subject.classType === 'practical'
                            ? '実習・演習'
                            : '講義'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 失敗URL一覧 */}
              {failedUrls.length > 0 && !isLoading && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 font-semibold">
                      {failedUrls.length}件の取得に失敗
                    </p>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {failedUrls.map((item, idx) => (
                      <p key={idx} className="text-xs text-amber-600 truncate">
                        {item.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {!isLoading && (
                <Button
                  onClick={handleFetchSyllabus}
                  variant={fetchedSubjects.length > 0 ? 'outline' : 'default'}
                  className={`w-full py-6 text-base ${
                    fetchedSubjects.length === 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''
                  }`}
                >
                  <Book className="w-4 h-4 mr-2" />
                  {fetchedSubjects.length > 0 ? '再度取得' : 'シラバスを自動取得'}
                </Button>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-700">
                  <span className="font-semibold">注意:</span>{' '}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    FIRECRAWL_API_KEY
                  </code>{' '}
                  を{' '}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    .env.local
                  </code>{' '}
                  に設定してください。2件ずつレートリミットを考慮して処理します。
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
          科目は後から手動で追加することもできます
        </p>
      </div>
    </div>
  );
}
