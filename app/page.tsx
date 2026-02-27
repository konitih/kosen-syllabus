'use client';

import { GradeApp } from '@/components/GradeApp';
import { Toaster } from '@/components/ui/toaster';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-7xl mx-auto px-4 py-8 md:py-12">
        <GradeApp />
      </div>
      <Toaster />
    </main>
  );
}
