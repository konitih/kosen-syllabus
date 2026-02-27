/**
 * Onboarding.tsx の Step 1「学科選択」セクションの差分パッチ
 *
 * 変更点:
 *  - getDepartmentDisplayNames() を使い、era 別にグループ表示
 *  - 旧学科は optgroup「▼ 令和3年度以前入学（旧学科）」
 *  - 新学科は optgroup「▼ 令和4年度以降入学（新学科）」
 *  - 区分なしの学校は従来通り flat リスト
 *
 * 使い方: 既存 Onboarding.tsx の <select id="department"> 部分を
 * 下記の DepartmentSelect コンポーネントで置き換えてください。
 */
'use client';

import React from 'react';
import { KosenSchool, getDepartmentDisplayNames, DepartmentEra } from '@/lib/kosenList';

interface DepartmentSelectProps {
  school: KosenSchool | undefined;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * 学科選択セレクトボックス
 * - era が混在する学校（長野高専など）は optgroup で新旧を分離して表示
 * - era が存在しない学校は通常の flat リスト
 */
export function DepartmentSelect({
  school,
  value,
  onChange,
  disabled,
}: DepartmentSelectProps) {
  if (!school) {
    return (
      <select
        disabled
        className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm bg-slate-100 cursor-not-allowed"
      >
        <option value="">先に学校を選択してください</option>
      </select>
    );
  }

  const departments = getDepartmentDisplayNames(school);
  const hasEra = departments.some((d) => d.era !== undefined);

  return (
    <select
      id="department"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
    >
      <option value="">学科・系を選択してください</option>

      {hasEra ? (
        // ---- 新旧区分あり（長野高専など）----
        <>
          {/* 令和4年度以降（新学科） */}
          {departments.filter((d) => d.era === 'current').length > 0 && (
            <optgroup label="▼ 令和4年度以降入学（新カリキュラム）">
              {departments
                .filter((d) => d.era === 'current')
                .map((d) => (
                  <option key={d.value} value={d.value} title={d.note}>
                    {d.label}
                  </option>
                ))}
            </optgroup>
          )}

          {/* 令和3年度以前（旧学科） */}
          {departments.filter((d) => d.era === 'legacy').length > 0 && (
            <optgroup label="▼ 令和3年度以前入学（旧カリキュラム）">
              {departments
                .filter((d) => d.era === 'legacy')
                .map((d) => (
                  <option key={d.value} value={d.value} title={d.note}>
                    {d.label}
                  </option>
                ))}
            </optgroup>
          )}

          {/* 区分なし（共通科目等） */}
          {departments.filter((d) => d.era === undefined).length > 0 && (
            <optgroup label="▼ 共通">
              {departments
                .filter((d) => d.era === undefined)
                .map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
            </optgroup>
          )}
        </>
      ) : (
        // ---- 区分なし（通常の学校）----
        departments.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
            {d.note ? ` （${d.note}）` : ''}
          </option>
        ))
      )}
    </select>
  );
}

// -----------------------------------------------------------------------
// 使用例（Onboarding.tsx の Step 1 内での差し替え箇所）
// -----------------------------------------------------------------------
/*
// 既存:
import { getSchoolsByRegion } from '@/lib/kosenList';

// 変更後:
import { getSchoolsByRegion, getSchoolById } from '@/lib/kosenList';
import { DepartmentSelect } from '@/components/DepartmentSelect'; // このファイル

// Step 1 の学科 <select> を以下に置き換え:
<DepartmentSelect
  school={availableSchools.find(s => s.id === selectedSchoolId)}
  value={schoolInfo.department}
  onChange={(val) => setSchoolInfo({ ...schoolInfo, department: val })}
  disabled={!selectedSchoolId}
/>
*/
