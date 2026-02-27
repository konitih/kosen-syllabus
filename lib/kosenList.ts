/**
 * lib/kosenList.ts
 *
 * 国立高等専門学校機構（NIT）全51校のデータ
 * 出典: https://syllabus.kosen-k.go.jp/Pages/PublicDepartments?school_id=XX
 *
 * ─ 重要 ─────────────────────────────────────────────────────────────────
 *  departments は Department[]（オブジェクト配列）です。
 *  JSX で描画するときは必ず dept.name を参照してください。
 *    ✅ <option value={dept.name}>{dept.label ?? dept.name}</option>
 *    ❌ <option value={dept}>{dept}</option>   ← React クラッシュ
 *
 *  スクレイピングURL構築には departmentId を使います。
 *    https://syllabus.kosen-k.go.jp/Pages/PublicSubjects
 *      ?school_id={school.syllabusId}&department_id={dept.departmentId}&year={year}
 * ────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

/** 新旧カリキュラム区分 */
export type DepartmentEra = 'legacy' | 'current';

export interface Department {
  /** アプリ内部キー・URLのdepartment名として使用（一意） */
  name: string;
  /**
   * 公式シラバスシステムの department_id パラメータ（数値）
   * URL: /Pages/PublicSubjects?school_id=XX&department_id=XX&year=XX
   */
  departmentId?: number;
  /** UI表示ラベル（省略時は name を使用） */
  label?: string;
  /** 補足情報（キャンパス名・系の説明など） */
  note?: string;
  /** 'legacy'=旧課程 / 'current'=新課程 / undefined=区分なし */
  era?: DepartmentEra;
}

export interface KosenSchool {
  /** アプリ内部 ID */
  id: string;
  /**
   * 公式シラバスシステムの school_id パラメータ（文字列）
   * URL: /Pages/PublicSubjects?school_id=XX&...
   */
  syllabusId?: string;
  /** 正式名称 */
  name: string;
  /** 通称 */
  shortName: string;
  /** 地区（機構公式8地区区分） */
  region: string;
  /** 都道府県 */
  prefecture: string;
  /** 学科リスト */
  departments: Department[];
  /**
   * 旧カリキュラムの最終入学年度
   * この値以前に入学した学生は era:'legacy' の学科に所属
   * 例: 2021 → 2021年度以前入学 = 旧課程
   */
  legacyCutoffYear?: number;
  /** マルチキャンパス校のキャンパス名 */
  campuses?: string[];
}

// ─────────────────────────────────────────────
// ユーティリティ関数
// ─────────────────────────────────────────────

/** 全地区名（重複なし） */
export function getAllRegions(): string[] {
  return [...new Set(KOSEN_SCHOOLS.map((s) => s.region))];
}

/** 地区で学校を絞り込む */
export function getSchoolsByRegion(region: string): KosenSchool[] {
  return KOSEN_SCHOOLS.filter((s) => s.region === region);
}

/** ID で学校を検索 */
export function getSchoolById(id: string): KosenSchool | undefined {
  return KOSEN_SCHOOLS.find((s) => s.id === id);
}

/** 名前（正式・通称）で学校を検索 */
export function getSchoolByName(name: string): KosenSchool | undefined {
  return KOSEN_SCHOOLS.find((s) => s.name === name || s.shortName === name);
}

/**
 * 学科名の文字列配列を返す（後方互換ヘルパー）
 * Onboarding などで文字列として扱う場合に使う
 */
export function getDepartmentNames(school: KosenSchool): string[] {
  return school.departments.map((d) => d.name);
}

/**
 * UI 表示用の学科情報を返す
 * <option value={item.value}>{item.label}</option> として使用
 */
export function getDepartmentDisplayNames(school: KosenSchool): {
  value: string;
  label: string;
  era?: DepartmentEra;
  note?: string;
}[] {
  return school.departments.map((d) => ({
    value: d.name,
    label: d.label ?? d.name,
    era: d.era,
    note: d.note,
  }));
}

/**
 * 入学年度に応じた学科リストを返す
 * @param school 対象校
 * @param entryYear 入学年度（西暦）
 */
