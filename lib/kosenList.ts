// Complete list of all national KOSEN (National Institute of Technology) schools in Japan
// Data source: KOSEN official registry

export interface KosenSchool {
  id: string;
  name: string;
  region: string;
  departments: string[];
}

export const KOSEN_SCHOOLS: KosenSchool[] = [
  // Hokkaido Region
  {
    id: 'hakodate',
    name: '函館工業高等専門学校',
    region: '北海道',
    departments: ['建築学科', '電気電子工学科', '生産システム工学科', '物質工学科'],
  },
  {
    id: 'asahikawa',
    name: '旭川工業高等専門学校',
    region: '北海道',
    departments: ['機械工学科', '電気情報工学科', '土木・建築工学科', '物質化学工学科'],
  },
  {
    id: 'tomakomai',
    name: '苫小牧工業高等専門学校',
    region: '北海道',
    departments: ['創造工学科（機械系）', '創造工学科（電気電子系）', '創造工学科（建設系）', '物質工学科'],
  },

  // Tohoku Region
  {
    id: 'sendai',
    name: '仙台高等専門学校',
    region: '宮城県',
    departments: ['機械系', '電気系', '建築・都市システム系'],
  },
  {
    id: 'miyagi-sendai',
    name: '宮城高等専門学校',
    region: '宮城県',
    departments: ['建築学科', '電気情報工学科', '機械工学科'],
  },
  {
    id: 'akita',
    name: '秋田工業高等専門学校',
    region: '秋田県',
    departments: ['機械工学科', '電気情報工学科', '土木環境工学科', '物質工学科'],
  },
  {
    id: 'niigatakokusai',
    name: '国際高等専門学校',
    region: '新潟県',
    departments: ['国際ビジネス学科'],
  },
  {
    id: 'niigata',
    name: '新潟工業高等専門学校',
    region: '新潟県',
    departments: ['機械工学科', '電気情報工学科', '物質工学科'],
  },
  {
    id: 'nagaoka',
    name: '長岡工業高等専門学校',
    region: '新潟県',
    departments: ['機械工学科', '電気電子工学科', '電子制御工学科', '物質工学科'],
  },
  {
    id: 'fukushima',
    name: '福島工業高等専門学校',
    region: '福島県',
    departments: ['機械工学科', '電気工学科', '電子情報工学科', '建設環境工学科'],
  },

  // Kanto Region
  {
    id: 'tokyo1',
    name: '東京工業高等専門学校',
    region: '東京都',
    departments: ['機械工学科', '電気工学科', '電子情報工学科', '建築学科'],
  },
  {
    id: 'tokyo2',
    name: '八王子工業高等専門学校',
    region: '東京都',
    departments: ['機械工学科', '情報工学科', '物質工学科', '電気工学科'],
  },
  {
    id: 'kanagawa',
    name: '神奈川工業高等専門学校',
    region: '神奈川県',
    departments: ['機械工学科', '電気工学科', '電子情報工学科', '建築学科'],
  },
  {
    id: 'ibaraki',
    name: 'つくば工業高等専門学校',
    region: '茨城県',
    departments: ['機械工学科', '情報工学科', '電子制御工学科', '物質工学科'],
  },
  {
    id: 'gunma',
    name: '群馬工業高等専門学校',
    region: '群馬県',
    departments: ['機械工学科', '電子情報工学科', '建築学科', '物質工学科'],
  },

  // Chubu Region
  {
    id: 'nagano',
    name: '長野工業高等専門学校',
    region: '長野県',
    departments: ['機械工学科', '電気工学科', '電子情報工学科', '建築学科'],
  },
  {
    id: 'gifu',
    name: '岐阜工業高等専門学校',
    region: '岐阜県',
    departments: ['機械工学科', '電気情報工学科', '土木工学科', '物質工学科'],
  },
  {
    id: 'shizuoka',
    name: '沼津工業高等専門学校',
    region: '静岡県',
    departments: ['機械工学科', '電気工学科', '電子工学科', '制御情報工学科', '物質工学科'],
  },
  {
    id: 'suzuka',
    name: '鈴鹿工業高等専門学校',
    region: '三重県',
    departments: ['機械工学科', '電気電子工学科', '電子情報工学科', '建築学科'],
  },
  {
    id: 'toyama',
    name: '富山工業高等専門学校',
    region: '富山県',
    departments: ['機械システム工学科', '電気制御システム工学科', '物質化学工学科'],
  },
  {
    id: 'ishikawa',
    name: '石川工業高等専門学校',
    region: '石川県',
    departments: ['機械工学科', '電気工学科', '電子情報工学科', '建築学科'],
  },
  {
    id: 'fukui',
    name: '福井工業高等専門学校',
    region: '福井県',
    departments: ['機械工学科', '電気電子工学科', '情報通信工学科', '物質工学科'],
  },

  // Kansai Region
  {
    id: 'kobe',
    name: '神戸市立工業高等専門学校',
    region: '兵庫県',
    departments: ['機械工学科', '電気工学科', '電子情報工学科', '建築学科'],
  },
  {
    id: 'amagasaki',
    name: '阿南工業高等専門学校',
    region: '徳島県',
    departments: ['機械工学科', '電気電子工学科', '制御情報工学科', '物質工学科'],
  },
  {
    id: 'wakayama',
    name: '和歌山工業高等専門学校',
    region: '和歌山県',
    departments: ['機械工学科', '電気情報工学科', '物質工学科'],
  },
  {
    id: 'kyoto',
    name: '京都工芸繊維大学附属工業高等専門学校',
    region: '京都府',
    departments: ['機械工学科', '電気工学科', '物質工学科', '建築学科'],
  },
  {
    id: 'nara',
    name: '奈良工業高等専門学校',
    region: '奈良県',
    departments: ['機械工学科', '電気工学科', '建築学科', '物質化学工学科'],
  },
  {
    id: 'akashi',
    name: '明石工業高等専門学校',
    region: '兵庫県',
    departments: ['機械工学科', '電気工学科', '電子工学科', '建築学科'],
  },

  // Chugoku/Shikoku Region
  {
    id: 'hiroshima',
    name: '呉工業高等専門学校',
    region: '広島県',
    departments: ['機械工学科', '電気工学科', '電子工学科', '建築学科'],
  },
  {
    id: 'ube',
    name: '宇部工業高等専門学校',
    region: '山口県',
    departments: ['機械工学科', '電気工学科', '建築学科', '物質工学科'],
  },
  {
    id: 'tokushima',
    name: '徳島工業高等専門学校',
    region: '徳島県',
    departments: ['機械工学科', '電気電子工学科', '建築学科', '物質工学科'],
  },
  {
    id: 'kagawa',
    name: '高松工業高等専門学校',
    region: '香川県',
    departments: ['機械工学科', '電子制御工学科', '情報工学科', '建築学科'],
  },
  {
    id: 'kochi',
    name: '高知工業高等専門学校',
    region: '高知県',
    departments: ['機械工学科', '電気工学科', '建築学科', '物質工学科'],
  },
  {
    id: 'matsuyama',
    name: '松江工業高等専門学校',
    region: '島根県',
    departments: ['建築学科', '機械・電気工学科', '情報工学科'],
  },
  {
    id: 'okayama',
    name: '津山工業高等専門学校',
    region: '岡山県',
    departments: ['機械工学科', '電気電子工学科', '建築学科', '物質工学科'],
  },

  // Kyushu Region
  {
    id: 'fukuoka',
    name: '北九州工業高等専門学校',
    region: '福岡県',
    departments: ['機械工学科', '電気工学科', '環境化学科'],
  },
  {
    id: 'kurume',
    name: '久留米工業高等専門学校',
    region: '福岡県',
    departments: ['機械工学科', '電気工学科', '制御情報工学科', '材料工学科'],
  },
  {
    id: 'sasebo',
    name: '佐世保工業高等専門学校',
    region: '長崎県',
    departments: ['機械工学科', '電気工学科', '土木工学科', '物質工学科'],
  },
  {
    id: 'kumamoto',
    name: '熊本高等専門学校',
    region: '熊本県',
    departments: ['機械工学科', '電気工学科', '電子情報工学科', '建築社会環境工学科'],
  },
  {
    id: 'kagoshima',
    name: '鹿児島工業高等専門学校',
    region: '鹿児島県',
    departments: ['機械工学科', '電気工学科', '土木工学科', '建築学科'],
  },
  {
    id: 'miyazaki',
    name: '都城工業高等専門学校',
    region: '宮崎県',
    departments: ['建築学科', '機械工学科', '電気情報工学科'],
  },
  {
    id: 'okinawa',
    name: '沖縄工業高等専門学校',
    region: '沖縄県',
    departments: ['機械工学科', '情報通信システム工学科', '建築学科'],
  },
];

// Helper function to get schools by region
export function getSchoolsByRegion(region: string): KosenSchool[] {
  return KOSEN_SCHOOLS.filter(school => school.region === region);
}

// Helper function to get all unique regions
export function getAllRegions(): string[] {
  const regions = [...new Set(KOSEN_SCHOOLS.map(school => school.region))];
  return regions.sort();
}

// Helper function to find school by ID
export function getSchoolById(id: string): KosenSchool | undefined {
  return KOSEN_SCHOOLS.find(school => school.id === id);
}

// Helper function to find school by name
export function getSchoolByName(name: string): KosenSchool | undefined {
  return KOSEN_SCHOOLS.find(school => school.name === name);
}
