/**
 * lib/kosenList.ts
 *
 * 国立高等専門学校機構（NIT）に属する全51校の情報
 *
 * ソース:
 *   - 校名・地区分類: https://www.kosen-k.go.jp/nationwide/all_kosen_linkmap
 *   - 長野高専学科情報: https://www.nagano-nct.ac.jp/course
 *
 * ⚠️ 注意:
 *   各校の学科名は学科改組により変更される場合があります。
 *   本ファイルは令和7年（2025年）現在の情報を基に作成しています。
 *   特に長野高専は令和4年度（2022年）より学科を「工学科」に再編しています。
 */

// -----------------------------------------------------------------------
// 型定義
// -----------------------------------------------------------------------

/**
 * 入学年度による学科区分
 * - 'legacy': 旧カリキュラム（特定年度以前の入学生）
 * - 'current': 新カリキュラム（特定年度以降の入学生）
 * - undefined: 区分なし（年度による差異がない学校）
 */
export type DepartmentEra = 'legacy' | 'current';

export interface Department {
  /** シラバスシステムや一般表示に使う学科名 */
  name: string;
  /** UIに表示するラベル（省略時は name を使用） */
  label?: string;
  /** 補足情報（例: "2年次以降に系を選択"） */
  note?: string;
  /** 旧/新区分 */
  era?: DepartmentEra;
}

export interface KosenSchool {
  /** アプリ内部ID（英数字小文字） */
  id: string;
  /**
   * シラバスシステム（syllabus.kosen-k.go.jp）の school_id
   * 不明な場合は undefined — 実際の値は各校シラバスURLから確認してください
   */
  syllabusId?: string;
  /** 正式名称 */
  name: string;
  /** 通称（高専名） */
  shortName: string;
  /** 地区（機構の公式区分） */
  region: string;
  /** 都道府県 */
  prefecture: string;
  /** 学科リスト */
  departments: Department[];
  /**
   * 旧カリキュラムが適用される最終入学年度
   * 例: 2021 → 2021年度以前に入学した学生は legacyDepartments を参照
   */
  legacyCutoffYear?: number;
  /** マルチキャンパス校の場合のキャンパス名 */
  campuses?: string[];
}

// -----------------------------------------------------------------------
// ユーティリティ関数
// -----------------------------------------------------------------------

/** 全地区名を重複なしで返す */
export function getAllRegions(): string[] {
  return [...new Set(KOSEN_SCHOOLS.map((s) => s.region))];
}

/** 指定地区の学校一覧を返す */
export function getSchoolsByRegion(region: string): KosenSchool[] {
  return KOSEN_SCHOOLS.filter((s) => s.region === region);
}

/** IDで学校を検索 */
export function getSchoolById(id: string): KosenSchool | undefined {
  return KOSEN_SCHOOLS.find((s) => s.id === id);
}

/** 名前で学校を検索 */
export function getSchoolByName(name: string): KosenSchool | undefined {
  return KOSEN_SCHOOLS.find((s) => s.name === name || s.shortName === name);
}

/**
 * 指定年度に入学した学生向けの学科リストを返す
 * @param school 対象校
 * @param entryYear 入学年度（例: 2024）
 */
export function getDepartmentsForYear(
  school: KosenSchool,
  entryYear: number
): Department[] {
  if (!school.legacyCutoffYear) {
    // 区分なし → 全学科を返す
    return school.departments;
  }

  if (entryYear <= school.legacyCutoffYear) {
    // 旧カリキュラム
    return school.departments.filter(
      (d) => d.era === 'legacy' || d.era === undefined
    );
  } else {
    // 新カリキュラム
    return school.departments.filter(
      (d) => d.era === 'current' || d.era === undefined
    );
  }
}

