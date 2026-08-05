import React, { useState } from 'react';
import { Printer, Sparkles, FileText, Settings, LayoutGrid, CheckSquare } from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject_code?: string;
  class_group?: string;
  time_limit?: number;
}

interface AnswerSheetGeneratorProps {
  exams: Exam[];
}

export const AnswerSheetGenerator: React.FC<AnswerSheetGeneratorProps> = ({ exams }) => {
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('โรงเรียนดงหลวงวิทยา');
  const [examTitle, setExamTitle] = useState<string>('แบบทดสอบวัดผลสัมฤทธิ์ทางการเรียน');
  const [subjectCode, setSubjectCode] = useState<string>('ท21101 ภาษาไทย');
  const [numQuestions, setNumQuestions] = useState<number>(30);
  const [choiceType, setChoiceType] = useState<'TH' | 'EN'>('TH'); // ก-ง or A-D
  const [numChoices, setNumChoices] = useState<number>(4); // 4 or 5
  const [idDigits, setIdDigits] = useState<number>(4); // 4 digits for student ID default

  // Diverse Question Types State
  const [showTeacherScoreBox, setShowTeacherScoreBox] = useState<boolean>(true);
  const [teacherScoreFormat, setTeacherScoreFormat] = useState<'bubble' | 'written'>('bubble'); // 'bubble' OMR grid or 'written' box
  const [teacherScoreDigits, setTeacherScoreDigits] = useState<number>(2); // 2 or 3 digits for teacher score
  const [includeFillInBlank, setIncludeFillInBlank] = useState<boolean>(false);
  const [fillInCount, setFillInCount] = useState<number>(5);
  const [includeMatching, setIncludeMatching] = useState<boolean>(false);
  const [matchingCount, setMatchingCount] = useState<number>(5);
  const [includeSubjective, setIncludeSubjective] = useState<boolean>(false);
  const [subjectiveCount, setSubjectiveCount] = useState<number>(2);

  // Auto-fill when exam is selected
  const handleExamSelect = (eId: string) => {
    setSelectedExamId(eId);
    if (!eId) return;
    const found = exams.find(e => e.id === eId);
    if (found) {
      setExamTitle(found.title);
      if (found.subject_code) setSubjectCode(found.subject_code);
    }
  };

  const choicesTH = ['ก', 'ข', 'ค', 'ง', 'จ'];
  const choicesEN = ['A', 'B', 'C', 'D', 'E'];
  const currentChoices = choiceType === 'TH' ? choicesTH.slice(0, numChoices) : choicesEN.slice(0, numChoices);

  // Split questions into columns (max 20 items per col)
  const colsCount = numQuestions > 40 ? 3 : 2;
  const itemsPerCol = Math.ceil(numQuestions / colsCount);

  const columns = Array.from({ length: colsCount }, (_, colIdx) => {
    const startNum = colIdx * itemsPerCol + 1;
    const endNum = Math.min((colIdx + 1) * itemsPerCol, numQuestions);
    const items = [];
    for (let i = startNum; i <= endNum; i++) {
      items.push(i);
    }
    return items;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* CONTROL PANEL - HIDDEN WHEN PRINTING */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl print:hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-400" />
              สร้างกระดาษคำตอบมาตรฐาน OMR & อัตนัย (Answer Sheet Generator)
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              ออกแบบกระดาษคำตอบ รองรับทั้งปรนัย เติมคำ จับคู่ และอัตนัยเขียนตอบ พร้อมช่องครูตรวจให้คะแนนก่อนนำเข้าสแกน OMR
            </p>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <Printer className="w-5 h-5" />
            พิมพ์กระดาษคำตอบ (Print / Save PDF)
          </button>
        </div>

        {/* CONTROLS FORM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Select Existing Exam */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              เลือกจากชุดข้อสอบในระบบ
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => handleExamSelect(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- ออกแบบอิสระ / ไม่ระบุชุดข้อสอบ --</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.subject_code ? `[${ex.subject_code}] ` : ''}{ex.title}
                </option>
              ))}
            </select>
          </div>

          {/* School Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              ชื่อสถานศึกษา / โรงเรียน
            </label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Subject Code & Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              รหัสวิชา / ชื่อวิชา
            </label>
            <input
              type="text"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Exam Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              หัวข้อการสอบ
            </label>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Number of Multiple Choice Questions */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              ส่วนที่ 1: ปรนัย (ฝนตัวเลือก OMR)
            </label>
            <select
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={10}>10 ข้อ</option>
              <option value={20}>20 ข้อ</option>
              <option value={30}>30 ข้อ</option>
              <option value={40}>40 ข้อ</option>
              <option value={50}>50 ข้อ</option>
              <option value={60}>60 ข้อ</option>
              <option value={80}>80 ข้อ</option>
              <option value={100}>100 ข้อ</option>
            </select>
          </div>

          {/* Choice Style & Count & Student ID Digits */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                รูปแบบตัวเลือก
              </label>
              <select
                value={choiceType}
                onChange={(e) => setChoiceType(e.target.value as 'TH' | 'EN')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="TH">ก, ข, ค, ง</option>
                <option value="EN">A, B, C, D</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                จำนวนตัวเลือก
              </label>
              <select
                value={numChoices}
                onChange={(e) => setNumChoices(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={4}>4 ตัวเลือก</option>
                <option value={5}>5 ตัวเลือก</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                หลักรหัสนักเรียน
              </label>
              <select
                value={idDigits}
                onChange={(e) => setIdDigits(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={4}>4 หลัก (มาตรฐาน)</option>
                <option value={5}>5 หลัก</option>
                <option value={6}>6 หลัก</option>
              </select>
            </div>
          </div>
        </div>

        {/* DIVERSE QUESTION TYPES & TEACHER SCORE BOX CONTROLS */}
        <div className="border-t border-slate-800 pt-4 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-emerald-400" />
            ตัวเลือกรูปแบบโจทย์เพิ่มเติม & กรอบครูตรวจคะแนน (Diverse Formats & Grading Box)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            {/* Toggle Teacher Score Box */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTeacherScoreBox}
                  onChange={(e) => setShowTeacherScoreBox(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-200">
                  ช่องครูตรวจให้คะแนน (ก่อนสแกน)
                </span>
              </label>

              {showTeacherScoreBox && (
                <div className="pl-6 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">รูปแบบ:</span>
                    <select
                      value={teacherScoreFormat}
                      onChange={(e) => setTeacherScoreFormat(e.target.value as 'bubble' | 'written')}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                    >
                      <option value="bubble">ตารางฝนคะแนน OMR (แนะนำ)</option>
                      <option value="written">เขียนตัวเลขธรรมดา</option>
                    </select>
                  </div>
                  {teacherScoreFormat === 'bubble' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">หลักคะแนน:</span>
                      <select
                        value={teacherScoreDigits}
                        onChange={(e) => setTeacherScoreDigits(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                      >
                        <option value={2}>2 หลัก (00-99 คะแนน)</option>
                        <option value={3}>3 หลัก (000-999 คะแนน)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Toggle Fill-in-the-blank */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFillInBlank}
                  onChange={(e) => setIncludeFillInBlank(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-200">ข้อสอบเติมคำ / ตอบสั้น</span>
              </label>
              {includeFillInBlank && (
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-[11px] text-slate-400">จำนวน:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={fillInCount}
                    onChange={(e) => setFillInCount(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                  <span className="text-[11px] text-slate-400">ข้อ</span>
                </div>
              )}
            </div>

            {/* Toggle Matching */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMatching}
                  onChange={(e) => setIncludeMatching(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-200">ข้อสอบจับคู่ / เชื่อมโยง</span>
              </label>
              {includeMatching && (
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-[11px] text-slate-400">จำนวน:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={matchingCount}
                    onChange={(e) => setMatchingCount(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                  <span className="text-[11px] text-slate-400">ข้อ</span>
                </div>
              )}
            </div>

            {/* Toggle Subjective Essay */}
            <div className="space-y-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSubjective}
                  onChange={(e) => setIncludeSubjective(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-200">อัตนัย / เขียนบรรยายตอบ</span>
              </label>
              {includeSubjective && (
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-[11px] text-slate-400">จำนวน:</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={subjectiveCount}
                    onChange={(e) => setSubjectiveCount(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  />
                  <span className="text-[11px] text-slate-400">ข้อ</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PRINT SHEET CONTAINER - A4 PAPER SIMULATION */}
      <div className="bg-slate-900/50 p-4 md:p-8 rounded-2xl overflow-x-auto print:p-0 print:bg-white print:overflow-visible">
        <div 
          id="printable-answer-sheet" 
          className="mx-auto bg-white text-black p-8 rounded-lg shadow-2xl print:shadow-none print:p-6 print:m-0"
          style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box' }}
        >
          {/* FIDUCIAL OCR ALIGNMENT CORNER 1 (TOP-LEFT) */}
          <div className="relative">
            <div className="absolute -top-3 -left-3 w-7 h-7 bg-black flex items-center justify-center text-white font-bold text-xs rounded-sm">
              ■
            </div>
            <div className="absolute -top-3 -right-3 w-7 h-7 bg-black flex items-center justify-center text-white font-bold text-xs rounded-sm">
              ■
            </div>
          </div>

          {/* SHEET HEADER */}
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{schoolName}</h1>
            <h2 className="text-lg font-semibold text-slate-800 mt-0.5">{examTitle}</h2>
            <div className="flex justify-between items-center text-sm font-medium text-slate-700 mt-2 px-4">
              <span>รายวิชา: <strong>{subjectCode}</strong></span>
              <span>รหัสการทดสอบ: <strong>{selectedExamId || 'EX-OMR-STD'}</strong></span>
            </div>
          </div>

          {/* STUDENT INFO & BUBBLE ID SECTION */}
          <div className="grid grid-cols-12 gap-4 border-2 border-slate-900 p-3 rounded-lg mb-4 bg-slate-50/50">
            {/* Written Info */}
            <div className="col-span-7 space-y-2 text-xs font-semibold text-slate-900">
              <div className="flex items-center gap-2">
                <span>ชื่อ-นามสกุล:</span>
                <span className="flex-1 border-b border-dotted border-black"></span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <span>ชั้น/ห้อง:</span>
                  <span className="flex-1 border-b border-dotted border-black"></span>
                </div>
                <div className="flex items-center gap-1">
                  <span>เลขที่:</span>
                  <span className="flex-1 border-b border-dotted border-black"></span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span>รหัสนักเรียน:</span>
                <span className="flex-1 border-b border-dotted border-black"></span>
              </div>

              {/* Instructions Box */}
              <div className="mt-3 p-2 border border-slate-400 rounded bg-white text-[11px] leading-relaxed">
                <p className="font-bold text-slate-900 mb-1">คำชี้แจงในการทำข้อสอบ:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-slate-800">
                  <li>ใช้ดินสอดำ 2B ฝนในวงกลมตัวเลือกที่ถูกต้องที่สุด</li>
                  <li>ฝนให้เต็มวงกลม เข้ม และสม่ำเสมอ</li>
                  <li>หากต้องการเปลี่ยนคำตอบ ให้ใช้ยางลบลบให้สะอาด</li>
                  <li>ฝนรหัสนักเรียน 4 หลัก (ตัวแรกไม่ต้องเติม 0 หน้า)</li>
                </ol>
                <div className="mt-2 flex items-center gap-3 text-[10px]">
                  <span>ตัวอย่างการฝนที่ถูก:</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-full bg-black inline-block"></span> ถูก
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-full border border-black inline-flex items-center justify-center text-[8px]">✓</span> ผิด
                  </span>
                </div>
              </div>
            </div>

            {/* Student ID Bubble Grid */}
            <div className="col-span-5 border-l border-slate-400 pl-3">
              <div className="text-center text-[11px] font-bold text-slate-900">
                ตารางฝนรหัสนักเรียน ({idDigits} หลัก)
              </div>
              <div className="text-center text-[9px] font-medium text-rose-700 mb-1">
                *(ตัวแรกไม่ต้องเติม 0 หน้า)*
              </div>
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: idDigits }).map((_, col) => (
                  <div key={col} className="flex flex-col items-center gap-0.5 text-[9px]">
                    <div className="w-5 h-5 border border-black font-mono font-bold flex items-center justify-center bg-slate-100">
                      ?
                    </div>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <div
                        key={num}
                        className="w-4 h-4 rounded-full border border-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-700"
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TEACHER SCORE BOX (ช่องสำหรับครูตรวจให้คะแนนก่อนสแกนเข้า) */}
          {showTeacherScoreBox && (
            <div className="border-2 border-emerald-900 bg-emerald-50/40 p-2 rounded-lg mb-4 text-slate-900">
              <div className="flex justify-between items-center border-b border-emerald-800/40 pb-1 mb-2">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-700 inline" />
                  ช่องสำหรับครูผู้ตรวจฝน/กรอกคะแนนส่วนอัตนัย (Teacher Score Box)
                </span>
                <span className="text-[10px] text-emerald-800 font-medium">
                  {teacherScoreFormat === 'bubble'
                    ? '*(ครูใช้ดินสอดำ 2B ฝนตารางคะแนน เพื่อความแม่นยำในการสแกน 100%)*'
                    : '*(ครูเขียนคะแนนรวมในช่องสำหรับสแกนคะแนน)*'}
                </span>
              </div>

              {teacherScoreFormat === 'bubble' ? (
                /* TEACHER OMR BUBBLE GRID FORMAT */
                <div className="flex items-start gap-4">
                  {/* Summary boxes */}
                  <div className="flex-1 space-y-2">
                    <div className="border border-emerald-800/30 rounded p-1.5 bg-white text-center">
                      <span className="text-[10px] text-slate-600 block font-semibold">ส่วนที่ 1 เลือกตอบ (OMR)</span>
                      <div className="h-6 border-b border-dashed border-slate-400 font-mono font-bold text-slate-400 text-xs flex items-center justify-center">
                        [ OMR ตรวจ ]
                      </div>
                      <span className="text-[8px] text-slate-400 block">เต็ม {numQuestions} คะแนน</span>
                    </div>

                    <div className="border border-emerald-800/30 rounded p-1.5 bg-white text-center">
                      <span className="text-[10px] text-slate-800 block font-extrabold">รวมคะแนนสุทธิ</span>
                      <div className="h-6 border-b border-slate-900 font-mono font-extrabold text-emerald-700 text-sm flex items-center justify-center">
                        _______
                      </div>
                    </div>

                    <div className="border border-emerald-800/30 rounded p-1.5 bg-white text-center">
                      <span className="text-[9px] text-slate-600 block font-semibold">ลงชื่อครูผู้ตรวจ</span>
                      <div className="border-b border-dotted border-slate-800 my-1"></div>
                      <span className="text-[8px] text-slate-400 block">วันที่ ..../..../....</span>
                    </div>
                  </div>

                  {/* TEACHER OMR BUBBLE GRID */}
                  <div className="border-2 border-emerald-900 rounded p-2 bg-white flex flex-col items-center">
                    <div className="text-[10px] font-extrabold text-emerald-950 mb-0.5 text-center">
                      ตารางฝนคะแนนสำหรับครูผู้ตรวจ
                    </div>
                    <div className="text-[8px] font-semibold text-rose-700 mb-1">
                      *(ฝนวงกลมคะแนนส่วนอัตนัย/เขียนตอบ)*
                    </div>
                    <div className="flex gap-2">
                      {Array.from({ length: teacherScoreDigits }).map((_, col) => {
                        const digitLabel = teacherScoreDigits === 3
                          ? (col === 0 ? 'หลักร้อย' : col === 1 ? 'หลักสิบ' : 'หลักหน่วย')
                          : (col === 0 ? 'หลักสิบ' : 'หลักหน่วย');
                        return (
                          <div key={col} className="flex flex-col items-center gap-0.5">
                            <span className="text-[8px] text-slate-600 font-bold">{digitLabel}</span>
                            <div className="w-5 h-5 border-2 border-slate-900 rounded bg-slate-50 flex items-center justify-center text-[9px] font-mono font-bold text-slate-400 mb-0.5">
                              _
                            </div>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                              <div
                                key={num}
                                className="w-4 h-4 rounded-full border border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-800 bg-white"
                              >
                                {num}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* WRITTEN BOX FORMAT */
                <div className="grid grid-cols-4 gap-3 text-center text-xs">
                  <div className="border border-emerald-800/30 rounded p-1.5 bg-white">
                    <span className="text-[10px] text-slate-600 block font-semibold mb-1">ส่วนที่ 1 เลือกตอบ (OMR)</span>
                    <div className="h-7 border-b border-dashed border-slate-400 font-mono font-bold text-slate-400 text-xs flex items-center justify-center">
                      [ OMR ตรวจ ]
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 block">เต็ม {numQuestions} คะแนน</span>
                  </div>

                  <div className="border border-emerald-800/30 rounded p-1.5 bg-white">
                    <span className="text-[10px] text-slate-600 block font-semibold mb-1">ส่วนที่ 2 คะแนนครูตรวจ/อัตนัย</span>
                    <div className="h-7 border-b border-slate-900 font-mono font-extrabold text-slate-900 text-base flex items-center justify-center">
                      _______
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 block">คะแนนเขียน/เติมคำ/จับคู่</span>
                  </div>

                  <div className="border border-emerald-800/30 rounded p-1.5 bg-white">
                    <span className="text-[10px] text-slate-800 block font-extrabold mb-1">คะแนนรวมทั้งหมด</span>
                    <div className="h-7 border-b border-slate-900 font-mono font-extrabold text-emerald-700 text-base flex items-center justify-center">
                      _______
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 block">รวมสุทธิ</span>
                  </div>

                  <div className="border border-emerald-800/30 rounded p-1.5 bg-white flex flex-col justify-between">
                    <span className="text-[10px] text-slate-600 block font-semibold">ลงชื่อครูผู้ตรวจ</span>
                    <div className="border-b border-dotted border-slate-800 my-1"></div>
                    <span className="text-[8px] text-slate-400 block">วันที่ ..../..../....</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ANSWER BUBBLES GRID (ส่วนที่ 1: ปรนัย) */}
          <div>
            <div className="bg-slate-200 border-t-2 border-x-2 border-slate-800 px-3 py-1 text-xs font-bold text-slate-900 flex justify-between items-center rounded-t">
              <span>ส่วนที่ 1: แบบเลือกตอบ ปรนัย ({numQuestions} ข้อ)</span>
              <span className="text-[10px] font-normal text-slate-700">ใช้ดินสอดำ 2B ฝนในวงกลมตัวเลือก</span>
            </div>
            <div className={colsCount === 3 ? 'grid grid-cols-3 gap-3 border-2 border-slate-800 p-2 rounded-b bg-white' : 'grid grid-cols-2 gap-4 border-2 border-slate-800 p-2 rounded-b bg-white'}>
              {columns.map((items, colIdx) => (
                <div key={colIdx} className="border border-slate-800 rounded p-2 bg-white">
                  <div className="flex items-center justify-start gap-2 bg-slate-200 px-2 py-1 text-[11px] font-bold border-b border-slate-800 mb-1">
                    <span className="w-8 text-right pr-1">ข้อ</span>
                    <div className="flex gap-2 pl-1">
                      {currentChoices.map(c => (
                        <span key={c} className="w-5 text-center">{c}</span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-0 divide-y divide-slate-100">
                    {items.map(qNum => (
                      <div key={qNum} className="flex items-center justify-start gap-2 text-xs px-1 py-0.5 hover:bg-slate-50">
                        <span className="font-bold text-slate-800 w-8 text-right pr-1">
                          {qNum}.
                        </span>
                        <div className="flex gap-2 pl-1">
                          {currentChoices.map(c => (
                            <div
                              key={c}
                              className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center text-[10px] font-semibold text-slate-700 bg-white"
                            >
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DIVERSE QUESTION SECTIONS (ส่วนที่ 2: เติมคำตอบ / ตอบสั้น) */}
          {includeFillInBlank && (
            <div className="mt-4 border-2 border-slate-800 rounded bg-white overflow-hidden">
              <div className="flex justify-between items-center bg-slate-200 px-3 py-1.5 text-xs font-bold border-b border-slate-800">
                <span>ส่วนที่ 2: เติมคำตอบ / ตอบสั้น ({fillInCount} ข้อ)</span>
                <span className="text-[10px] font-normal text-slate-700">คำสั่ง: เขียนคำตอบที่ถูกต้องลงในช่องว่าง</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 text-xs">
                {Array.from({ length: fillInCount }).map((_, idx) => {
                  const qNum = numQuestions + idx + 1;
                  return (
                    <div key={qNum} className="flex items-center gap-2 border-b border-slate-300 pb-1">
                      <span className="font-bold text-slate-900 w-7 text-right">{qNum}.</span>
                      <span className="flex-1 border-b border-dotted border-slate-800 h-5"></span>
                      <div className="w-16 h-6 border border-slate-400 bg-slate-50 flex items-center justify-center text-[9px] font-semibold text-slate-600">
                        [คะแนน: ___]
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DIVERSE QUESTION SECTIONS (ส่วนที่ 3: จับคู่ / เชื่อมโยง) */}
          {includeMatching && (
            <div className="mt-4 border-2 border-slate-800 rounded bg-white overflow-hidden">
              <div className="flex justify-between items-center bg-slate-200 px-3 py-1.5 text-xs font-bold border-b border-slate-800">
                <span>ส่วนที่ 3: จับคู่ / เชื่อมโยงความสัมพันธ์ ({matchingCount} ข้อ)</span>
                <span className="text-[10px] font-normal text-slate-700">คำสั่ง: นำตัวอักษรหน้าตัวเลือกขวามือมาเติมลงในช่อง [  ]</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 text-xs">
                {Array.from({ length: matchingCount }).map((_, idx) => {
                  const startNum = numQuestions + (includeFillInBlank ? fillInCount : 0);
                  const qNum = startNum + idx + 1;
                  return (
                    <div key={qNum} className="flex items-center gap-2 border-b border-slate-300 pb-1">
                      <span className="font-bold text-slate-900 w-7 text-right">{qNum}.</span>
                      <span className="inline-block w-8 h-5 border-2 border-slate-900 rounded bg-slate-50 text-center font-mono font-bold"></span>
                      <span className="flex-1 text-[11px] text-slate-700 truncate">เติมตัวอักษรคู่จับ...</span>
                      <div className="w-14 h-5 border border-slate-400 bg-slate-50 flex items-center justify-center text-[9px] font-semibold text-slate-600">
                        [คะแนน: ___]
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DIVERSE QUESTION SECTIONS (ส่วนที่ 4: อัตนัย / เขียนบรรยายตอบ) */}
          {includeSubjective && (
            <div className="mt-4 border-2 border-slate-800 rounded bg-white overflow-hidden">
              <div className="flex justify-between items-center bg-slate-200 px-3 py-1.5 text-xs font-bold border-b border-slate-800">
                <span>ส่วนที่ 4: อัตนัย / เขียนตอบแบบบรรยาย ({subjectiveCount} ข้อ)</span>
                <span className="text-[10px] font-normal text-slate-700">คำสั่ง: เขียนอธิบายแสดงความคิดเห็นลงในกรอบที่กำหนด</span>
              </div>
              <div className="p-3 space-y-3 text-xs">
                {Array.from({ length: subjectiveCount }).map((_, idx) => {
                  const startNum = numQuestions + (includeFillInBlank ? fillInCount : 0) + (includeMatching ? matchingCount : 0);
                  const qNum = startNum + idx + 1;
                  return (
                    <div key={qNum} className="border border-slate-400 rounded p-2.5 space-y-1 bg-slate-50/50">
                      <div className="flex justify-between items-center font-bold text-slate-900 border-b border-slate-300 pb-1">
                        <span>ข้อที่ {qNum}: แสดงทรรศนะ / อธิบายคำตอบ</span>
                        <div className="px-2 py-0.5 border border-slate-800 bg-white text-[10px] font-mono text-emerald-800">
                          คะแนนครูตรวจ: [ _____ / _____ ]
                        </div>
                      </div>
                      <div className="space-y-2 pt-1">
                        <div className="border-b border-dotted border-slate-400 h-5"></div>
                        <div className="border-b border-dotted border-slate-400 h-5"></div>
                        <div className="border-b border-dotted border-slate-400 h-5"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FOOTER & CORNER ALIGNMENT MARKS */}
          <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-500">
            <div>
              ระบบตรวจคำตอบอัตโนมัติ OMR / AI Vision System - {schoolName}
            </div>
            <div className="font-mono">
              SEC-CODE: {selectedExamId ? selectedExamId.slice(0, 12) : 'OFFLINE-STD-01'}
            </div>
          </div>

          {/* FIDUCIAL OCR ALIGNMENT CORNER 3 & 4 (BOTTOM) */}
          <div className="relative mt-2">
            <div className="absolute bottom-0 -left-3 w-7 h-7 bg-black flex items-center justify-center text-white font-bold text-xs rounded-sm">
              ■
            </div>
            <div className="absolute bottom-0 -right-3 w-7 h-7 bg-black flex items-center justify-center text-white font-bold text-xs rounded-sm">
              ■
            </div>
          </div>
        </div>
      </div>

      {/* STYLES FOR CLEAN PRINTING */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-answer-sheet, #printable-answer-sheet * {
            visibility: visible;
          }
          #printable-answer-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
};
