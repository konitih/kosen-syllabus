'use client';

import { AppConfig, Subject } from './types';
import { eventEmitter } from './events';

const STORAGE_KEY = 'grade-app-config';

const DEFAULT_CONFIG: AppConfig = {
  schoolInfo: {
    schoolName: '',
    department: '',
    grade: 1,
    semester: 'spring',
    academicYear: new Date().getFullYear(),
  },
  timetable: {
    subjects: [],
    periodsPerDay: 5,
  },
  classesPerSemester: 40,
  onboardingComplete: false,
};

export const storage = {
  // Get the entire config
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

  // Save the entire config
  saveConfig: (config: AppConfig): void => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  },

  // Update a specific subject
  updateSubject: (subjectId: string, updates: Partial<Subject>): void => {
    const config = storage.getConfig();
    const subjectIndex = config.timetable.subjects.findIndex(s => s.id === subjectId);
    
    if (subjectIndex !== -1) {
      config.timetable.subjects[subjectIndex] = {
        ...config.timetable.subjects[subjectIndex],
        ...updates,
      };
      storage.saveConfig(config);
      eventEmitter.emit('subject:updated', config.timetable.subjects[subjectIndex]);
    }
  },

  // Add a new subject
  addSubject: (subject: Subject): void => {
    const config = storage.getConfig();
    config.timetable.subjects.push(subject);
    storage.saveConfig(config);
    eventEmitter.emit('subject:added', subject);
  },

  // Delete a subject
  deleteSubject: (subjectId: string): void => {
    const config = storage.getConfig();
    config.timetable.subjects = config.timetable.subjects.filter(
      s => s.id !== subjectId
    );
    storage.saveConfig(config);
    eventEmitter.emit('subject:deleted', { id: subjectId });
  },

  // Clear all data
  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },

  // Update school info (for onboarding)
  updateSchoolInfo: (schoolInfo: Partial<AppConfig['schoolInfo']>): void => {
    const config = storage.getConfig();
    config.schoolInfo = { ...config.schoolInfo, ...schoolInfo };
    storage.saveConfig(config);
    eventEmitter.emit('config:updated', config);
  },

  // Mark onboarding as complete
  completeOnboarding: (): void => {
    const config = storage.getConfig();
    config.onboardingComplete = true;
    storage.saveConfig(config);
    eventEmitter.emit('config:updated', config);
  },

  // Add absence record to subject
  addAbsenceRecord: (subjectId: string, reason?: string): void => {
    const config = storage.getConfig();
    const subject = config.timetable.subjects.find(s => s.id === subjectId);
    
    if (subject) {
      subject.absences += 1;
      if (!subject.absenceRecords) {
        subject.absenceRecords = [];
      }
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