/**
 * UI表示用の学科名一覧を返す（label があれば label、なければ name）
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

// -----------------------------------------------------------------------
// 学校データ（全51校）
// -----------------------------------------------------------------------

export const KOSEN_SCHOOLS: KosenSchool[] = [
  // ====================================================================
  // 北海道地区（4校）
  // ====================================================================
  {
    id: 'hakodate',
    syllabusId: '01',
    name: '函館工業高等専門学校',
    shortName: '函館高専',
    region: '北海道',
    prefecture: '北海道',
    departments: [
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: '物質環境工学科' },
      { name: '建築学科' },
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
      { name: '創造工学科（機械系）' },
      { name: '創造工学科（電気電子系）' },
      { name: '創造工学科（情報系）' },
      { name: '創造工学科（建設系）' },
      { name: '創造工学科（応用化学系）' },
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
      { name: '機械工学科' },
      { name: '電気工学科' },
      { name: '電子工学科' },
      { name: '情報工学科' },
      { name: '環境都市工学科' },
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
      { name: '機械システム工学科' },
      { name: '電気情報工学科' },
      { name: '物質化学工学科' },
      { name: '建設システム工学科' },
    ],
  },

  // ====================================================================
  // 東北地区（6校）
  // ====================================================================
  {
    id: 'hachinohe',
    syllabusId: '05',
    name: '八戸工業高等専門学校',
    shortName: '八戸高専',
    region: '東北',
    prefecture: '青森県',
    departments: [
      { name: '産業システム工学科（機械・ロボット系）' },
      { name: '産業システム工学科（電気情報系）' },
      { name: '産業システム工学科（材料・バイオ系）' },
      { name: '産業システム工学科（建設・環境系）' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '制御情報工学科' },
      { name: '物質化学工学科' },
      { name: '建設環境工学科' },
    ],
  },
  {
    id: 'sendai',
    syllabusId: '07',
    name: '仙台高等専門学校',
    shortName: '仙台高専',
    region: '東北',
    prefecture: '宮城県',
    campuses: ['名取キャンパス（旧・宮城工業高専）', '広瀬キャンパス（旧・仙台電波高専）'],
    departments: [
      // 名取キャンパス
      { name: '機械工学科', note: '名取キャンパス' },
      { name: '建築デザイン学科', note: '名取キャンパス' },
      { name: '総合科学科', note: '名取キャンパス' },
      // 広瀬キャンパス
      { name: '情報システム工学科', note: '広瀬キャンパス' },
      { name: 'コミュニケーション情報学科', note: '広瀬キャンパス' },
      { name: '電子工学科', note: '広瀬キャンパス' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '物質工学科' },
      { name: 'システムデザイン工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: ' 創造工学科' },
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
      { name: '機械システム工学科' },
      { name: '電気電子システム工学科' },
      { name: '電子情報工学科' },
      { name: 'コミュニケーション工学科' },
      { name: '都市システム工学科' },
    ],
  },

  // ====================================================================
  // 関東信越地区（7校）
  // ====================================================================
  {
    id: 'ibaraki',
    syllabusId: '11',
    name: '茨城工業高等専門学校',
    shortName: '茨城高専',
    region: '関東信越',
    prefecture: '茨城県',
    departments: [
      { name: '機械工学科' },
      { name: '電気電子システム工学科' },
      { name: '電子情報工学科' },
      { name: '都市システム工学科' },
      { name: '材料工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子創造工学科' },
      { name: '情報工学科' },
      { name: '物質工学科' },
      { name: '建築学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '電子情報工学科' },
      { name: '物質工学科' },
      { name: '環境都市工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: '環境都市工学科' },
      { name: 'サイエンス・クリエイティブ工学科' },
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
      { name: '機械工学科' },
      { name: '電気工学科' },
      { name: '情報工学科' },
      { name: '物質工学科' },
      { name: 'デザイン学科' },
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
      { name: '機械工学科' },
      { name: '電気電子システム工学科' },
      { name: '電子制御工学科' },
      { name: '物質工学科' },
      { name: '環境都市工学科' },
    ],
  },

  // ------------------------------------------------------------------
  // 長野工業高等専門学校（最重要校 — 新旧学科両対応）
  // ------------------------------------------------------------------
  {
    id: 'nagano',
    syllabusId: '20',
    name: '長野工業高等専門学校',
    shortName: '長野高専',
    region: '関東信越',
    prefecture: '長野県',
    /**
     * 令和3年度（2021年度）を最終入学年度とする旧5学科カリキュラム
     * 令和4年度（2022年度）以降は工学科1学科3系へ再編
     */
    legacyCutoffYear: 2021,
    departments: [
      // ---- 令和4年度（2022年度）以降の入学生 ----
      {
        name: '工学科',
        label: '工学科（1年次・共通）',
        note: '1年次は全員「工学科」として学ぶ。2年次進級時に系を選択。',
        era: 'current',
      },
      {
        name: '情報エレクトロニクス系',
        label: '情報エレクトロニクス系（IE系）',
        note: '2年次以降に選択 — 情報・電気・電子分野',
        era: 'current',
      },
      {
        name: '機械ロボティクス系',
        label: '機械ロボティクス系（MR系）',
        note: '2年次以降に選択 — 機械・ロボット分野',
        era: 'current',
      },
      {
        name: '都市デザイン系',
        label: '都市デザイン系（CE系）',
        note: '2年次以降に選択 — 土木・建築・環境分野',
        era: 'current',
      },
      // ---- 令和3年度（2021年度）以前の入学生（旧5学科） ----
      {
        name: '機械工学科',
        label: '機械工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '電気電子工学科',
        label: '電気電子工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '電子制御工学科',
        label: '電子制御工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '電子情報工学科',
        label: '電子情報工学科（令和3年度以前入学）',
        era: 'legacy',
      },
      {
        name: '環境都市工学科',
        label: '環境都市工学科（令和3年度以前入学）',
        era: 'legacy',
      },
    ],
  },

  // ====================================================================
  // 東海北陸地区（8校）
  // ====================================================================
  {
    id: 'toyama',
    syllabusId: '21',
    name: '富山高等専門学校',
    shortName: '富山高専',
    region: '東海北陸',
    prefecture: '富山県',
    campuses: ['本郷キャンパス（旧・富山工業高専）', '射水キャンパス（旧・富山商船高専）'],
    departments: [
      // 本郷キャンパス
      { name: '機械システム工学科', note: '本郷キャンパス' },
      { name: '電気制御システム工学科', note: '本郷キャンパス' },
      { name: '情報デザイン学科', note: '本郷キャンパス' },
      { name: '物質化学工学科', note: '本郷キャンパス' },
      { name: '環境都市工学科', note: '本郷キャンパス' },
      // 射水キャンパス
      { name: '商船学科', note: '射水キャンパス' },
      { name: '電子情報工学科', note: '射水キャンパス' },
      { name: '産業システム工学科', note: '射水キャンパス' },
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
      { name: '機械工学科' },
      { name: '電気工学科' },
      { name: '電子情報工学科' },
      { name: '環境都市工学科' },
      { name: '物質化学工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: '物質工学科' },
      { name: '環境都市工学科' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '電子制御工学科' },
      { name: '物質工学科' },
      { name: '建築学科' },
      { name: '環境都市工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '制御情報工学科' },
      { name: '物質工学科' },
      { name: '土木工学科' },
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
      { name: '機械工学科' },
      { name: '電気・電子システム工学科' },
      { name: '情報工学科' },
      { name: '物質工学科' },
      { name: '環境都市工学科' },
      { name: '建築学科' },
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
      { name: '商船学科' },
      { name: '電子機械工学科' },
      { name: '情報機械システム工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '電子情報工学科' },
      { name: '材料工学科' },
      { name: '建築学科' },
      { name: '生物応用化学科' },
    ],
  },

  // ====================================================================
  // 近畿地区（4校）
  // ====================================================================
  {
    id: 'maizuru',
    syllabusId: '29',
    name: '舞鶴工業高等専門学校',
    shortName: '舞鶴高専',
    region: '近畿',
    prefecture: '京都府',
    departments: [
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '建設システム工学科' },
      { name: 'ソーシャルデザイン工学科' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '都市システム工学科' },
      { name: '建築学科' },
      { name: '機械・電子システム工学科' },
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
      { name: '機械工学科' },
      { name: '電気工学科' },
      { name: '電子制御工学科' },
      { name: '情報工学科' },
      { name: '物質化学工学科' },
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
      { name: '機械・精密システム工学科' },
      { name: '電気情報工学科' },
      { name: '環境都市工学科' },
      { name: '生物応用化学科' },
    ],
  },

  // ====================================================================
  // 中国地区（8校）
  // ====================================================================
  {
    id: 'yonago',
    syllabusId: '33',
    name: '米子工業高等専門学校',
    shortName: '米子高専',
    region: '中国',
    prefecture: '鳥取県',
    departments: [
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '電子制御工学科' },
      { name: '物質工学科' },
      { name: '建築学科' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '電子制御工学科' },
      { name: '情報工学科' },
      { name: '環境・建設工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: '電子・情報システム工学科' },
      { name: '総合理工学科（建設系）' },
      { name: '総合理工学科（生物・化学系）' },
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
      { name: '商船学科' },
      { name: '電子制御工学科' },
      { name: '流通情報工学科' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '環境都市工学科' },
      { name: '建築学科' },
      { name: '生命医療工学科' },
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
      { name: '機械電気工学科' },
      { name: '情報電子工学科' },
      { name: '土木建築工学科' },
      { name: '応用化学科' },
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
      { name: '機械工学科' },
      { name: '電気工学科' },
      { name: '物質工学科' },
      { name: '経営情報学科' },
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
      { name: '商船学科' },
      { name: '電子機械工学科' },
      { name: '情報工学科' },
    ],
  },

  // ====================================================================
  // 四国地区（5校）
  // ====================================================================
  {
    id: 'anan',
    syllabusId: '41',
    name: '阿南工業高等専門学校',
    shortName: '阿南高専',
    region: '四国',
    prefecture: '徳島県',
    departments: [
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報コミュニケーション工学科' },
      { name: '化学技術学科' },
      { name: '創造技術工学科' },
    ],
  },
  {
    id: 'kagawa',
    syllabusId: '42',
    name: '香川高等専門学校',
    shortName: '香川高専',
    region: '四国',
    prefecture: '香川県',
    campuses: ['高松キャンパス（旧・高松工業高専）', '詫間キャンパス（旧・詫間電波高専）'],
    departments: [
      // 高松キャンパス
      { name: '機械電子工学科', note: '高松キャンパス' },
      { name: '電気情報工学科', note: '高松キャンパス' },
      { name: '建設環境工学科', note: '高松キャンパス' },
      { name: '創造工学科', note: '高松キャンパス' },
      // 詫間キャンパス
      { name: '情報工学科', note: '詫間キャンパス' },
      { name: '通信ネットワーク工学科', note: '詫間キャンパス' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '電子制御工学科' },
      { name: '環境材料工学科' },
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
      { name: '商船学科' },
      { name: '電子機械工学科' },
      { name: '情報工学科' },
      { name: '総合通信科' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: 'ソーシャルデザイン工学科' },
    ],
  },

  // ====================================================================
  // 九州・沖縄地区（9校）
  // ====================================================================
  {
    id: 'kurume',
    syllabusId: '46',
    name: '久留米工業高等専門学校',
    shortName: '久留米高専',
    region: '九州・沖縄',
    prefecture: '福岡県',
    departments: [
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '制御情報工学科' },
      { name: '材料工学科' },
      { name: '生物応用化学科' },
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
      { name: '機械・制御システム工学科' },
      { name: '電気電子工学科' },
      { name: '創造工学科（物質・環境系）' },
      { name: '創造工学科（建設・環境系）' },
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
      { name: '生産デザイン工学科（機械・知能システムコース）' },
      { name: '生産デザイン工学科（電気・情報コース）' },
      { name: '生産デザイン工学科（物質化学コース）' },
      { name: '生産デザイン工学科（環境・建設コース）' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: '物質工学科' },
      { name: '都市・環境デザイン工学科' },
    ],
  },
  {
    id: 'kumamoto',
    syllabusId: '50',
    name: '熊本高等専門学校',
    shortName: '熊本高専',
    region: '九州・沖縄',
    prefecture: '熊本県',
    campuses: ['熊本キャンパス（旧・熊本電波高専）', '八代キャンパス（旧・八代工業高専）'],
    departments: [
      // 熊本キャンパス
      { name: '情報通信エレクトロニクス工学科', note: '熊本キャンパス' },
      { name: '知能情報工学科', note: '熊本キャンパス' },
      { name: '生物化学システム工学科', note: '熊本キャンパス' },
      // 八代キャンパス
      { name: '機械知能システム工学科', note: '八代キャンパス' },
      { name: '電気情報工学科', note: '八代キャンパス' },
      { name: '建築社会デザイン工学科', note: '八代キャンパス' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: '都市・環境工学科' },
      { name: '創造工学科' },
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
      { name: '機械工学科' },
      { name: '電気情報工学科' },
      { name: '物質工学科' },
      { name: '建築学科' },
      { name: '都市・環境デザイン工学科' },
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
      { name: '機械工学科' },
      { name: '電気電子工学科' },
      { name: '情報工学科' },
      { name: '都市・建築デザイン工学科' },
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
      { name: 'メディア情報工学科' },
      { name: '生物資源工学科' },
      { name: '機械システム工学科' },
      { name: '電気システム工学科' },
      { name: '都市環境工学科' },
    ],
  },
];

// -----------------------------------------------------------------------
// 後方互換性のためのヘルパー（旧 getSchoolByName と同じシグネチャ）
// -----------------------------------------------------------------------

/** @deprecated getSchoolById または getSchoolByName を使用してください */
export function getSchoolDepartments(schoolName: string): string[] {
  const school = getSchoolByName(schoolName);
  return school?.departments.map((d) => d.name) ?? [];
}