export function getDepartmentsForYear(
  school: KosenSchool,
  entryYear: number
): Department[] {
  if (!school.legacyCutoffYear) return school.departments;
  if (entryYear <= school.legacyCutoffYear) {
    return school.departments.filter((d) => d.era === 'legacy' || !d.era);
  }
  return school.departments.filter((d) => d.era === 'current' || !d.era);
}

/**
 * 学科名から departmentId を取得する
 * スクレイピングURL構築に使用
 */
export function getDepartmentId(
  school: KosenSchool,
  departmentName: string
): number | undefined {
  const dept = school.departments.find(
    (d) => d.name === departmentName ||
           (d.label && d.label === departmentName)
  );
  return dept?.departmentId;
}

// ─────────────────────────────────────────────
// 学校データ（全 51 校）
// department_id は https://syllabus.kosen-k.go.jp/Pages/PublicDepartments?school_id=XX
// で確認した公式値を使用
// ─────────────────────────────────────────────

export const KOSEN_SCHOOLS: KosenSchool[] = [
  // ══════════════════════════════════════════
  // 北海道地区（4校）
  // ══════════════════════════════════════════
  {
    id: 'hakodate',
    syllabusId: '01',
    name: '函館工業高等専門学校',
    shortName: '函館高専',
    region: '北海道',
    prefecture: '北海道',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '物質環境工学科', departmentId: 4 },
      { name: '建築学科', departmentId: 5 },
    ],
  },
  {
    id: 'tomakomai',
    syllabusId: '02',
    name: '苫小牧工業高等専門学校',
    shortName: '苫小牧高専',
    region: '北海道',
    prefecture: '北海道',
    departments: [
      { name: '創造工学科（機械系）', departmentId: 1 },
      { name: '創造工学科（電気電子系）', departmentId: 2 },
      { name: '創造工学科（情報系）', departmentId: 3 },
      { name: '創造工学科（建設系）', departmentId: 4 },
      { name: '創造工学科（応用化学系）', departmentId: 5 },
    ],
  },
  {
    id: 'kushiro',
    syllabusId: '03',
    name: '釧路工業高等専門学校',
    shortName: '釧路高専',
    region: '北海道',
    prefecture: '北海道',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気工学科', departmentId: 2 },
      { name: '電子工学科', departmentId: 3 },
      { name: '情報工学科', departmentId: 4 },
      { name: '環境都市工学科', departmentId: 5 },
    ],
  },
  {
    id: 'asahikawa',
    syllabusId: '04',
    name: '旭川工業高等専門学校',
    shortName: '旭川高専',
    region: '北海道',
    prefecture: '北海道',
    departments: [
      { name: '機械システム工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '物質化学工学科', departmentId: 3 },
      { name: '建設システム工学科', departmentId: 4 },
    ],
  },

  // ══════════════════════════════════════════
  // 東北地区（6校）
  // ══════════════════════════════════════════
  {
    id: 'hachinohe',
    syllabusId: '05',
    name: '八戸工業高等専門学校',
    shortName: '八戸高専',
    region: '東北',
    prefecture: '青森県',
    departments: [
      { name: '産業システム工学科（機械・ロボット系）', departmentId: 1 },
      { name: '産業システム工学科（電気情報系）', departmentId: 2 },
      { name: '産業システム工学科（材料・バイオ系）', departmentId: 3 },
      { name: '産業システム工学科（建設・環境系）', departmentId: 4 },
    ],
  },
  {
    id: 'ichinoseki',
    syllabusId: '06',
    name: '一関工業高等専門学校',
    shortName: '一関高専',
    region: '東北',
    prefecture: '岩手県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '制御情報工学科', departmentId: 3 },
      { name: '物質化学工学科', departmentId: 4 },
      { name: '建設環境工学科', departmentId: 5 },
    ],
  },
  {
    id: 'sendai',
    syllabusId: '07',
    name: '仙台高等専門学校',
    shortName: '仙台高専',
    region: '東北',
    prefecture: '宮城県',
    campuses: ['名取キャンパス', '広瀬キャンパス'],
    departments: [
      { name: '機械工学科', departmentId: 1, note: '名取キャンパス' },
      { name: '建築デザイン学科', departmentId: 2, note: '名取キャンパス' },
      { name: '総合科学科', departmentId: 3, note: '名取キャンパス' },
      { name: '情報システム工学科', departmentId: 4, note: '広瀬キャンパス' },
      { name: 'コミュニケーション情報学科', departmentId: 5, note: '広瀬キャンパス' },
      { name: '電子工学科', departmentId: 6, note: '広瀬キャンパス' },
    ],
  },
  {
    id: 'akita',
    syllabusId: '08',
    name: '秋田工業高等専門学校',
    shortName: '秋田高専',
    region: '東北',
    prefecture: '秋田県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '物質工学科', departmentId: 3 },
      { name: 'システムデザイン工学科', departmentId: 4 },
    ],
  },
  {
    id: 'tsuruoka',
    syllabusId: '09',
    name: '鶴岡工業高等専門学校',
    shortName: '鶴岡高専',
    region: '東北',
    prefecture: '山形県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '創造工学科', departmentId: 4 },
    ],
  },
  {
    id: 'fukushima',
    syllabusId: '10',
    name: '福島工業高等専門学校',
    shortName: '福島高専',
    region: '東北',
    prefecture: '福島県',
    departments: [
      { name: '機械システム工学科', departmentId: 1 },
      { name: '電気電子システム工学科', departmentId: 2 },
      { name: '電子情報工学科', departmentId: 3 },
      { name: 'コミュニケーション工学科', departmentId: 4 },
      { name: '都市システム工学科', departmentId: 5 },
    ],
  },

  // ══════════════════════════════════════════
  // 関東信越地区（7校）
  // ══════════════════════════════════════════
  {
    id: 'ibaraki',
    syllabusId: '11',
    name: '茨城工業高等専門学校',
    shortName: '茨城高専',
    region: '関東信越',
    prefecture: '茨城県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子システム工学科', departmentId: 2 },
      { name: '電子情報工学科', departmentId: 3 },
      { name: '都市システム工学科', departmentId: 4 },
      { name: '材料工学科', departmentId: 5 },
    ],
  },
  {
    id: 'oyama',
    syllabusId: '12',
    name: '小山工業高等専門学校',
    shortName: '小山高専',
    region: '関東信越',
    prefecture: '栃木県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子創造工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '建築学科', departmentId: 5 },
    ],
  },
  {
    id: 'gunma',
    syllabusId: '13',
    name: '群馬工業高等専門学校',
    shortName: '群馬高専',
    region: '関東信越',
    prefecture: '群馬県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '電子情報工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '環境都市工学科', departmentId: 5 },
    ],
  },
  {
    id: 'kisarazu',
    syllabusId: '14',
    name: '木更津工業高等専門学校',
    shortName: '木更津高専',
    region: '関東信越',
    prefecture: '千葉県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '環境都市工学科', departmentId: 4 },
      { name: 'サイエンス・クリエイティブ工学科', departmentId: 5 },
    ],
  },
  {
    id: 'tokyo',
    syllabusId: '15',
    name: '東京工業高等専門学校',
    shortName: '東京高専',
    region: '関東信越',
    prefecture: '東京都',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: 'デザイン学科', departmentId: 5 },
    ],
  },
  {
    id: 'nagaoka',
    syllabusId: '16',
    name: '長岡工業高等専門学校',
    shortName: '長岡高専',
    region: '関東信越',
    prefecture: '新潟県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子システム工学科', departmentId: 2 },
      { name: '電子制御工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '環境都市工学科', departmentId: 5 },
    ],
  },

  // ──────────────────────────────────────────
  // ★ 長野工業高等専門学校
  //
  //  school_id = 20（公式確認済み）
  //
  //  department_id 一覧（公式サイト確認済み）:
  //  https://syllabus.kosen-k.go.jp/Pages/PublicDepartments?school_id=20
  //
  //  【旧5学科（令和3年度以前入学 = era:'legacy'）】
  //    11 = 機械工学科
  //    12 = 電気電子工学科
  //    13 = 電子制御工学科
  //    14 = 電子情報工学科
  //    15 = 環境都市工学科
  //    16 = 一般科（旧）
  //
  //  【新課程（令和4年度以降入学 = era:'current'）】
  //    31 = 工学科（専門科目：情報エレクトロニクス系）
  //    32 = 工学科（専門科目：機械ロボティクス系）
  //    33 = 工学科（専門科目：都市デザイン系）
  //    34 = 工学科（専門科目：全系共通）
  //    35 = 工学科（一般科目：全系共通）
  // ──────────────────────────────────────────
  {
    id: 'nagano',
    syllabusId: '20',
    name: '長野工業高等専門学校',
    shortName: '長野高専',
    region: '関東信越',
    prefecture: '長野県',
    legacyCutoffYear: 2021, // 2021年度以前入学 = 旧5学科
    departments: [
      // ─── 令和4年度以降（新課程・era:'current'） ────
      {
        name: '情報エレクトロニクス系',
        departmentId: 31,
        label: '情報エレクトロニクス系（IE系）',
        note: '専門科目（2年次以降）/ 情報・電気・電子分野',
        era: 'current',
      },
      {
        name: '機械ロボティクス系',
        departmentId: 32,
        label: '機械ロボティクス系（MR系）',
        note: '専門科目（2年次以降）/ 機械・ロボット分野',
        era: 'current',
      },
      {
        name: '都市デザイン系',
        departmentId: 33,
        label: '都市デザイン系（CE系）',
        note: '専門科目（2年次以降）/ 土木・建築・環境分野',
        era: 'current',
      },
      {
        name: '工学科（全系共通・専門）',
        departmentId: 34,
        label: '全系共通 専門科目',
        note: '工学科 全系共通の専門科目',
        era: 'current',
      },
      {
        name: '工学科（全系共通・一般）',
        departmentId: 35,
        label: '全系共通 一般科目',
        note: '工学科 全系共通の一般科目（1年次〜）',
        era: 'current',
      },
      // ─── 令和3年度以前（旧5学科・era:'legacy'） ────
      {
        name: '機械工学科',
        departmentId: 11,
        label: '機械工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '電気電子工学科',
        departmentId: 12,
        label: '電気電子工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '電子制御工学科',
        departmentId: 13,
        label: '電子制御工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '電子情報工学科',
        departmentId: 14,
        label: '電子情報工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '環境都市工学科',
        departmentId: 15,
        label: '環境都市工学科（令和3年度以前入学）',
        era: 'legacy',
      },
    ],
  },

  // ══════════════════════════════════════════
  // 東海北陸地区（8校）
  // ══════════════════════════════════════════
  {
    id: 'toyama',
    syllabusId: '21',
    name: '富山高等専門学校',
    shortName: '富山高専',
    region: '東海北陸',
    prefecture: '富山県',
    campuses: ['本郷キャンパス', '射水キャンパス'],
    departments: [
      { name: '機械システム工学科', departmentId: 1, note: '本郷キャンパス' },
      { name: '電気制御システム工学科', departmentId: 2, note: '本郷キャンパス' },
      { name: '情報デザイン学科', departmentId: 3, note: '本郷キャンパス' },
      { name: '物質化学工学科', departmentId: 4, note: '本郷キャンパス' },
      { name: '環境都市工学科', departmentId: 5, note: '本郷キャンパス' },
      { name: '商船学科', departmentId: 6, note: '射水キャンパス' },
      { name: '電子情報工学科', departmentId: 7, note: '射水キャンパス' },
      { name: '産業システム工学科', departmentId: 8, note: '射水キャンパス' },
    ],
  },
  {
    id: 'ishikawa',
    syllabusId: '22',
    name: '石川工業高等専門学校',
    shortName: '石川高専',
    region: '東海北陸',
    prefecture: '石川県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気工学科', departmentId: 2 },
      { name: '電子情報工学科', departmentId: 3 },
      { name: '環境都市工学科', departmentId: 4 },
      { name: '物質化学工学科', departmentId: 5 },
    ],
  },
  {
    id: 'fukui',
    syllabusId: '23',
    name: '福井工業高等専門学校',
    shortName: '福井高専',
    region: '東海北陸',
    prefecture: '福井県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '環境都市工学科', departmentId: 5 },
    ],
  },
  {
    id: 'gifu',
    syllabusId: '24',
    name: '岐阜工業高等専門学校',
    shortName: '岐阜高専',
    region: '東海北陸',
    prefecture: '岐阜県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '電子制御工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '建築学科', departmentId: 5 },
      { name: '環境都市工学科', departmentId: 6 },
    ],
  },
  {
    id: 'numazu',
    syllabusId: '25',
    name: '沼津工業高等専門学校',
    shortName: '沼津高専',
    region: '東海北陸',
    prefecture: '静岡県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '制御情報工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '土木工学科', departmentId: 5 },
    ],
  },
  {
    id: 'toyota',
    syllabusId: '26',
    name: '豊田工業高等専門学校',
    shortName: '豊田高専',
    region: '東海北陸',
    prefecture: '愛知県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気・電子システム工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '環境都市工学科', departmentId: 5 },
      { name: '建築学科', departmentId: 6 },
    ],
  },
  {
    id: 'toba',
    syllabusId: '27',
    name: '鳥羽商船高等専門学校',
    shortName: '鳥羽商船高専',
    region: '東海北陸',
    prefecture: '三重県',
    departments: [
      { name: '商船学科', departmentId: 1 },
      { name: '電子機械工学科', departmentId: 2 },
      { name: '情報機械システム工学科', departmentId: 3 },
    ],
  },
  {
    id: 'suzuka',
    syllabusId: '28',
    name: '鈴鹿工業高等専門学校',
    shortName: '鈴鹿高専',
    region: '東海北陸',
    prefecture: '三重県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '電子情報工学科', departmentId: 3 },
      { name: '材料工学科', departmentId: 4 },
      { name: '建築学科', departmentId: 5 },
      { name: '生物応用化学科', departmentId: 6 },
    ],
  },

  // ══════════════════════════════════════════
  // 近畿地区（4校）
  // ══════════════════════════════════════════
  {
    id: 'maizuru',
    syllabusId: '29',
    name: '舞鶴工業高等専門学校',
    shortName: '舞鶴高専',
    region: '近畿',
    prefecture: '京都府',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '建設システム工学科', departmentId: 3 },
      { name: 'ソーシャルデザイン工学科', departmentId: 4 },
    ],
  },
  {
    id: 'akashi',
    syllabusId: '30',
    name: '明石工業高等専門学校',
    shortName: '明石高専',
    region: '近畿',
    prefecture: '兵庫県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '都市システム工学科', departmentId: 3 },
      { name: '建築学科', departmentId: 4 },
      { name: '機械・電子システム工学科', departmentId: 5 },
    ],
  },
  {
    id: 'nara',
    syllabusId: '31',
    name: '奈良工業高等専門学校',
    shortName: '奈良高専',
    region: '近畿',
    prefecture: '奈良県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気工学科', departmentId: 2 },
      { name: '電子制御工学科', departmentId: 3 },
      { name: '情報工学科', departmentId: 4 },
      { name: '物質化学工学科', departmentId: 5 },
    ],
  },
  {
    id: 'wakayama',
    syllabusId: '32',
    name: '和歌山工業高等専門学校',
    shortName: '和歌山高専',
    region: '近畿',
    prefecture: '和歌山県',
    departments: [
      { name: '機械・精密システム工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '環境都市工学科', departmentId: 3 },
      { name: '生物応用化学科', departmentId: 4 },
    ],
  },

  // ══════════════════════════════════════════
  // 中国地区（8校）
  // ══════════════════════════════════════════
  {
    id: 'yonago',
    syllabusId: '33',
    name: '米子工業高等専門学校',
    shortName: '米子高専',
    region: '中国',
    prefecture: '鳥取県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '電子制御工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '建築学科', departmentId: 5 },
    ],
  },
  {
    id: 'matsue',
    syllabusId: '34',
    name: '松江工業高等専門学校',
    shortName: '松江高専',
    region: '中国',
    prefecture: '島根県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '電子制御工学科', departmentId: 3 },
      { name: '情報工学科', departmentId: 4 },
      { name: '環境・建設工学科', departmentId: 5 },
    ],
  },
  {
    id: 'tsuyama',
    syllabusId: '35',
    name: '津山工業高等専門学校',
    shortName: '津山高専',
    region: '中国',
    prefecture: '岡山県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '総合理工学科（建設系）', departmentId: 4 },
      { name: '総合理工学科（生物・化学系）', departmentId: 5 },
    ],
  },
  {
    id: 'hiroshima-shosen',
    syllabusId: '36',
    name: '広島商船高等専門学校',
    shortName: '広島商船高専',
    region: '中国',
    prefecture: '広島県',
    departments: [
      { name: '商船学科', departmentId: 1 },
      { name: '電子制御工学科', departmentId: 2 },
      { name: '流通情報工学科', departmentId: 3 },
    ],
  },
  {
    id: 'kure',
    syllabusId: '37',
    name: '呉工業高等専門学校',
    shortName: '呉高専',
    region: '中国',
    prefecture: '広島県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '環境都市工学科', departmentId: 3 },
      { name: '建築学科', departmentId: 4 },
      { name: '生命医療工学科', departmentId: 5 },
    ],
  },
  {
    id: 'tokuyama',
    syllabusId: '38',
    name: '徳山工業高等専門学校',
    shortName: '徳山高専',
    region: '中国',
    prefecture: '山口県',
    departments: [
      { name: '機械電気工学科', departmentId: 1 },
      { name: '情報電子工学科', departmentId: 2 },
      { name: '土木建築工学科', departmentId: 3 },
      { name: '応用化学科', departmentId: 4 },
    ],
  },
  {
    id: 'ube',
    syllabusId: '39',
    name: '宇部工業高等専門学校',
    shortName: '宇部高専',
    region: '中国',
    prefecture: '山口県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気工学科', departmentId: 2 },
      { name: '物質工学科', departmentId: 3 },
      { name: '経営情報学科', departmentId: 4 },
    ],
  },
  {
    id: 'oshima',
    syllabusId: '40',
    name: '大島商船高等専門学校',
    shortName: '大島商船高専',
    region: '中国',
    prefecture: '山口県',
    departments: [
      { name: '商船学科', departmentId: 1 },
      { name: '電子機械工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
    ],
  },

  // ══════════════════════════════════════════
  // 四国地区（5校）
  // ══════════════════════════════════════════
  {
    id: 'anan',
    syllabusId: '41',
    name: '阿南工業高等専門学校',
    shortName: '阿南高専',
    region: '四国',
    prefecture: '徳島県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報コミュニケーション工学科', departmentId: 3 },
      { name: '化学技術学科', departmentId: 4 },
      { name: '創造技術工学科', departmentId: 5 },
    ],
  },
  {
    id: 'kagawa',
    syllabusId: '42',
    name: '香川高等専門学校',
    shortName: '香川高専',
    region: '四国',
    prefecture: '香川県',
    campuses: ['高松キャンパス', '詫間キャンパス'],
    departments: [
      { name: '機械電子工学科', departmentId: 1, note: '高松キャンパス' },
      { name: '電気情報工学科', departmentId: 2, note: '高松キャンパス' },
      { name: '建設環境工学科', departmentId: 3, note: '高松キャンパス' },
      { name: '創造工学科', departmentId: 4, note: '高松キャンパス' },
      { name: '情報工学科', departmentId: 5, note: '詫間キャンパス' },
      { name: '通信ネットワーク工学科', departmentId: 6, note: '詫間キャンパス' },
    ],
  },
  {
    id: 'niihama',
    syllabusId: '43',
    name: '新居浜工業高等専門学校',
    shortName: '新居浜高専',
    region: '四国',
    prefecture: '愛媛県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '電子制御工学科', departmentId: 3 },
      { name: '環境材料工学科', departmentId: 4 },
    ],
  },
  {
    id: 'yuge',
    syllabusId: '44',
    name: '弓削商船高等専門学校',
    shortName: '弓削商船高専',
    region: '四国',
    prefecture: '愛媛県',
    departments: [
      { name: '商船学科', departmentId: 1 },
      { name: '電子機械工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '総合通信科', departmentId: 4 },
    ],
  },
  {
    id: 'kochi',
    syllabusId: '45',
    name: '高知工業高等専門学校',
    shortName: '高知高専',
    region: '四国',
    prefecture: '高知県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: 'ソーシャルデザイン工学科', departmentId: 3 },
    ],
  },

  // ══════════════════════════════════════════
  // 九州・沖縄地区（9校）
  // ══════════════════════════════════════════
  {
    id: 'kurume',
    syllabusId: '46',
    name: '久留米工業高等専門学校',
    shortName: '久留米高専',
    region: '九州・沖縄',
    prefecture: '福岡県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '制御情報工学科', departmentId: 3 },
      { name: '材料工学科', departmentId: 4 },
      { name: '生物応用化学科', departmentId: 5 },
    ],
  },
  {
    id: 'ariake',
    syllabusId: '47',
    name: '有明工業高等専門学校',
    shortName: '有明高専',
    region: '九州・沖縄',
    prefecture: '福岡県',
    departments: [
      { name: '機械・制御システム工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '創造工学科（物質・環境系）', departmentId: 3 },
      { name: '創造工学科（建設・環境系）', departmentId: 4 },
    ],
  },
  {
    id: 'kitakyushu',
    syllabusId: '48',
    name: '北九州工業高等専門学校',
    shortName: '北九州高専',
    region: '九州・沖縄',
    prefecture: '福岡県',
    departments: [
      { name: '生産デザイン工学科（機械・知能システムコース）', departmentId: 1 },
      { name: '生産デザイン工学科（電気・情報コース）', departmentId: 2 },
      { name: '生産デザイン工学科（物質化学コース）', departmentId: 3 },
      { name: '生産デザイン工学科（環境・建設コース）', departmentId: 4 },
    ],
  },
  {
    id: 'sasebo',
    syllabusId: '49',
    name: '佐世保工業高等専門学校',
    shortName: '佐世保高専',
    region: '九州・沖縄',
    prefecture: '長崎県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '物質工学科', departmentId: 4 },
      { name: '都市・環境デザイン工学科', departmentId: 5 },
    ],
  },
  {
    id: 'kumamoto',
    syllabusId: '50',
    name: '熊本高等専門学校',
    shortName: '熊本高専',
    region: '九州・沖縄',
    prefecture: '熊本県',
    campuses: ['熊本キャンパス', '八代キャンパス'],
    departments: [
      { name: '情報通信エレクトロニクス工学科', departmentId: 1, note: '熊本キャンパス' },
      { name: '知能情報工学科', departmentId: 2, note: '熊本キャンパス' },
      { name: '生物化学システム工学科', departmentId: 3, note: '熊本キャンパス' },
      { name: '機械知能システム工学科', departmentId: 4, note: '八代キャンパス' },
      { name: '電気情報工学科', departmentId: 5, note: '八代キャンパス' },
      { name: '建築社会デザイン工学科', departmentId: 6, note: '八代キャンパス' },
    ],
  },
  {
    id: 'oita',
    syllabusId: '51',
    name: '大分工業高等専門学校',
    shortName: '大分高専',
    region: '九州・沖縄',
    prefecture: '大分県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '都市・環境工学科', departmentId: 4 },
      { name: '創造工学科', departmentId: 5 },
    ],
  },
  {
    id: 'miyakonojo',
    syllabusId: '52',
    name: '都城工業高等専門学校',
    shortName: '都城高専',
    region: '九州・沖縄',
    prefecture: '宮崎県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気情報工学科', departmentId: 2 },
      { name: '物質工学科', departmentId: 3 },
      { name: '建築学科', departmentId: 4 },
      { name: '都市・環境デザイン工学科', departmentId: 5 },
    ],
  },
  {
    id: 'kagoshima',
    syllabusId: '53',
    name: '鹿児島工業高等専門学校',
    shortName: '鹿児島高専',
    region: '九州・沖縄',
    prefecture: '鹿児島県',
    departments: [
      { name: '機械工学科', departmentId: 1 },
      { name: '電気電子工学科', departmentId: 2 },
      { name: '情報工学科', departmentId: 3 },
      { name: '都市・建築デザイン工学科', departmentId: 4 },
    ],
  },
  {
    id: 'okinawa',
    syllabusId: '54',
    name: '沖縄工業高等専門学校',
    shortName: '沖縄高専',
    region: '九州・沖縄',
    prefecture: '沖縄県',
    departments: [
      { name: 'メディア情報工学科', departmentId: 1 },
      { name: '生物資源工学科', departmentId: 2 },
      { name: '機械システム工学科', departmentId: 3 },
      { name: '電気システム工学科', departmentId: 4 },
      { name: '都市環境工学科', departmentId: 5 },
    ],
  },
];
