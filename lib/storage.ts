'use client';

import { AppConfig, Subject, SubjectPoolEntry } from './types';
import { eventEmitter } from './events';

const STORAGE_KEY = 'grade-app-config';
const POOL_KEY = 'kosen-subject-pool'; // 科目プール用ストレージキー

const DEFAULT_CONFIG: AppConfig = {
  schoolInfo: {
    schoolName: '',
    department: '',
    grade: 1,
    semester: 'spring',
    academicYear: getCurrentAcademicYear(),
  },
  timetable: {
    subjects: [],
    periodsPerDay: 5,
  },
  classesPerSemester: 40,
  onboardingComplete: false,
};

// ─── 年度ユーティリティ ─────────────────────────────────────────────────────
/**
 * 日本の高専年度を自動取得。
 * 4月始まりのため、1〜3月は前年度を返す。
 * 例: 2026年2月 → 2025年度
 */
export function getCurrentAcademicYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

// ─── メインアプリ設定 ───────────────────────────────────────────────────────
export const storage = {
  getConfig: (): AppConfig => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_CONFIG;
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load config:', error);
      return DEFAULT_CONFIG;
    }
  },

  saveConfig: (config: AppConfig): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  },

  updateSubject: (subjectId: string, updates: Partial<Subject>): void => {
    const config = storage.getConfig();
    const idx = config.timetable.subjects.findIndex(s => s.id === subjectId);
    if (idx !== -1) {
      config.timetable.subjects[idx] = {
        ...config.timetable.subjects[idx],
        ...updates,
      };
      storage.saveConfig(config);
      eventEmitter.emit('subject:updated', config.timetable.subjects[idx]);
    }
  },

  addSubject: (subject: Subject): void => {
    const config = storage.getConfig();
    config.timetable.subjects.push(subject);
    storage.saveConfig(config);
    eventEmitter.emit('subject:added', subject);
  },

  deleteSubject: (subjectId: string): void => {
    const config = storage.getConfig();
    config.timetable.subjects = config.timetable.subjects.filter(
      s => s.id !== subjectId
    );
    storage.saveConfig(config);
    eventEmitter.emit('subject:deleted', { id: subjectId });
  },

  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(POOL_KEY);
  },

  updateSchoolInfo: (schoolInfo: Partial<AppConfig['schoolInfo']>): void => {
    const config = storage.getConfig();
    config.schoolInfo = { ...config.schoolInfo, ...schoolInfo };
    storage.saveConfig(config);
    eventEmitter.emit('config:updated', config);
  },

  completeOnboarding: (): void => {
    const config = storage.getConfig();
    config.onboardingComplete = true;
    storage.saveConfig(config);
    eventEmitter.emit('config:updated', config);
  },

  addAbsenceRecord: (subjectId: string, reason?: string): void => {
    const config = storage.getConfig();
    const subject = config.timetable.subjects.find(s => s.id === subjectId);
    if (subject) {
      subject.absences += 1;
      if (!subject.absenceRecords) subject.absenceRecords = [];
      subject.absenceRecords.push({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        reason,
        approved: false,
      });
      storage.saveConfig(config);
      eventEmitter.emit('absence:added', { subjectId, subject });
    }
  },
};

// ─── 科目プール（スクレイプ結果の在庫） ─────────────────────────────────────
export const subjectPool = {
  /** プール全件取得 */
  getAll: (): SubjectPoolEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(POOL_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch {
      return [];
    }
  },

  /** プール保存 */
  saveAll: (entries: SubjectPoolEntry[]): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(POOL_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save subject pool:', error);
    }
  },

  /**
   * 科目をプールに追加（同じ school_id + department の既存エントリは置き換え）。
   * これにより「追加取得」で上書きマージが実現できる。
   */
  addEntries: (
    subjects: Subject[],
    sourceSchoolId: string,
    sourceDepartment: string
  ): void => {
    const existing = subjectPool.getAll();

    // 同じ sourceSchoolId + sourceDepartment の既存エントリを削除してから追加
    const filtered = existing.filter(
      e => !(e.sourceSchoolId === sourceSchoolId && e.sourceDepartment === sourceDepartment)
    );

    const now = new Date().toISOString();
    const newEntries: SubjectPoolEntry[] = subjects.map(subject => ({
      subject,
      sourceSchoolId,
      sourceDepartment,
      addedAt: now,
    }));

    subjectPool.saveAll([...filtered, ...newEntries]);
    eventEmitter.emit('pool:updated', { sourceSchoolId, sourceDepartment, count: subjects.length });
  },

  /** プールから特定科目を削除 */
  removeEntry: (subjectId: string): void => {
    const entries = subjectPool.getAll();
    subjectPool.saveAll(entries.filter(e => e.subject.id !== subjectId));
    eventEmitter.emit('pool:updated', {});
  },

  /** プール全削除 */
  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(POOL_KEY);
    eventEmitter.emit('pool:updated', {});
  },

  /**
   * プール内の科目を時間割（timetable.subjects）に移動する。
   * プールからは削除しない（後で取り直せるように在庫として保持）。
   */
  promoteToTimetable: (
    subjectId: string,
    dayOfWeek: number,
    period: number
  ): void => {
    const entries = subjectPool.getAll();
    const entry = entries.find(e => e.subject.id === subjectId);
    if (!entry) return;

    // 同じ曜日・時限に既存科目があれば先に削除
    const config = storage.getConfig();
    const conflicting = config.timetable.subjects.find(
      s => s.dayOfWeek === dayOfWeek && s.period === period
    );
    if (conflicting) {
      storage.deleteSubject(conflicting.id);
    }

    const subjectWithSlot: Subject = {
      ...entry.subject,
      id: `timetable-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dayOfWeek,
      period,
    };
    storage.addSubject(subjectWithSlot);
  },

  /** 取得元（school + department）の一覧を返す */
  getSources: (): Array<{ schoolId: string; department: string; count: number }> => {
    const entries = subjectPool.getAll();
    const map = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.sourceSchoolId}__${e.sourceDepartment}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([key, count]) => {
      const [schoolId, department] = key.split('__');
      return { schoolId, department, count };
    });
  },
};
