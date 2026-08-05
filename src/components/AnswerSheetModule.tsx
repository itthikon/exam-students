import React, { useState } from 'react';
import { FileText, Scan, Printer, Sparkles, CheckCircle, HelpCircle } from 'lucide-react';
import { AnswerSheetGenerator } from './AnswerSheetGenerator';
import { AnswerSheetScanner } from './AnswerSheetScanner';

interface Exam {
  id: string;
  title: string;
  subject_code?: string;
  class_group?: string;
  time_limit?: number;
}

interface Student {
  student_id: string;
  name: string;
  class_group: string;
}

interface AnswerSheetModuleProps {
  exams: Exam[];
  students: Student[];
  onResultSaved?: () => void;
}

export const AnswerSheetModule: React.FC<AnswerSheetModuleProps> = ({ exams, students, onResultSaved }) => {
  const [subTab, setSubTab] = useState<'generator' | 'scanner'>('scanner');

  return (
    <div className="space-y-6">
      {/* TOP SUB-NAV TABS - HIDDEN WHEN PRINTING */}
      <div className="bg-slate-900 border border-slate-800 p-2 rounded-2xl flex flex-col sm:flex-row gap-2 print:hidden">
        <button
          onClick={() => setSubTab('scanner')}
          className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            subTab === 'scanner'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Scan className="w-5 h-5 text-cyan-300" />
          ตรวจกระดาษคำตอบด้วย AI / OCR (Scan & Auto-Grade)
        </button>

        <button
          onClick={() => setSubTab('generator')}
          className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            subTab === 'generator'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Printer className="w-5 h-5 text-emerald-300" />
          สร้าง & พิมพ์กระดาษคำตอบ OMR (Print Template)
        </button>
      </div>

      {/* TAB CONTENT */}
      {subTab === 'scanner' ? (
        <AnswerSheetScanner exams={exams} students={students} onSaveResult={onResultSaved} />
      ) : (
        <AnswerSheetGenerator exams={exams} />
      )}
    </div>
  );
};
