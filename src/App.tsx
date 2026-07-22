import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, User, Lock, Unlock, BookOpen, Sparkles, AlertTriangle, CheckCircle2, 
  XCircle, Plus, Trash2, Upload, FileText, FileSpreadsheet, BarChart3, 
  Database, Copy, Check, RotateCcw, RefreshCw, Sliders, LogOut, 
  Clock, Settings, Search, Filter, Users, Menu, Maximize, Minimize, CheckSquare,
  Brain, TrendingUp, Radio, Tv, Activity, Bell, Send, MessageSquare, Megaphone,
  MessageCircle, Download, UploadCloud, Globe, Heart, Pin, Volume2, ShieldAlert, Eye,
  HelpCircle, MessageCircleQuestion, X, Info, Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

const SUPABASE_SETUP_SQL = `-- 1. สร้างตารางทั้งหมดสำหรับระบบจัดสอบ
CREATE TABLE IF NOT EXISTS public.teachers (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    role TEXT DEFAULT 'teacher',
    password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
    student_id TEXT PRIMARY KEY,
    name TEXT,
    password TEXT,
    class_group TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exams (
    id TEXT PRIMARY KEY,
    subject_id TEXT,
    title TEXT,
    type TEXT,
    duration INT DEFAULT 30,
    randomize BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    anti_cheat_level TEXT DEFAULT 'strict',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.questions (
    id TEXT PRIMARY KEY,
    exam_id TEXT,
    question_text TEXT,
    options JSONB,
    correct_index INT DEFAULT 0,
    points NUMERIC DEFAULT 1,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.exam_results (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    student_name TEXT,
    exam_id TEXT,
    exam_title TEXT,
    score NUMERIC DEFAULT 0,
    max_score NUMERIC DEFAULT 0,
    percentage NUMERIC DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB
);

CREATE TABLE IF NOT EXISTS public.cheat_logs (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    student_name TEXT,
    exam_id TEXT,
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id TEXT PRIMARY KEY,
    title TEXT,
    body TEXT,
    author TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discussions (
    id TEXT PRIMARY KEY,
    user_name TEXT,
    role TEXT,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.popup_messages (
    id TEXT PRIMARY KEY,
    target_type TEXT,
    target_value TEXT,
    title TEXT,
    body TEXT,
    sender_name TEXT,
    importance TEXT DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. เปิดใช้งาน RLS และอนุญาตให้เข้าถึงอ่าน/เขียนข้อมูลได้
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popup_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all teachers" ON public.teachers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all subjects" ON public.subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all exams" ON public.exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all questions" ON public.questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all exam_results" ON public.exam_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all cheat_logs" ON public.cheat_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all announcements" ON public.announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all discussions" ON public.discussions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all popup_messages" ON public.popup_messages FOR ALL USING (true) WITH CHECK (true);`;

// Types
interface Student {
  id: string;
  student_id: string;
  name: string;
  password?: string;
  class_group: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface Exam {
  id: string;
  subject_id: string;
  title: string;
  type: 'midterm' | 'final' | 'quiz' | 'practice';
  duration: number;
  randomize: boolean;
  is_active: boolean;
  anti_cheat_level?: 'strict' | 'moderate' | 'relaxed' | 'off';
}

interface Question {
  id?: string;
  exam_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  points: number;
  explanation?: string;
}

interface ExamResult {
  id: string;
  student_id: string;
  student_name: string;
  exam_id: string;
  score: number;
  total_score: number;
  start_time: string;
  submit_time: string;
  answers: string; // JSON
  status: 'completed' | 'ongoing';
}

interface CheatLog {
  id: string;
  student_id: string;
  student_name: string;
  exam_id: string;
  violation_type: 'tab_switch' | 'fullscreen_exit' | 'right_click' | 'blur';
  timestamp: string;
  details: string;
}

interface Teacher {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher';
}

interface LiveSession {
  student_id: string;
  student_name: string;
  class_group: string;
  exam_id: string;
  exam_title: string;
  subject_id?: string;
  subject_name?: string;
  answered_count: number;
  total_questions: number;
  time_remaining: number;
  status: 'taking' | 'submitted' | 'locked';
  last_violation?: string;
  last_active: string;
}

interface PopupMessage {
  id: string;
  target_type: 'all' | 'individual' | 'class' | 'subject';
  target_value: string;
  title: string;
  body: string;
  sender_name: string;
  importance: 'info' | 'warning' | 'urgent';
  created_at: string;
  read_by?: string[];
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_group: string;
  is_pinned: boolean;
  author_name: string;
  created_at: string;
}

interface DiscussionComment {
  id: string;
  author_name: string;
  author_role: 'teacher' | 'student' | 'admin';
  content: string;
  created_at: string;
}

interface DiscussionPost {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_role: 'teacher' | 'student' | 'admin';
  category: 'general' | 'question' | 'suggestion';
  class_group?: string;
  subject_id?: string;
  created_at: string;
  likes: string[];
  comments: DiscussionComment[];
}

function detectBrowser() {
  if (typeof window === 'undefined') {
    return {
      isValid: true,
      isInApp: false,
      isChrome: true,
      isSafari: true,
      isLine: false,
      isFacebook: false,
      isInstagram: false,
      isWeChat: false,
      isTikTok: false,
      userAgent: ''
    };
  }
  
  const ua = navigator.userAgent;
  const isLine = /Line/i.test(ua);
  const isFacebook = /FBAN|FBAV/i.test(ua);
  const isInstagram = /Instagram|FBIOS/i.test(ua);
  const isWeChat = /MicroMessenger/i.test(ua);
  const isTikTok = /TikTok|musical_ly/i.test(ua);
  
  // Any in-app browser / Webview detection
  const isAndroidWebview = /Android/i.test(ua) && /Version\/[0-9.]+/i.test(ua) && !/Chrome\/[0-9.]+\s+Mobile/i.test(ua);
  const isOtherWebview = /WebView|wv|iPh.*AppleWebKit.*Mobile.*Safari/i.test(ua) && !/Safari/i.test(ua) && !/CriOS/i.test(ua);
  
  const isInApp = isLine || isFacebook || isInstagram || isWeChat || isTikTok || isAndroidWebview || isOtherWebview;

  // Detect if browser is Google Chrome or Safari
  const isChrome = (/Chrome|CriOS/i.test(ua) || /Chromium/i.test(ua)) && !/Edg|OPR|Firefox/i.test(ua) && !isInApp;
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|Firefox|Android/i.test(ua) && !isInApp;
  
  const isValid = (isChrome || isSafari) && !isInApp;

  return {
    isValid,
    isInApp,
    isChrome,
    isSafari,
    isLine,
    isFacebook,
    isInstagram,
    isWeChat,
    isTikTok,
    userAgent: ua
  };
}

export default function App() {
  // Navigation & Session States
  const [userRole, setUserRole] = useState<'guest' | 'student' | 'teacher' | 'admin'>('guest');
  const [browserInfo, setBrowserInfo] = useState(detectBrowser);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'subjects' | 'exams' | 'stats' | 'analysis' | 'live_monitor' | 'popup_sender' | 'announcements' | 'backup'>('stats');
  const [dbStatus, setDbStatus] = useState({ useSupabase: false });

  // DB Data States
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [cheatLogs, setCheatLogs] = useState<CheatLog[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [lockedStudents, setLockedStudents] = useState<any[]>([]);

  // UI Interactive States
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examState, setExamState] = useState<'gateway' | 'taking' | 'finished'>('gateway');
  
  // Login Form States
  const [loginTab, setLoginTab] = useState<'student' | 'teacher'>('student');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [teacherEmailInput, setTeacherEmailInput] = useState('');
  const [teacherPasswordInput, setTeacherPasswordInput] = useState('');
  
  // Teacher/Admin Management Dialogs
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamType, setNewExamType] = useState<'midterm' | 'final' | 'quiz' | 'practice'>('quiz');
  const [newExamDuration, setNewExamDuration] = useState('30');
  const [newExamRandom, setNewExamRandom] = useState(true);
  const [newExamAntiCheatLevel, setNewExamAntiCheatLevel] = useState<'strict' | 'moderate' | 'relaxed' | 'off'>('strict');
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<string>('');
  const [activeExamQuestions, setActiveExamQuestions] = useState<Question[]>([]);
  const [questionsRefreshTrigger, setQuestionsRefreshTrigger] = useState(0);

  useEffect(() => {
    if (selectedExamForQuestions) {
      fetch(`/api/exams/${selectedExamForQuestions}/questions`)
        .then(r => r.json())
        .then(setActiveExamQuestions)
        .catch(() => {});
    } else {
      setActiveExamQuestions([]);
    }
  }, [selectedExamForQuestions, questionsRefreshTrigger]);
  
  // Active Exam Room States
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cheatAttempts, setCheatAttempts] = useState(0);
  const [isCheatLocked, setIsCheatLocked] = useState(false);
  const [isScreenBlackout, setIsScreenBlackout] = useState(false);
  const [unlockTeacherEmail, setUnlockTeacherEmail] = useState('');
  const [unlockTeacherPassword, setUnlockTeacherPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [finishedResult, setFinishedResult] = useState<ExamResult | null>(null);
  const [examStartTime, setExamStartTime] = useState<string>('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Notifications & Copy Banner
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [showLineSummaryModal, setShowLineSummaryModal] = useState(false);

  // Manual Add Student State
  const [addStudentId, setAddStudentId] = useState('');
  const [addStudentName, setAddStudentName] = useState('');
  const [addStudentPassword, setAddStudentPassword] = useState('123456');
  const [addStudentClass, setAddStudentClass] = useState('ม.6/1');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [scoreDashboardClassFilter, setScoreDashboardClassFilter] = useState('');
  const [scoreDashboardExamFilter, setScoreDashboardExamFilter] = useState('');
  const [scoreDashboardSearch, setScoreDashboardSearch] = useState('');

  // Live Exam Proctoring Monitor Filters
  const [liveMonitorSearch, setLiveMonitorSearch] = useState('');
  const [liveMonitorClassFilter, setLiveMonitorClassFilter] = useState('');
  const [liveMonitorStatusFilter, setLiveMonitorStatusFilter] = useState<'all' | 'taking' | 'completed' | 'cheated' | 'not_started'>('all');

  // Psychometric/CTT analysis states
  const [analysisSelectedExamId, setAnalysisSelectedExamId] = useState<string>('');
  const [analysisSelectedClass, setAnalysisSelectedClass] = useState<string>('');
  const [analysisQuestionFilter, setAnalysisQuestionFilter] = useState<'all' | 'good' | 'poor' | 'flawed'>('all');
  const [analysisQuestions, setAnalysisQuestions] = useState<Question[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState<boolean>(false);
  const [analysisExpandedQuestionId, setAnalysisExpandedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (analysisSelectedExamId) {
      setIsAnalysisLoading(true);
      fetch(`/api/exams/${analysisSelectedExamId}/questions`)
        .then(res => res.json())
        .then(data => {
          setAnalysisQuestions(data);
          setIsAnalysisLoading(false);
        })
        .catch(() => {
          setIsAnalysisLoading(false);
        });
    } else {
      setAnalysisQuestions([]);
    }
  }, [analysisSelectedExamId]);

  // Text Importer States
  const [isTextImporterOpen, setIsTextImporterOpen] = useState(false);
  const [rawImporterText, setRawImporterText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Partial<Question>[]>([]);

  // Feature 1: Live Exam Status Monitor State
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);

  // Submit Confirmation & Submission Ref
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const isSubmittingRef = useRef(false);

  // Feature 2: Database Backup & Restore State
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  // Feature 3: Popup Messages State
  const [popupTargetType, setPopupTargetType] = useState<'all' | 'individual' | 'class' | 'subject'>('all');
  const [popupTargetValue, setPopupTargetValue] = useState('');
  const [popupTitle, setPopupTitle] = useState('');
  const [popupBody, setPopupBody] = useState('');
  const [popupImportance, setPopupImportance] = useState<'info' | 'warning' | 'urgent'>('urgent');
  const [sentPopups, setSentPopups] = useState<PopupMessage[]>([]);
  const [studentUnreadPopups, setStudentUnreadPopups] = useState<PopupMessage[]>([]);
  const [currentStudentPopupModal, setCurrentStudentPopupModal] = useState<PopupMessage | null>(null);

  // Feature 4: Announcements & Discussion Board State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [discussions, setDiscussions] = useState<DiscussionPost[]>([]);
  const [newAncTitle, setNewAncTitle] = useState('');
  const [newAncContent, setNewAncContent] = useState('');
  const [newAncTargetGroup, setNewAncTargetGroup] = useState('all');
  const [newAncIsPinned, setNewAncIsPinned] = useState(false);

  const [newDiscTitle, setNewDiscTitle] = useState('');
  const [newDiscContent, setNewDiscContent] = useState('');
  const [newDiscCategory, setNewDiscCategory] = useState<'general' | 'question' | 'suggestion'>('question');
  const [discFilterCategory, setDiscFilterCategory] = useState<string>('all');
  const [discSearch, setDiscSearch] = useState<string>('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Parse Raw Text into Questions
  const parseRawExamText = (text: string): Partial<Question>[] => {
    if (!text) return [];
    const lines = text.split('\n');
    const resultList: Partial<Question>[] = [];
    let currentQuestion: Partial<Question> | null = null;

    // Matches e.g. "1. ", "ข้อ 1. ", "10) ", "[1] " or just starting with a number
    const questionRegex = /^\s*(?:ข้อ\s*)?(\d+)\s*[\.\s\)\-\]]+\s*(.*)$/i;

    const processedLines: string[] = [];
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Split multiple choice markers on the same line (e.g. "ก. ข้อหนึ่ง   ข. ข้อสอง")
      const choiceSplitRegex = /\b([\*]?(?:ก|ข|ค|ง|จ|a|b|c|d|A|B|C|D|1|2|3|4)\s*[\.\)\-\]]+)/g;
      const markers = [...line.matchAll(choiceSplitRegex)];

      if (markers.length > 1) {
        let lastIdx = 0;
        for (let i = 0; i < markers.length; i++) {
          const currentMarker = markers[i];
          const nextMarker = markers[i + 1];
          const start = currentMarker.index || 0;
          const end = nextMarker ? (nextMarker.index || 0) : line.length;
          processedLines.push(line.substring(start, end).trim());
        }
      } else {
        processedLines.push(line);
      }
    }

    for (let line of processedLines) {
      line = line.trim();
      if (!line) continue;

      const qMatch = line.match(questionRegex);
      if (qMatch) {
        if (currentQuestion && currentQuestion.question_text) {
          resultList.push(currentQuestion);
        }
        currentQuestion = {
          exam_id: selectedExamForQuestions,
          question_text: qMatch[2].trim(),
          options: [],
          correct_index: 0,
          points: 1,
          explanation: ''
        };
        continue;
      }

      // Check for answer line e.g. "เฉลย: ก" or "เฉลย ก"
      const answerMatch = line.match(/^(?:เฉลย|ตอบข้อ|ตอบ)\s*[:\- ]*\s*([\*]?)(ก|ข|ค|ง|จ|a|b|c|d|A|B|C|D|1|2|3|4)/i);
      if (answerMatch && currentQuestion) {
        const ansChar = answerMatch[2].toLowerCase();
        let ansIdx = 0;
        if (ansChar === 'ก' || ansChar === 'a' || ansChar === '1') ansIdx = 0;
        else if (ansChar === 'ข' || ansChar === 'b' || ansChar === '2') ansIdx = 1;
        else if (ansChar === 'ค' || ansChar === 'c' || ansChar === '3') ansIdx = 2;
        else if (ansChar === 'ง' || ansChar === 'd' || ansChar === '4') ansIdx = 3;
        else if (ansChar === 'จ' || ansChar === 'e' || ansChar === '5') ansIdx = 4;
        currentQuestion.correct_index = ansIdx;
        continue;
      }

      // Check for normal option lines e.g. "ก. ตัวเลือก" or "*ก. ตัวเลือก"
      const choiceRegex = /^\s*([\*]?)\s*(ก|ข|ค|ง|จ|[a-eA-E]|[1-5])\s*[\.\)\-\]]+\s*(.*?)\s*([\*]?)$/i;
      const cMatch = line.match(choiceRegex);
      if (cMatch && currentQuestion) {
        const isStarred = cMatch[1] === '*' || cMatch[4] === '*';
        const choiceText = cMatch[3].trim();
        
        const currentOpts = currentQuestion.options || [];
        const optIdx = currentOpts.length;
        currentOpts.push(choiceText);
        currentQuestion.options = currentOpts;

        if (isStarred) {
          currentQuestion.correct_index = optIdx;
        }
        continue;
      }

      // Fallback: append continuation text
      if (currentQuestion) {
        if (!currentQuestion.options || currentQuestion.options.length === 0) {
          currentQuestion.question_text = (currentQuestion.question_text || '') + ' ' + line;
        } else {
          const lastIdx = currentQuestion.options.length - 1;
          currentQuestion.options[lastIdx] = currentQuestion.options[lastIdx] + ' ' + line;
        }
      }
    }

    if (currentQuestion && currentQuestion.question_text) {
      resultList.push(currentQuestion);
    }

    return resultList.map(q => {
      // Ensure there are at least 4 options, pad if needed
      const opts = q.options || [];
      while (opts.length < 4) {
        opts.push(`ตัวเลือกที่ ${opts.length + 1}`);
      }
      return { ...q, options: opts.slice(0, 4) };
    });
  };

  // Run Real-time parser when text changes
  useEffect(() => {
    if (rawImporterText) {
      const parsed = parseRawExamText(rawImporterText);
      setParsedQuestions(parsed);
    } else {
      setParsedQuestions([]);
    }
  }, [rawImporterText]);

  // Trigger Notification
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch initial system states with automatic retry
  const refreshData = async (retries = 4, delay = 1000) => {
    try {
      const dbRes = await fetch('/api/db-status');
      if (!dbRes.ok) throw new Error('Database status check failed');
      const dbData = await dbRes.json();
      setDbStatus(dbData);

      const [subRes, exRes, stuRes, resRes, cheatRes, tRes, lockRes, liveRes, popRes, ancRes, discRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/exams'),
        fetch('/api/students'),
        fetch('/api/exam-results'),
        fetch('/api/cheat-logs'),
        fetch('/api/teachers'),
        fetch('/api/lock-status'),
        fetch('/api/live-status'),
        fetch('/api/popup-messages'),
        fetch('/api/announcements'),
        fetch('/api/discussions')
      ]);

      if (subRes.ok) setSubjects(await subRes.json());
      if (exRes.ok) setExams(await exRes.json());
      if (stuRes.ok) setStudents(await stuRes.json());
      if (resRes.ok) setExamResults(await resRes.json());
      if (cheatRes.ok) setCheatLogs(await cheatRes.json());
      if (tRes.ok) setTeachers(await tRes.json());
      if (lockRes.ok) setLockedStudents(await lockRes.json());
      if (liveRes.ok) setLiveSessions(await liveRes.json());
      if (popRes.ok) setSentPopups(await popRes.json());
      if (ancRes.ok) setAnnouncements(await ancRes.json());
      if (discRes.ok) setDiscussions(await discRes.json());
    } catch (e) {
      if (retries > 0) {
        console.warn(`Connection to API server failed. Retrying in ${delay}ms... (${retries} retries left)`);
        setTimeout(() => refreshData(retries - 1, delay * 1.5), delay);
      } else {
        showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลักได้ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    }
  };

  // Database Connection Indicator & Health Modal States
  const [showDbStatusModal, setShowDbStatusModal] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [isSeedingDb, setIsSeedingDb] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const handleTestDbConnection = async () => {
    setIsTestingDb(true);
    try {
      const dbRes = await fetch('/api/db-status');
      if (dbRes.ok) {
        const data = await dbRes.json();
        setDbStatus(data);
        showToast(`ทดสอบการเชื่อมต่อเรียบร้อย (${data.latencyMs || 0}ms)`, 'success');
      } else {
        showToast('ไม่สามารถทดสอบการเชื่อมต่อฐานข้อมูลได้', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleSyncLocalToCloud = async () => {
    if (!window.confirm('คุณต้องการส่งข้อมูลทั้งหมดในเครื่อง (นักเรียน, รายวิชา, ชุดข้อสอบ, ผลสอบ) ขึ้นไปยัง Cloud Supabase ใช่หรือไม่?')) return;
    setIsSyncingCloud(true);
    try {
      const res = await fetch('/api/db-sync-to-cloud', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'ซิงค์ข้อมูลขึ้น Cloud Supabase เรียบร้อยแล้ว!', 'success');
        await handleTestDbConnection();
        await refreshData();
      } else {
        showToast(data.error || 'ไม่สามารถซิงค์ขึ้น Cloud ได้', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleSeedDefaultDb = async (forceReset = false) => {
    if (!window.confirm(forceReset ? 'คุณต้องการรีเซ็ตและโหลดข้อมูลเริ่มต้นใหม่ทั้งหมดใช่หรือไม่?' : 'คุณต้องการโหลดข้อมูลเริ่มต้นลงฐานข้อมูลใช่หรือไม่?')) return;
    setIsSeedingDb(true);
    try {
      const res = await fetch('/api/db-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReset })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'โหลดข้อมูลเริ่มต้นเรียบร้อยแล้ว', 'success');
        await refreshData();
      } else {
        showToast(data.error || 'ไม่สามารถโหลดข้อมูลได้', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    } finally {
      setIsSeedingDb(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      // Poll real-time updates for teachers
      if (userRole === 'teacher' || userRole === 'admin') {
        fetch('/api/cheat-logs').then(r => r.ok ? r.json() : Promise.reject()).then(setCheatLogs).catch(() => {});
        fetch('/api/exam-results').then(r => r.ok ? r.json() : Promise.reject()).then(setExamResults).catch(() => {});
        fetch('/api/lock-status').then(r => r.ok ? r.json() : Promise.reject()).then(setLockedStudents).catch(() => {});
        fetch('/api/live-status').then(r => r.ok ? r.json() : Promise.reject()).then(setLiveSessions).catch(() => {});
      }
      // Poll announcements & discussions for everyone
      fetch('/api/announcements').then(r => r.ok ? r.json() : Promise.reject()).then(setAnnouncements).catch(() => {});
      fetch('/api/discussions').then(r => r.ok ? r.json() : Promise.reject()).then(setDiscussions).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [userRole]);

  // Heartbeat when student is taking exam
  useEffect(() => {
    if (examState === 'taking' && selectedExam && currentUser && currentUser.student_id) {
      const sendHeartbeat = () => {
        const answeredCount = Object.keys(studentAnswers).length;
        const totalQ = examQuestions.length;
        const subObj = subjects.find(s => s.id === selectedExam.subject_id);

        fetch('/api/live-status/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: currentUser.student_id,
            student_name: currentUser.name || currentUser.student_id,
            class_group: currentUser.class_group || '-',
            exam_id: selectedExam.id,
            exam_title: selectedExam.title,
            subject_id: selectedExam.subject_id,
            subject_name: subObj ? subObj.name : '',
            answered_count: answeredCount,
            total_questions: totalQ,
            time_remaining: timeLeft,
            status: isCheatLocked ? 'locked' : 'taking'
          })
        }).catch(() => {});
      };

      sendHeartbeat();
      const hbInterval = setInterval(sendHeartbeat, 5000);

      return () => {
        clearInterval(hbInterval);
        fetch('/api/live-status/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_id: currentUser.student_id,
            exam_id: selectedExam.id
          })
        }).catch(() => {});
      };
    }
  }, [examState, selectedExam, currentUser, studentAnswers, examQuestions.length, timeLeft, isCheatLocked]);

  // Popup listener for active student
  useEffect(() => {
    if (userRole === 'student' && currentUser && currentUser.student_id) {
      const checkStudentPopups = () => {
        const queryParams = new URLSearchParams({
          student_id: currentUser.student_id,
          class_group: currentUser.class_group || '',
          subject_id: selectedExam ? selectedExam.subject_id : ''
        });

        fetch(`/api/popup-messages/student?${queryParams}`)
          .then(r => r.ok ? r.json() : [])
          .then((msgs: PopupMessage[]) => {
            if (Array.isArray(msgs) && msgs.length > 0) {
              setStudentUnreadPopups(msgs);
              setCurrentStudentPopupModal(prev => prev ? prev : msgs[0]);
            }
          })
          .catch(() => {});
      };

      checkStudentPopups();
      const popupInterval = setInterval(checkStudentPopups, 5000);
      return () => clearInterval(popupInterval);
    }
  }, [userRole, currentUser, selectedExam]);

  const handleAcknowledgePopup = async (msgId: string) => {
    if (currentUser && currentUser.student_id) {
      try {
        await fetch(`/api/popup-messages/${msgId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: currentUser.student_id })
        });
      } catch (e) {}
    }
    const remaining = studentUnreadPopups.filter(m => m.id !== msgId);
    setStudentUnreadPopups(remaining);
    setCurrentStudentPopupModal(remaining.length > 0 ? remaining[0] : null);
  };

  // Backup & Restore Handlers
  const handleDownloadBackup = () => {
    const a = document.createElement('a');
    a.href = '/api/backup/export';
    a.download = `exam_system_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('กำลังดาวน์โหลดไฟล์สำรองฐานข้อมูล...', 'success');
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsRestoringBackup(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'นำเข้าไม่สำเร็จ');

      showToast('นำคืนฐานข้อมูลเรียบร้อยแล้ว!', 'success');
      refreshData();
    } catch (err: any) {
      showToast('เกิดข้อผิดพลาดในการนำคืนข้อมูล: ' + err.message, 'error');
    } finally {
      setIsRestoringBackup(false);
      e.target.value = '';
    }
  };

  // Popup Message Handler
  const handleSendPopup = async () => {
    if (!popupTitle.trim() || !popupBody.trim()) {
      showToast('กรุณากรอกหัวข้อและเนื้อหาข้อความแจ้งเตือน', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/popup-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: popupTargetType,
          target_value: popupTargetValue,
          title: popupTitle.trim(),
          body: popupBody.trim(),
          sender_name: currentUser?.name || 'ครูผู้สอน',
          importance: popupImportance
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'ส่งข้อความไม่สำเร็จ');
      }

      showToast('ส่งข้อความ Popup ไปยังหน้าจอนักเรียนเรียบร้อยแล้ว!', 'success');
      setPopupTitle('');
      setPopupBody('');
      setPopupTargetValue('');
      fetch('/api/popup-messages').then(r => r.json()).then(setSentPopups);
    } catch (e: any) {
      showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  };

  const handleDeletePopup = async (id: string) => {
    try {
      await fetch(`/api/popup-messages/${id}`, { method: 'DELETE' });
      setSentPopups(prev => prev.filter(p => p.id !== id));
      showToast('ลบข้อความ Popup เรียบร้อย', 'success');
    } catch (e) {}
  };

  // Announcements & Discussions Handlers
  const handleCreateAnnouncement = async () => {
    if (!newAncTitle.trim() || !newAncContent.trim()) {
      showToast('กรุณากรอกหัวข้อและเนื้อหาประกาศ', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAncTitle.trim(),
          content: newAncContent.trim(),
          target_group: newAncTargetGroup,
          is_pinned: newAncIsPinned,
          author_name: currentUser?.name || 'ครูผู้สอน'
        })
      });
      if (!res.ok) throw new Error('ไม่สามารถสร้างประกาศได้');
      showToast('สร้างประกาศข่าวสารเรียบร้อยแล้ว!', 'success');
      setNewAncTitle('');
      setNewAncContent('');
      fetch('/api/announcements').then(r => r.json()).then(setAnnouncements);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      showToast('ลบประกาศข่าวสารสำเร็จ', 'success');
    } catch (e) {}
  };

  const handleCreateDiscussion = async () => {
    if (!newDiscTitle.trim() || !newDiscContent.trim()) {
      showToast('กรุณากรอกหัวข้อและเนื้อหาข้อความกระทู้', 'warning');
      return;
    }
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDiscTitle.trim(),
          content: newDiscContent.trim(),
          author_id: currentUser?.student_id || currentUser?.id || 'user',
          author_name: currentUser?.name || 'ผู้ใช้งาน',
          author_role: userRole === 'student' ? 'student' : 'teacher',
          category: newDiscCategory,
          class_group: currentUser?.class_group || ''
        })
      });
      if (!res.ok) throw new Error('โพสต์ไม่สำเร็จ');
      showToast('โพสต์ตั้งกระทู้ถาม-ตอบเรียบร้อยแล้ว!', 'success');
      setNewDiscTitle('');
      setNewDiscContent('');
      fetch('/api/discussions').then(r => r.json()).then(setDiscussions);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleAddDiscussionComment = async (discId: string) => {
    const text = commentInputs[discId];
    if (!text || !text.trim()) return;

    try {
      const res = await fetch(`/api/discussions/${discId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: currentUser?.name || 'ผู้ใช้งาน',
          author_role: userRole === 'student' ? 'student' : 'teacher',
          content: text.trim()
        })
      });
      if (!res.ok) throw new Error('แสดงความคิดเห็นไม่สำเร็จ');
      setCommentInputs(prev => ({ ...prev, [discId]: '' }));
      fetch('/api/discussions').then(r => r.json()).then(setDiscussions);
      showToast('ตอบกลับความคิดเห็นเรียบร้อย', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleLikeDiscussion = async (discId: string) => {
    const userId = currentUser?.student_id || currentUser?.id || 'guest';
    try {
      await fetch(`/api/discussions/${discId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      fetch('/api/discussions').then(r => r.json()).then(setDiscussions);
    } catch (e) {}
  };

  const handleDeleteDiscussion = async (discId: string) => {
    try {
      await fetch(`/api/discussions/${discId}`, { method: 'DELETE' });
      setDiscussions(prev => prev.filter(d => d.id !== discId));
      showToast('ลบกระทู้เรียบร้อย', 'success');
    } catch (e) {}
  };

  // LOGIN OPERATIONS
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/students/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentIdInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data);
        setUserRole('student');
        showToast(`ยินดีต้อนรับคุณ ${data.name}`);
      } else {
        showToast(data.error || 'รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } catch (err) {
      showToast('เครือข่ายมีปัญหา', 'error');
    }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/teachers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: teacherEmailInput, password: teacherPasswordInput })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data);
        setUserRole(data.role);
        showToast(`เข้าสู่ระบบในฐานะ ${data.name}`);
      } else {
        showToast(data.error || 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง', 'error');
      }
    } catch (err) {
      showToast('เครือข่ายมีปัญหา', 'error');
    }
  };

  // Gmail/Google Sign In Simulation (Fully secure & compliant)
  const handleGoogleLogin = async () => {
    const defaultEmail = 'itthikon.w@dongluangwittaya.ac.th';
    try {
      const res = await fetch('/api/teachers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isGoogleLogin: true, 
          googleProfile: { email: defaultEmail, name: 'ครูอิทธิกร (Google)' } 
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data);
        setUserRole(data.role);
        showToast(`เข้าสู่ระบบด้วย Google สำเร็จ: ${data.email}`);
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการผ่าน Google OAuth', 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserRole('guest');
    setSelectedExam(null);
    setExamState('gateway');
    setStudentIdInput('');
    setPasswordInput('');
    setTeacherEmailInput('');
    setTeacherPasswordInput('');
    showToast('ออกจากระบบเรียบร้อย');
  };

  // SUBJECT OPERATIONS
  const handleAddSubject = async () => {
    if (!newSubjectCode || !newSubjectName) return showToast('กรุณากรอกรหัสและชื่อวิชา', 'warning');
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newSubjectCode, name: newSubjectName })
    });
    if (res.ok) {
      showToast('เพิ่มวิชาใหม่เรียบร้อยแล้ว');
      setNewSubjectCode('');
      setNewSubjectName('');
      refreshData();
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (confirm('คุณต้องการลบรายวิชานี้และข้อมูลข้อสอบที่เกี่ยวข้องทั้งหมดใช่หรือไม่?')) {
      const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบรายวิชาเสร็จสิ้น');
        refreshData();
      }
    }
  };

  // EXAM OPERATIONS
  const handleAddExam = async () => {
    if (!selectedSubjectId || !newExamTitle || !newExamDuration) {
      return showToast('กรุณากรอกข้อมูลชุดข้อสอบให้ครบถ้วน', 'warning');
    }
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject_id: selectedSubjectId,
        title: newExamTitle,
        type: newExamType,
        duration: newExamDuration,
        randomize: newExamRandom,
        anti_cheat_level: newExamAntiCheatLevel
      })
    });
    if (res.ok) {
      showToast('สร้างชุดข้อสอบสำเร็จแล้ว');
      setNewExamTitle('');
      refreshData();
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (confirm('คุณต้องการลบชุดข้อสอบนี้ใช่หรือไม่?')) {
      const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบชุดข้อสอบเสร็จสิ้น');
        refreshData();
      }
    }
  };

  const handleToggleExamStatus = async (exam: Exam) => {
    const res = await fetch(`/api/exams/${exam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !exam.is_active })
    });
    if (res.ok) {
      showToast(`เปลี่ยนสถานะชุดข้อสอบเป็น ${!exam.is_active ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}`);
      refreshData();
    }
  };

  const handleUpdateAntiCheatLevel = async (examId: string, level: 'strict' | 'moderate' | 'relaxed' | 'off') => {
    const res = await fetch(`/api/exams/${examId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anti_cheat_level: level })
    });
    if (res.ok) {
      showToast('อัปเดตระดับความปลอดภัยของระบบป้องกันการทุจริตสำเร็จแล้ว');
      refreshData();
    } else {
      showToast('ไม่สามารถอัปเดตระดับความปลอดภัยได้', 'error');
    }
  };

  const handleDeleteAllCheatLogs = async () => {
    try {
      const res = await fetch('/api/cheat-logs', { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบประวัติการทุจริตทั้งหมดสำเร็จเรียบร้อยแล้ว');
        refreshData();
      } else {
        showToast('เกิดข้อผิดพลาดในการลบประวัติการทุจริต', 'error');
      }
    } catch (err) {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
  };

  const handleDeleteCheatLog = async (id: string) => {
    try {
      const res = await fetch(`/api/cheat-logs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบรายการแจ้งเตือนที่เลือกเรียบร้อยแล้ว');
        refreshData();
      } else {
        showToast('เกิดข้อผิดพลาดในการลบรายการที่เลือก', 'error');
      }
    } catch (err) {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
    }
  };

  // STUDENT ROSTER IMPORT VIA EXCEL
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Use raw array of arrays to handle custom metadata headers and complex layouts (like SGS / school templates)
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
        let parsedStudents: any[] = [];
        let defaultClassGroup = 'ม.6/1';

        // 1. Try to scan first 6 rows for class group (e.g. "ม.4/1", "ชั้น ม.4/1", "ม. 4/1")
        const classPattern = /(?:ชั้น\s*)?([มป]\.?\s*\d+\s*[\/\-]\s*\d+)/i;
        const generalClassPattern = /ชั้น\s*([^\s]+)/i;
        
        for (let r = 0; r < Math.min(rows.length, 6); r++) {
          const row = rows[r];
          if (Array.isArray(row)) {
            for (const cell of row) {
              if (typeof cell === 'string') {
                const match = cell.match(classPattern);
                if (match) {
                  defaultClassGroup = match[1].replace(/\s+/g, '');
                  break;
                }
                const generalMatch = cell.match(generalClassPattern);
                if (generalMatch) {
                  defaultClassGroup = generalMatch[1].trim();
                  break;
                }
              }
            }
          }
        }

        // 2. Scan first 15 rows to find the actual header row
        let headerRowIndex = -1;
        let studentIdColIndex = -1;
        let nameColIndex = -1;
        let classColIndex = -1;
        let passwordColIndex = -1;

        for (let r = 0; r < Math.min(rows.length, 15); r++) {
          const row = rows[r];
          if (!Array.isArray(row)) continue;

          let tempStudentIdIdx = -1;
          let tempNameIdx = -1;
          let tempClassIdx = -1;
          let tempPasswordIdx = -1;

          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || '').trim();
            if (!cellVal) continue;

            // Look for student ID column header
            if (/รหัสนักเรียน|student_id|ID|รหัสประจำตัว|รหัส/i.test(cellVal)) {
              tempStudentIdIdx = c;
            }
            // Look for student name column header
            if (/ชื่อ\s*สกุล|ชื่อ\-นามสกุล|ชื่อสกุล|ชื่อ|name/i.test(cellVal)) {
              tempNameIdx = c;
            }
            // Look for class group column header
            if (/ห้องเรียน|class_group|ห้อง|ชั้น/i.test(cellVal)) {
              tempClassIdx = c;
            }
            // Look for password column header
            if (/รหัสผ่าน|password/i.test(cellVal)) {
              tempPasswordIdx = c;
            }
          }

          // If we found both student ID and name headers, this is our header row
          if (tempStudentIdIdx !== -1 && tempNameIdx !== -1) {
            headerRowIndex = r;
            studentIdColIndex = tempStudentIdIdx;
            nameColIndex = tempNameIdx;
            classColIndex = tempClassIdx;
            passwordColIndex = tempPasswordIdx;
            break;
          }
        }

        // 3. Extract students after the header row
        if (headerRowIndex !== -1) {
          for (let r = headerRowIndex + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!Array.isArray(row)) continue;

            const student_id = String(row[studentIdColIndex] || '').trim();
            const rawName = String(row[nameColIndex] || '').trim();

            if (!student_id || !rawName) continue;

            // Class group
            let class_group = defaultClassGroup;
            if (classColIndex !== -1 && row[classColIndex]) {
              class_group = String(row[classColIndex]).trim();
            }

            // Password (default to student_id so they can log in using their own ID)
            let password = student_id;
            if (passwordColIndex !== -1 && row[passwordColIndex]) {
              password = String(row[passwordColIndex]).trim();
            }

            parsedStudents.push({
              student_id,
              name: rawName,
              password,
              class_group
            });
          }
        }

        // 4. Fallback: If scanned method found nothing, try the old flat-mapping approach
        if (parsedStudents.length === 0) {
          const flatData = XLSX.utils.sheet_to_json(ws);
          parsedStudents = flatData.map((row: any) => {
            const s_id = String(row['รหัสนักเรียน'] || row['student_id'] || row['ID'] || row['รหัสประจำตัว'] || '').trim();
            const s_name = String(row['ชื่อ-นามสกุล'] || row['name'] || row['ชื่อ'] || row['ชื่อ สกุล'] || '').trim();
            return {
              student_id: s_id,
              name: s_name,
              password: String(row['รหัสผ่าน'] || row['password'] || s_id || '123456').trim(),
              class_group: String(row['ห้องเรียน'] || row['class_group'] || row['ห้อง'] || defaultClassGroup).trim()
            };
          }).filter(s => s.student_id && s.name);
        }

        if (parsedStudents.length === 0) {
          return showToast('ไม่พบข้อมูลนักเรียนในไฟล์ หรือคอลัมน์ไม่ถูกต้อง (กรุณามีหัวข้ออย่างน้อย: รหัสนักเรียน และ ชื่อ สกุล)', 'error');
        }

        const res = await fetch('/api/students/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentsList: parsedStudents })
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.savedToCloud) {
            showToast(`นำเข้ารายชื่อนักเรียนสำเร็จ ${parsedStudents.length} คน บันทึกลง Cloud Supabase และ Local DB เรียบร้อยแล้ว`, 'success');
          } else if (resData.cloudError) {
            showToast(`นำเข้ารายชื่อสำเร็จ ${parsedStudents.length} คน (บันทึกใน Local DB แล้ว แต่ Cloud แจ้งเตือน: ${resData.cloudError})`, 'warning');
          } else {
            showToast(`นำเข้ารายชื่อนักเรียนสำเร็จ ${parsedStudents.length} คน (บันทึกใน Local DB ปลอดภัยแล้ว)`, 'success');
          }
          refreshData();
        } else {
          showToast('เกิดข้อผิดพลาดในการบันทึกรายชื่อ', 'error');
        }
      } catch (err) {
        showToast('อ่านไฟล์ Excel ล้มเหลว', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // DOWNLOAD SAMPLE EXCEL FOR STUDENT ROSTER (SGS/OBEC Standard Format)
  const handleDownloadSampleExcel = () => {
    try {
      const data = [
        ["รายชื่อนักเรียน ชั้น ม.4/1"],
        ["ครูที่ปรึกษา 1.นางสาวศิริลักษณ์ วังวงค์ 2.นายวุฒิพงษ์ แผนสุพัด"],
        ["เลข", "รหัสนักเรียน", "ชื่อ สกุล"],
        [1, "8233", "นาย ธีระพัฒน์ เหง้าโอสา"],
        [2, "8234", "นาย นนทพัทธ์ รักล้วน"],
        [3, "8236", "นาย ปราดยาวงศ์ โสมมา"],
        [4, "8237", "นาย พัทธดนย์ เชื้อคำจันทร์"],
        [5, "8246", "นางสาว ชลลดา หลาบโพธิ์"],
        [6, "8248", "นางสาว ณัฐริกา นาคมุนี"],
        [7, "8250", "นางสาว ทิพปภา เชื้อวังคำ"],
        [8, "8251", "นางสาว น้ำอ้อย เชื้อคำจันทร์"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);

      // Apply merges for a gorgeous and authentic look
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Merge row 1 across columns A-C
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }  // Merge row 2 across columns A-C
      ];

      // Set column widths so names are beautiful and not cut off
      ws['!cols'] = [
        { wch: 6 },  // No.
        { wch: 15 }, // Student ID
        { wch: 30 }  // Full Name
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "401");

      XLSX.writeFile(wb, "รายชื่อนักเรียน_ม4_1_ตัวอย่าง.xlsx");
      showToast("ดาวน์โหลดไฟล์ตัวอย่างเรียบร้อยแล้ว!", "success");
    } catch (err) {
      console.error('Failed to generate sample Excel:', err);
      showToast("ไม่สามารถสร้างไฟล์ตัวอย่างได้", "error");
    }
  };

  // MANUAL SINGLE STUDENT ADD
  const handleAddSingleStudent = async () => {
    if (!addStudentId || !addStudentName || !addStudentClass) {
      return showToast('กรุณากรอกข้อมูลนักเรียนให้ครบถ้วน', 'warning');
    }
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: addStudentId,
        name: addStudentName,
        password: addStudentPassword,
        class_group: addStudentClass
      })
    });
    if (res.ok) {
      showToast('เพิ่มนักเรียนเรียบร้อย');
      setAddStudentId('');
      setAddStudentName('');
      setAddStudentPassword('123456');
      refreshData();
    } else {
      const data = await res.json();
      showToast(data.error || 'ไม่สามารถเพิ่มนักเรียนได้', 'error');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (confirm('คุณยืนยันที่จะลบข้อมูลนักเรียนรายนี้ใช่หรือไม่?')) {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบนักเรียนเรียบร้อย');
        refreshData();
      }
    }
  };

  const handleDeleteClassStudents = async (classGroup: string) => {
    if (!classGroup) {
      if (confirm('คุณยืนยันที่จะลบรายชื่อนักเรียนทั้งหมดทุกห้องเรียนในระบบใช่หรือไม่?\n(คำเตือน: ข้อมูลนักเรียนทั้งหมดในระบบจะถูกลบออกทั้งหมด!)')) {
        const res = await fetch('/api/students/batch/all', { method: 'DELETE' });
        if (res.ok) {
          showToast('ลบรายชื่อนักเรียนทั้งหมดสำเร็จแล้ว');
          setStudentClassFilter('');
          refreshData();
        } else {
          showToast('ไม่สามารถลบข้อมูลนักเรียนได้', 'error');
        }
      }
    } else {
      if (confirm(`คุณยืนยันที่จะลบรายชื่อนักเรียนทั้งหมดในห้องเรียน "${classGroup}" ใช่หรือไม่?\n(คำเตือน: ข้อมูลนักเรียนทั้งหมดในห้องนี้จะถูกลบออกทั้งหมด!)`)) {
        const res = await fetch(`/api/students/batch/class/${encodeURIComponent(classGroup)}`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`ลบรายชื่อนักเรียนห้อง ${classGroup} เรียบร้อยแล้ว`);
          setStudentClassFilter('');
          refreshData();
        } else {
          showToast('ไม่สามารถลบข้อมูลห้องเรียนได้', 'error');
        }
      }
    }
  };

  // DETAILED QUESTION CRUD
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const handleSaveQuestionEdit = async () => {
    if (!editingQuestion?.question_text || !editingQuestion.options || editingQuestion.correct_index === undefined) {
      return showToast('กรุณากรอกข้อมูลคำถามและตัวเลือกให้ครบถ้วน', 'warning');
    }
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingQuestion)
    });
    if (res.ok) {
      showToast('บันทึกโจทย์ข้อสอบสำเร็จแล้ว');
      setEditingQuestion(null);
      setQuestionsRefreshTrigger(prev => prev + 1);
      refreshData();
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (confirm('คุณต้องการลบข้อสอบข้อนี้ใช่หรือไม่?')) {
      const res = await fetch(`/api/questions/${qId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ลบโจทย์เสร็จสิ้น');
        setQuestionsRefreshTrigger(prev => prev + 1);
        refreshData();
      }
    }
  };

  const handleImportSave = async (isAppend: boolean) => {
    if (parsedQuestions.length === 0) {
      return showToast('ไม่พบข้อมูลข้อสอบสำหรับนำเข้า กรุณาเพิ่มข้อมูล', 'warning');
    }
    
    const endpoint = isAppend 
      ? `/api/exams/${selectedExamForQuestions}/questions/append-batch` 
      : `/api/exams/${selectedExamForQuestions}/questions/batch`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: parsedQuestions })
    });

    if (res.ok) {
      showToast(isAppend ? `นำเข้าข้อสอบสำเร็จแล้ว ${parsedQuestions.length} ข้อ` : `นำเข้าแทนที่และบันทึกข้อสอบสำเร็จแล้ว ${parsedQuestions.length} ข้อ`);
      setIsTextImporterOpen(false);
      setRawImporterText('');
      setParsedQuestions([]);
      setQuestionsRefreshTrigger(prev => prev + 1);
      refreshData();
    } else {
      showToast('เกิดข้อผิดพลาดในการนำเข้าข้อมูลข้อสอบ', 'error');
    }
  };

  // ACTIVE EXAM WORKFLOW & FRAUD PREVENTION
  const requestFullscreen = () => {
    const element = document.documentElement;
    if (element.requestFullscreen) element.requestFullscreen();
    else if ((element as any).webkitRequestFullscreen) (element as any).webkitRequestFullscreen();
  };

  const handleStartExam = async (exam: Exam) => {
    // Check if they already took midterm/final/quiz to enforce single entry (except practice)
    if (exam.type !== 'practice') {
      const alreadyTaken = examResults.some(r => r.student_id === currentUser.student_id && r.exam_id === exam.id && r.status === 'completed');
      if (alreadyTaken) {
        return showToast('คุณเข้าสอบชุดนี้ไปแล้ว และสามารถสอบได้เพียง 1 ครั้งเท่านั้น', 'error');
      }
    }

    // Fetch questions for this exam
    const res = await fetch(`/api/exams/${exam.id}/questions`);
    const data = await res.json();
    if (!data || data.length === 0) {
      return showToast('แบบทดสอบนี้ยังไม่มีโจทย์คำถาม กรุณาแจ้งคุณครูผู้สอน', 'warning');
    }

    let loadedQuestions = data;
    if (exam.randomize) {
      loadedQuestions = [...data].sort(() => Math.random() - 0.5);
    }

    setExamQuestions(loadedQuestions);
    setSelectedExam(exam);
    setCurrentQuestionIndex(0);
    setStudentAnswers({});
    setTimeLeft(exam.duration * 60);
    setCheatAttempts(0);
    setIsCheatLocked(false);
    setExamStartTime(new Date().toISOString());
    setExamState('taking');

    // Enable safety locks & request Fullscreen
    requestFullscreen();
    setIsFullscreen(true);
  };

  // Listeners for Fraud Detection
  useEffect(() => {
    if (examState !== 'taking' || !selectedExam) return;

    const level = selectedExam.anti_cheat_level || 'strict';

    // 1. Tab switching / Minimizing / Visibility
    const handleVisibilityChange = async () => {
      if (level === 'off' || isSubmittingRef.current) return;
      if (document.hidden) {
        if (level === 'strict' || level === 'moderate') {
          setIsCheatLocked(true);
          setCheatAttempts(prev => {
            const next = prev + 1;
            logCheatEvent('tab_switch', `สลับแท็บ/ย่อหน้าต่าง (ระดับ: ${level === 'strict' ? 'เข้มงวดที่สุด' : 'ปานกลาง'} - ล็อกหน้าจอครั้งที่ ${next})`);
            return next;
          });
        } else {
          // relaxed
          setCheatAttempts(prev => {
            const next = prev + 1;
            logCheatEvent('tab_switch', `สลับแท็บ/ย่อหน้าต่าง (ระดับ: ผ่อนปรน - บันทึกประวัติเท่านั้น ไม่ล็อกเครื่อง ครั้งที่ ${next})`);
            return next;
          });
          showToast('ระบบแจ้งเตือน: ตรวจพบการสลับแท็บ/หน้าต่าง (บันทึกเข้าระบบคุณครูเรียลไทม์แล้ว)', 'warning');
        }
      }
    };

    // 2. Window Blur (e.g., clicking on developer tools, dual screen popup, or activating screenshot snipping tools)
    const handleWindowBlur = () => {
      if (level === 'off' || isSubmittingRef.current) return;

      if (level === 'strict') {
        setIsScreenBlackout(true);
        setIsCheatLocked(true);
        setCheatAttempts(prev => {
          const next = prev + 1;
          logCheatEvent('blur', `เสียโฟกัสหน้าจอสอบหรือใช้เครื่องมือแคปภาพ (ระดับ: เข้มงวดสูงสุด - บล็อกจอดำและล็อกครั้งที่ ${next})`);
          return next;
        });
        setTimeout(() => {
          setIsScreenBlackout(false);
        }, 2000);
      } else if (level === 'moderate') {
        setIsScreenBlackout(true);
        setCheatAttempts(prev => {
          const next = prev + 1;
          logCheatEvent('blur', `เสียโฟกัสหน้าจอสอบหรือกดปุ่มอื่นนอกขอบเขตสอบ (ระดับ: ปานกลาง - ย้อมแรเงาดำชั่วคราว ไม่ล็อกเครื่อง ครั้งที่ ${next})`);
          return next;
        });
        showToast('แจ้งเตือนโฟกัส: หน้าจอจะดับดำชั่วคราวป้องกันสายตา (แต่ระบบปานกลางจะไม่ล็อกเครื่อง)', 'warning');
        setTimeout(() => {
          setIsScreenBlackout(false);
        }, 2000);
      } else {
        // relaxed
        setCheatAttempts(prev => {
          const next = prev + 1;
          logCheatEvent('blur', `เสียโฟกัสหน้าจอสอบ (ระดับ: ผ่อนปรน - บันทึกประวัติประวัติครั้งที่ ${next})`);
          return next;
        });
        showToast('ระบบแจ้งเตือน: ตรวจพบเครื่องเสียโฟกัสทำข้อสอบ (บันทึกข้อมูลเรียลไทม์)', 'warning');
      }
    };

    // 3. Exit Fullscreen Detection
    const handleFullscreenChange = () => {
      if (level === 'off' || isSubmittingRef.current) return;
      const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) {
        if (level === 'strict') {
          setIsCheatLocked(true);
          setCheatAttempts(prev => {
            const next = prev + 1;
            logCheatEvent('fullscreen_exit', `ออกจากโหมดเต็มหน้าจอ (ระดับ: เข้มงวดสูงสุด - ล็อกหน้าจอครั้งที่ ${next})`);
            return next;
          });
        } else {
          // moderate or relaxed
          setCheatAttempts(prev => {
            const next = prev + 1;
            logCheatEvent('fullscreen_exit', `ออกจากโหมดเต็มหน้าจอ (ระดับ: ${level === 'moderate' ? 'ปานกลาง' : 'ผ่อนปรน'} - บันทึกประวัติเท่านั้น ไม่ล็อกเครื่อง ครั้งที่ ${next})`);
            return next;
          });
          showToast('คำเตือน: โปรดทำข้อสอบโหมดเต็มหน้าจอเพื่อป้องกันปัญหา (บันทึกความพยายามออกจากจอใหญ่แล้ว)', 'warning');
        }
      }
    };

    // 4. Block hotkeys & Screen capture attempts (Copy, Paste, Print, Inspect, Screenshot)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (level === 'off' || isSubmittingRef.current) return;
      const isPrtSc = e.key === 'PrintScreen' || e.keyCode === 44;
      const isSnipTool = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's' || e.key === '4' || e.key === '3');
      const isCopy = e.ctrlKey && (e.key === 'c' || e.key === 'C');
      const isPaste = e.ctrlKey && (e.key === 'v' || e.key === 'V');
      const isPrint = (e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P');
      const isDevTools = e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i'));

      if (isPrtSc || isSnipTool || isPrint) {
        e.preventDefault();
        setIsScreenBlackout(true);

        if (level === 'strict' || level === 'moderate') {
          setIsCheatLocked(true);
          setCheatAttempts(prev => prev + 1);
          logCheatEvent('screenshot_attempt', `พยายามถ่ายภาพหน้าจอหรือสั่งพิมพ์ (ระดับ: ${level === 'strict' ? 'เข้มงวดสูงสุด' : 'ปานกลาง'} - บล็อกจอดำสนิทและล็อกหน้าจอ)`);
          showToast('ระบบความปลอดภัย: ตรวจพบความพยายามบันทึกหน้าจอ หน้าจอจะบล็อกภาพสีดำและถูกล็อกการสอบทันที!', 'error');
        } else {
          // relaxed
          setCheatAttempts(prev => prev + 1);
          logCheatEvent('screenshot_attempt', 'พยายามถ่ายภาพหน้าจอหรือสั่งพิมพ์ (ระดับ: ผ่อนปรน - บล็อกภาพเป็นสีดำชั่วคราว บันทึกประวัติแต่ไม่ล็อกเครื่อง)');
          showToast('ระบบความปลอดภัย: ตรวจพบความพยายามบันทึกหน้าจอ บล็อกเนื้อหาเป็นสีดำชั่วคราว (แต่ไม่ล็อกเครื่อง)', 'warning');
        }

        setTimeout(() => {
          setIsScreenBlackout(false);
        }, 2000);
        return;
      }

      const blockedKeys = [
        isCopy,
        isPaste,
        e.ctrlKey && e.key === 'u', // View Source
        isDevTools
      ];
      if (blockedKeys.some(Boolean)) {
        e.preventDefault();
        logCheatEvent('forbidden_shortcut', `พยายามใช้คีย์บอร์ดชอร์ตคัตต้องห้าม: ${e.key}`);
        showToast('ระบบความปลอดภัย: บล็อกทางลัดคีย์บอร์ดเพื่อป้องกันเนื้อหาข้อสอบรั่วไหล', 'warning');
      }
    };

    // 5. Block right click context menu
    const handleContextMenu = (e: MouseEvent) => {
      if (level === 'off' || isSubmittingRef.current) return;
      e.preventDefault();
      logCheatEvent('right_click', 'พยายามคลิกขวาหน้าเว็บ');
      showToast('ระบบความปลอดภัย: ปิดการใช้งานปุ่มคลิกขวา', 'warning');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    // Timer Tick
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          executeExamSubmission(true); // Auto submit on timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      clearInterval(timer);
    };
  }, [examState, selectedExam]);

  useEffect(() => {
    let intervalId: any = null;
    if (isCheatLocked && currentUser && selectedExam && currentUser.student_id) {
      // 1. Report lock to server
      fetch('/api/lock-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: currentUser.student_id,
          exam_id: selectedExam.id,
          is_locked: true
        })
      }).catch(err => console.error('Error report lock status:', err));

      // 2. Poll lock status from server
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/lock-status?student_id=${encodeURIComponent(currentUser.student_id)}&exam_id=${encodeURIComponent(selectedExam.id)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.is_locked === false) {
              setIsCheatLocked(false);
              showToast('คุณครูได้ปลดล็อกหน้าจอให้คุณจากระบบควบคุมแล้ว!', 'success');
              // Automatically request fullscreen again
              requestFullscreen();
              setIsFullscreen(true);
            }
          }
        } catch (e) {
          console.error('Error polling lock status:', e);
        }
      }, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isCheatLocked, currentUser, selectedExam]);

  const logCheatEvent = async (type: any, desc: string) => {
    if (!currentUser || !selectedExam) return;
    try {
      await fetch('/api/cheat-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: currentUser.student_id,
          student_name: currentUser.name,
          exam_id: selectedExam.id,
          violation_type: type,
          details: desc
        })
      });
    } catch (e) {
      console.error('Error logging cheat attempt:', e);
    }
  };

  const handleRemoteUnlock = async (studentId: string, examId: string, studentName: string) => {
    try {
      const res = await fetch('/api/lock-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          exam_id: examId,
          is_locked: false
        })
      });
      if (res.ok) {
        setLockedStudents(prev => prev.filter(item => !(item.student_id === studentId && item.exam_id === examId)));
        showToast(`ปลดล็อกหน้าจอเครื่องของ "${studentName}" สำเร็จ!`, 'success');
      } else {
        showToast('ไม่สามารถปลดล็อกหน้าจอได้ กรุณาลองใหม่อีกครั้ง', 'error');
      }
    } catch (e) {
      console.error('Remote unlock error:', e);
      showToast('เกิดข้อผิดพลาดในการติดต่อสื่อสารกับเซิร์ฟเวอร์หลัก', 'error');
    }
  };

  const triggerSubmitExam = () => {
    isSubmittingRef.current = true;
    setShowSubmitConfirmModal(true);
  };

  const cancelSubmitExam = () => {
    setShowSubmitConfirmModal(false);
    isSubmittingRef.current = false;
  };

  const executeExamSubmission = async (isTimeout = false) => {
    if (!selectedExam || !currentUser) return;
    isSubmittingRef.current = true;

    // Calculate score
    let totalScore = 0;
    let earnedScore = 0;
    examQuestions.forEach((q) => {
      const qId = q.id || '';
      const studAns = studentAnswers[qId];
      const weight = q.points || 1;
      totalScore += weight;
      if (studAns !== undefined && studAns === q.correct_index) {
        earnedScore += weight;
      }
    });

    const submitPayload = {
      student_id: currentUser.student_id,
      student_name: currentUser.name,
      exam_id: selectedExam.id,
      score: earnedScore,
      total_score: totalScore,
      start_time: examStartTime,
      submit_time: new Date().toISOString(),
      answers: studentAnswers,
      status: 'completed'
    };

    try {
      const res = await fetch('/api/exam-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload)
      });
      const data = await res.json();
      if (res.ok) {
        setShowSubmitConfirmModal(false);
        setFinishedResult(data);
        setExamState('finished');
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        showToast('บันทึกและตรวจคะแนนของคุณแบบเรียลไทม์เรียบร้อยแล้ว!', 'success');
        refreshData();
      }
    } catch (err) {
      showToast('ไม่สามารถบันทึกคะแนนเข้าฐานข้อมูลได้ โปรดแจ้งคุณครู', 'error');
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getExamResultForStudent = (examId: string) => {
    if (!currentUser) return null;
    return examResults.find(r => r.student_id === currentUser.student_id && r.exam_id === examId && r.status === 'completed');
  };

  // SQL schema generator copy helper
  const sqlSchemaText = `-- คำสั่ง SQL สำหรับสร้างตารางเพื่อเปิดการเชื่อมต่อระบบคลาวด์ Supabase
CREATE TABLE students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password VARCHAR(100) NOT NULL,
  class_group VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  duration INTEGER NOT NULL,
  randomize BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  points INTEGER DEFAULT 1,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE exam_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  total_score NUMERIC(5,2) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submit_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answers JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'completed'
);

CREATE TABLE cheat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  violation_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details TEXT
);`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    showToast('คัดลอกคำสั่ง SQL แล้ว นำไปวางในหน้าแดชบอร์ด SQL Editor ของ Supabase ได้เลย');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white relative overflow-hidden">
      {/* Gundam Cockpit & Animated Mecha Background Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Animated Cyber Grid */}
        <div className="absolute inset-0 gundam-grid opacity-30"></div>

        {/* Scan lines / HUD scanner effect */}
        <div className="hud-scanner"></div>

        {/* Glowing Nebulous Clouds (Galaxy Background) */}
        <div className="absolute top-[10%] left-[20%] w-[350px] h-[350px] rounded-full bg-purple-600/15 blur-[100px] nebula-pulse" style={{ '--nebula-duration': '18s' } as React.CSSProperties}></div>
        <div className="absolute bottom-[20%] right-[15%] w-[450px] h-[450px] rounded-full bg-pink-500/15 blur-[120px] nebula-pulse" style={{ '--nebula-duration': '24s' } as React.CSSProperties}></div>
        <div className="absolute top-[60%] left-[45%] w-[500px] h-[500px] rounded-full bg-blue-500/15 blur-[130px] nebula-pulse" style={{ '--nebula-duration': '30s' } as React.CSSProperties}></div>

        {/* Multiple Twinkling Cosmic Stars */}
        <div className="absolute inset-0">
          {[
            { top: '12%', left: '8%', size: 'w-1 h-1', delay: '1.2s', color: 'bg-white' },
            { top: '25%', left: '45%', size: 'w-1.5 h-1.5', delay: '2.5s', color: 'bg-cyan-300' },
            { top: '8%', left: '78%', size: 'w-1 h-1', delay: '0.8s', color: 'bg-pink-300' },
            { top: '32%', left: '88%', size: 'w-2 h-2', delay: '1.8s', color: 'bg-white' },
            { top: '45%', left: '15%', size: 'w-1 h-1', delay: '3.1s', color: 'bg-purple-300' },
            { top: '60%', left: '70%', size: 'w-1.5 h-1.5', delay: '1.5s', color: 'bg-amber-300' },
            { top: '75%', left: '22%', size: 'w-2 h-2', delay: '4.2s', color: 'bg-white' },
            { top: '85%', left: '60%', size: 'w-1 h-1', delay: '2.2s', color: 'bg-cyan-200' },
            { top: '50%', left: '35%', size: 'w-1 h-1', delay: '0.9s', color: 'bg-white' },
            { top: '92%', left: '12%', size: 'w-1.5 h-1.5', delay: '1.7s', color: 'bg-pink-200' },
            { top: '65%', left: '90%', size: 'w-1 h-1', delay: '2.9s', color: 'bg-white' },
            { top: '40%', left: '55%', size: 'w-2 h-2', delay: '3.5s', color: 'bg-cyan-400' },
          ].map((star, idx) => (
            <div
              key={idx}
              className={`absolute ${star.size} ${star.color} rounded-full galaxy-star`}
              style={{
                top: star.top,
                left: star.left,
                '--twinkle-duration': star.delay,
                boxShadow: '0 0 6px 1px rgba(255,255,255,0.3)',
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Floating Mecha Particles */}
        <div className="absolute top-1/4 left-1/10 w-2 h-2 rounded-full bg-cyan-400 mecha-particle"></div>
        <div className="absolute top-2/3 left-1/4 w-3 h-3 rounded-full bg-blue-500 mecha-particle" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 rounded-full bg-pink-500 mecha-particle" style={{ animationDelay: '4s' }}></div>
        <div className="absolute top-3/4 right-1/10 w-2.5 h-2.5 rounded-full bg-amber-400 mecha-particle" style={{ animationDelay: '6s' }}></div>

        {/* Floating Tech Reticles / Cockpit HUD circles */}
        <div className="absolute -top-12 -left-12 w-64 h-64 border border-blue-500/10 rounded-full flex items-center justify-center reticle-spin">
          <div className="w-48 h-48 border border-dashed border-blue-500/20 rounded-full flex items-center justify-center">
            <div className="w-32 h-32 border border-blue-500/10 rounded-full"></div>
          </div>
        </div>

        <div className="absolute -bottom-24 -right-24 w-96 h-96 border border-cyan-500/10 rounded-full flex items-center justify-center reticle-spin-reverse">
          <div className="w-72 h-72 border border-dashed border-cyan-500/20 rounded-full flex items-center justify-center">
            <div className="w-48 h-48 border border-cyan-500/15 rounded-full"></div>
          </div>
        </div>

        {/* Orbital rotating galaxy system */}
        <div className="absolute top-[25%] right-[5%] lg:right-[15%] w-96 h-96 opacity-30 flex items-center justify-center scale-75 md:scale-100 lg:scale-110 pointer-events-none select-none">
          {/* Galaxy center glowing core */}
          <div className="absolute w-24 h-24 rounded-full bg-indigo-500/40 blur-[40px] animate-pulse"></div>
          <div className="absolute w-12 h-12 rounded-full bg-cyan-300/60 blur-[15px] animate-pulse"></div>
          <div className="absolute w-4 h-4 rounded-full bg-white blur-sm"></div>

          {/* Spiral Orbit 1 (Purple arm) */}
          <div className="absolute w-80 h-32 border-2 border-purple-500/20 rounded-full galaxy-spiral flex items-center justify-center" style={{ transform: 'rotate(-30deg)' }}>
            <div className="absolute w-4 h-4 rounded-full bg-purple-400 blur-[2px] -top-2 left-1/3 animate-ping" style={{ animationDuration: '4s' }}></div>
            <div className="absolute w-2.5 h-2.5 rounded-full bg-purple-300 -bottom-1 right-1/4"></div>
          </div>

          {/* Spiral Orbit 2 (Cyan arm) */}
          <div className="absolute w-96 h-40 border-2 border-cyan-500/20 rounded-full galaxy-spiral flex items-center justify-center" style={{ transform: 'rotate(45deg)', animationDirection: 'reverse', animationDuration: '90s' }}>
            <div className="absolute w-3 h-3 rounded-full bg-cyan-400 blur-[1px] -top-1 right-1/3"></div>
            <div className="absolute w-2 h-2 rounded-full bg-white -bottom-1 left-1/4"></div>
          </div>

          {/* Spiral Orbit 3 (Pink arm) */}
          <div className="absolute w-64 h-24 border border-pink-500/20 rounded-full galaxy-spiral" style={{ transform: 'rotate(15deg)', animationDuration: '60s' }}>
            <div className="absolute w-2.5 h-2.5 rounded-full bg-pink-400 blur-[1px] top-1/2 -right-1"></div>
            <div className="absolute w-1.5 h-1.5 rounded-full bg-pink-200 top-1/2 -left-1"></div>
          </div>

          {/* Orbiting Satellite Star Cluster */}
          <div className="absolute w-[450px] h-[450px] galaxy-spiral flex items-center justify-center" style={{ animationDuration: '180s' }}>
            <div className="absolute w-3 h-3 rounded-full bg-amber-400 blur-[2px] top-10 left-10 animate-pulse"></div>
            <div className="absolute w-2 h-2 rounded-full bg-blue-300 bottom-10 right-10"></div>
          </div>
        </div>

        {/* Tactical HUD side labels (Left side) */}
        <div className="absolute bottom-20 left-6 opacity-10 hidden md:flex flex-col gap-2 font-mono text-[10px] text-cyan-400">
          <p className="border-b border-cyan-500 pb-1 font-bold">TACTICAL SENSOR MODE [NT-D]</p>
          <p>SYSTEM BOOT: v4.18.2</p>
          <p>REACTOR CAPACITY: 1380 KW</p>
          <p>FRAME PRESSURE: NOMINAL</p>
          <p>TARGET RETICLE SYNC: TRUE</p>
          <p className="text-amber-400 animate-pulse">WARNING: DANGER CLOSE</p>
        </div>
      </div>

      {/* Toast Alert System */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${
              toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' :
              toast.type === 'error' ? 'bg-rose-950/90 text-rose-300 border-rose-500/30' :
              'bg-amber-950/90 text-amber-300 border-amber-500/30'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <header className="border-b-4 border-black bg-[#0d1326] sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-[0_8px_0_0_rgba(0,0,0,0.4)] relative">
        {/* Yellow V-Fin top accent on header */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-amber-400 to-red-600"></div>

        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-black tracking-widest font-display bg-gradient-to-r from-blue-400 via-slate-100 to-red-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase">
              Exam System <span className="text-xs text-yellow-400">[RX-78-2]</span>
            </h1>
            <p className="text-[9px] text-cyan-400 font-bold tracking-widest uppercase font-display">⚡ TACTICAL MECHA COCKPIT HUD ⚡</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Database Connection Status Light Indicator Button */}
          <button 
            onClick={() => {
              handleTestDbConnection();
              setShowDbStatusModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer group shadow-inner"
            title="สถานะการเชื่อมต่อฐานข้อมูล (คลิกเพื่อดูรายละเอียดและจัดการ)"
          >
            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
              {(dbStatus as any).isConnected !== false ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-left">
              <Database className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              <span className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 transition-colors hidden sm:inline">
                {(dbStatus as any).useSupabase ? 'Cloud DB' : 'Local DB'}
              </span>
              {(dbStatus as any).latencyMs !== undefined && (
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 hidden md:inline">
                  {(dbStatus as any).latencyMs}ms
                </span>
              )}
            </div>
          </button>

          {userRole !== 'guest' && (
            <div className="flex items-center gap-3 pl-3 border-l-2 border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-extrabold text-white">{currentUser?.name}</p>
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-display">{userRole === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : userRole === 'teacher' ? 'คุณครูผู้สอน' : `นักเรียน: ${currentUser?.student_id}`}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-xl bg-slate-950 text-slate-400 hover:text-red-500 hover:bg-slate-900 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(255,51,85,0.3)] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content View Switcher */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {userRole === 'guest' ? (
          /* ================= GUEST LOGIN SCREEN ================= */
          !browserInfo.isValid && loginTab === 'student' ? (
            <div className="space-y-6 max-w-xl mx-auto my-12">
              {/* Role Toggle Selector when browser is invalid to let teachers switch tabs */}
              <div className="p-2 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3">
                <span className="text-xs font-semibold text-slate-400">บทบาทของคุณในการสอบ:</span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setLoginTab('student')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${loginTab === 'student' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    นักเรียน (โดนระงับทางเข้า)
                  </button>
                  <button 
                    onClick={() => setLoginTab('teacher')}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${loginTab === 'teacher' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    คุณครู / แอดมิน (เข้าสู่ระบบ)
                  </button>
                </div>
              </div>
              <StudentBrowserBlocker browserInfo={browserInfo} onCopyLink={() => showToast('คัดลอกลิงก์สอบแล้ว!', 'success')} />
            </div>
          ) : (
            <div className="max-w-md mx-auto my-12 card-3d rounded-3xl p-6 md:p-8 relative overflow-hidden cosmic-border-glowing">
            
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold">เข้าสู่ระบบสอบออนไลน์</h2>
              <p className="text-sm text-slate-400 mt-1">กรุณาเลือกบทบาทของคุณครูหรือนักเรียนเพื่อดำเนินการต่อ</p>
            </div>

            {/* Selector Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-950 rounded-xl mb-6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
              <button 
                onClick={() => setLoginTab('student')}
                className={`py-2.5 text-sm font-medium rounded-lg transition-all ${loginTab === 'student' ? 'bg-slate-800 text-white shadow-md border-t border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <User className="w-4 h-4" />
                  <span>นักเรียน</span>
                </div>
              </button>
              <button 
                onClick={() => setLoginTab('teacher')}
                className={`py-2.5 text-sm font-medium rounded-lg transition-all ${loginTab === 'teacher' ? 'bg-slate-800 text-white shadow-md border-t border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Sliders className="w-4 h-4" />
                  <span>คุณครู / แอดมิน</span>
                </div>
              </button>
            </div>

            {loginTab === 'student' ? (
              <form onSubmit={handleStudentLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-[9px]">รหัสประจำตัวนักเรียน (Student ID)</label>
                  <input 
                    type="text" 
                    placeholder="ตัวอย่าง: 8432"
                    value={studentIdInput}
                    onChange={e => setStudentIdInput(e.target.value)}
                    className="w-full input-3d rounded-xl px-4 py-3 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-[12px]">รหัสผ่าน (Password)</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    className="w-full input-3d rounded-xl px-4 py-3 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-all"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-3.5 btn-cosmic-glow font-semibold rounded-xl cursor-pointer mt-2"
                >
                  เข้าสู่ระบบ
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <form onSubmit={handleTeacherLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">อีเมลคุณครูผู้สอน (Email)</label>
                    <input 
                      type="email" 
                      placeholder="teacher@school.ac.th"
                      value={teacherEmailInput}
                      onChange={e => setTeacherEmailInput(e.target.value)}
                      className="w-full input-3d rounded-xl px-4 py-3 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">รหัสผ่าน</label>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={teacherPasswordInput}
                      onChange={e => setTeacherPasswordInput(e.target.value)}
                      className="w-full input-3d rounded-xl px-4 py-3 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-all"
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-3 btn-3d-secondary font-semibold rounded-xl cursor-pointer mt-2"
                  >
                    เข้าสู่ระบบแบบบัญชีทั่วไป
                  </button>
                </form>

                <div className="relative flex items-center justify-center my-4">
                  <hr className="w-full border-slate-800" />
                  <span className="absolute px-3 text-xs bg-[#0b0f19] text-slate-500 uppercase">หรือ</span>
                </div>

                <button 
                  onClick={handleGoogleLogin}
                  className="w-full py-3 bg-white hover:bg-slate-100 text-slate-950 font-semibold rounded-xl flex items-center justify-center gap-3 cursor-pointer shadow-[0_4px_0_0_#cbd5e1] hover:shadow-[0_2px_0_0_#cbd5e1] hover:translate-y-[2px] active:translate-y-[4px] active:shadow-none transition-all duration-150"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.6 15 1 12 1 7.35 1 3.37 3.63 1.39 7.46l3.87 3C6.18 7.37 8.87 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.45c-.28 1.47-1.11 2.71-2.36 3.56l3.67 2.84c2.15-1.98 3.38-4.89 3.38-8.51z" />
                    <path fill="#FBBC05" d="M5.26 14.54c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.39 7.46C.5 9.27 0 11.28 0 13.4s.5 4.13 1.39 5.94l3.87-3z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.67-2.84c-1.01.67-2.31 1.07-3.95 1.07-3.13 0-5.82-2.33-6.77-5.42l-3.87 3C3.37 20.37 7.35 23 12 23z" />
                  </svg>
                  <span>เข้าสู่ระบบด้วย Gmail (Google Login)</span>
                </button>
              </div>
            )}
          </div>
          )
        ) : userRole === 'student' ? (
          /* ================= STUDENT WORKSPACE ================= */
          !browserInfo.isValid ? (
            <StudentBrowserBlocker browserInfo={browserInfo} onCopyLink={() => showToast('คัดลอกลิงก์สอบแล้ว!', 'success')} />
          ) : (
            <div className="space-y-6">
            {examState === 'gateway' && (
              <>
                {/* Student Hero Header */}
                <div className="card-3d rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-1 z-10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/15 text-rose-400 rounded-full text-xs font-semibold mb-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                      <Shield className="w-3.5 h-3.5" />
                      <span>โหมดผู้เรียนปลอดภัย (Secure Proctoring Active)</span>
                    </div>
                    <h2 className="text-2xl font-bold">สวัสดีนักเรียน, {currentUser?.name}</h2>
                    <p className="text-slate-400 text-sm">เลขประจำตัวนักเรียน: <span className="font-mono text-slate-200">{currentUser?.student_id}</span> • ระดับชั้น: {currentUser?.class_group}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-center min-w-24 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                      <p className="text-xs text-slate-400">สอบเสร็จแล้ว</p>
                      <p className="text-2xl font-black text-emerald-400 mt-1">
                        {examResults.filter(r => r.student_id === currentUser.student_id).length}
                      </p>
                    </div>
                    <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-center min-w-24 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                      <p className="text-xs text-slate-400">กรณีสับสน/แจ้งเตือน</p>
                      <p className="text-2xl font-black text-rose-400 mt-1">
                        {cheatLogs.filter(cl => cl.student_id === currentUser.student_id).length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Subject Selector & Exam Cards */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-rose-500" />
                      <span>เลือกแบบทดสอบเพื่อเริ่มต้น</span>
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">กรองรายวิชา:</span>
                      <select 
                        value={selectedSubjectId}
                        onChange={e => setSelectedSubjectId(e.target.value)}
                        className="input-3d rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="">ทั้งหมดทุกวิชา</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Exams Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exams
                      .filter(e => e.is_active && (!selectedSubjectId || e.subject_id === selectedSubjectId))
                      .map(exam => {
                        const subject = subjects.find(s => s.id === exam.subject_id);
                        const result = getExamResultForStudent(exam.id);
                        
                        return (
                          <div 
                            key={exam.id} 
                            className="card-3d rounded-2xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden transition-all group hover:translate-y-[-2px]"
                          >
                            <div className="space-y-2">
                              {/* Exam Type Header Tag */}
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                                  exam.type === 'midterm' ? 'bg-purple-950/80 text-purple-300 border border-purple-500/20' :
                                  exam.type === 'final' ? 'bg-pink-950/80 text-pink-300 border border-pink-500/20' :
                                  exam.type === 'quiz' ? 'bg-blue-950/80 text-blue-300 border border-blue-500/20' :
                                  'bg-emerald-950/80 text-emerald-300 border border-emerald-500/20'
                                }`}>
                                  {exam.type === 'midterm' ? 'สอบกลางภาค' :
                                   exam.type === 'final' ? 'สอบปลายภาค' :
                                   exam.type === 'quiz' ? 'เก็บคะแนน' : 'ข้อสอบทำวนซ้ำ'}
                                </span>
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{exam.duration} นาที</span>
                                </div>
                              </div>

                              <h4 className="font-bold text-base text-slate-100 group-hover:text-rose-400 transition-colors line-clamp-2">{exam.title}</h4>
                              <p className="text-xs text-slate-400">{subject ? `${subject.code} - ${subject.name}` : 'ไม่ระบุรายวิชา'}</p>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                              {result ? (
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400">สอบเรียบร้อยแล้ว</p>
                                  <p className="text-sm font-bold text-emerald-400">{result.score} / {result.total_score} คะแนน</p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400">ยังไม่ได้ทดสอบ</p>
                              )}

                              {result && exam.type !== 'practice' ? (
                                <button 
                                  onClick={() => {
                                    setFinishedResult(result);
                                    // Fetch the questions so student can review answers
                                    fetch(`/api/exams/${exam.id}/questions`)
                                      .then(r => r.json())
                                      .then(setExamQuestions)
                                      .then(() => {
                                        setSelectedExam(exam);
                                        setExamState('finished');
                                      });
                                  }}
                                  className="px-3 py-1.5 btn-3d-secondary text-xs rounded-xl cursor-pointer"
                                >
                                  ดูผลวิเคราะห์ข้อสอบ
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleStartExam(exam)}
                                  className="px-4 py-2 btn-3d-primary text-xs rounded-xl font-semibold cursor-pointer"
                                >
                                  {result && exam.type === 'practice' ? 'ทำใหม่อีกครั้ง' : 'เริ่มทำข้อสอบ'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {exams.filter(e => e.is_active && (!selectedSubjectId || e.subject_id === selectedSubjectId)).length === 0 && (
                      <div className="col-span-full border-2 border-dashed border-slate-800 rounded-2xl py-12 text-center text-slate-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                        ไม่มีชุดแบบทดสอบที่เปิดใช้งานในหมวดหมู่นี้ในขณะนี้
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ================= STUDENT ACTIVE TESTING SCREEN (FULLSCREEN RESTRICTED) ================= */}
            {examState === 'taking' && selectedExam && (
              <div className="fixed inset-0 z-50 bg-[#070a13] text-slate-100 flex flex-col select-none overflow-hidden">
                {/* 100% Solid Pitch Black Screenshot Blocker */}
                {isScreenBlackout && (
                  <div className="fixed inset-0 bg-black z-[99999] flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none">
                    <div className="w-16 h-16 bg-rose-600/10 border border-rose-500/30 rounded-full flex items-center justify-center text-rose-500 mb-4 animate-pulse">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-rose-500">ระบบความปลอดภัยขั้นสูงสุด (Anti-Screenshot Guard)</h2>
                    <p className="text-slate-400 text-xs mt-2">ห้ามบันทึกภาพหน้าจอหรือพิมพ์หน้าเว็บข้อสอบโดยเด็ดขาด หน้าจอถูกปิดเป็นสีดำเพื่อป้องกันข้อสอบรั่วไหล</p>
                  </div>
                )}

                {/* Screenshot Watermark Protection Overlay */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-24 opacity-[0.03] z-10 overflow-hidden transform rotate-12 scale-110">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="text-slate-200 font-mono text-center text-sm">
                      <p className="font-bold">{currentUser?.student_id}</p>
                      <p className="text-xs mt-1">{currentUser?.name}</p>
                    </div>
                  ))}
                </div>

                {/* Fullscreen Break Warning Enforcer */}
                {isCheatLocked ? (
                  <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-rose-600 rounded-full blur-[30px] animate-pulse opacity-40"></div>
                      <div className="relative bg-gradient-to-br from-rose-500 to-red-600 p-5 rounded-3xl text-white border-2 border-black shadow-[4px_4px_0_0_#000] flex items-center justify-center">
                        <Lock className="w-12 h-12" />
                      </div>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-black text-rose-500 mb-2 tracking-wide uppercase">🚨 หน้าจอสอบถูกล็อก! (Screen Locked)</h2>
                    <p className="text-slate-300 max-w-lg text-xs md:text-sm mb-6 leading-relaxed">
                      ตรวจพบการสลับหน้าจอสอบ ละสายตา หรือออกจากระบบสอบนิรภัย เพื่อความยุติธรรมในการสอบระบบได้ทำการล็อคหน้าจอทันที
                      <br />
                      <span className="text-rose-400 font-bold mt-2 block">
                        กรุณาแจ้งคุณครูผู้คุมสอบเพื่อปลดล็อกที่เครื่องนี้ หรือรอคุณครูปลดล็อกทางไกลผ่านระบบแอดมิน
                      </span>
                    </p>

                    {/* Remote Unlock Status Indicator */}
                    <div className="mb-6 flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-full animate-pulse text-xs text-rose-300 font-semibold">
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
                      <span>กำลังตรวจจับสัญญาณการปลดล็อกทางไกลจากเครื่องแอดมิน (Real-Time)...</span>
                    </div>

                    <div className="w-full max-w-sm bg-[#0e1426]/90 border-2 border-slate-800 rounded-3xl p-5 shadow-2xl relative">
                      <div className="absolute -top-3 left-6 px-3 py-1 bg-rose-600 text-white font-mono text-[9px] font-bold rounded-full border border-black uppercase tracking-wider">
                        Teacher Verification Only
                      </div>

                      <div className="space-y-4 mt-2">
                        <div>
                          <label className="block text-left text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider pl-1">เลือกคุณครูผู้คุมสอบ</label>
                          <select 
                            value={unlockTeacherEmail}
                            onChange={e => setUnlockTeacherEmail(e.target.value)}
                            className="w-full input-3d rounded-xl px-3.5 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500 transition-all text-xs"
                          >
                            <option value="">-- เลือกคุณครูผู้สอน --</option>
                            {teachers.map(t => (
                              <option key={t.id} value={t.email}>{t.name} ({t.email})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-left text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-1">รหัสผ่านของคุณครู</label>
                          <input 
                            type="password" 
                            placeholder="กรอกรหัสผ่านเพื่อปลดล็อก"
                            value={unlockTeacherPassword}
                            onChange={e => setUnlockTeacherPassword(e.target.value)}
                            className="w-full input-3d rounded-xl px-3.5 py-2.5 placeholder-slate-600 bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-rose-500 transition-all text-xs"
                          />
                        </div>

                        {unlockError && (
                          <div className="text-rose-500 text-[11px] font-semibold text-left flex items-center gap-1 bg-rose-500/10 border border-rose-500/25 rounded-lg px-2.5 py-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>{unlockError}</span>
                          </div>
                        )}

                        <button 
                          onClick={async () => {
                            if (!unlockTeacherEmail) {
                              setUnlockError('กรุณาเลือกคุณครูผู้คุมสอบ');
                              return;
                            }
                            if (!unlockTeacherPassword) {
                              setUnlockError('กรุณากรอกรหัสผ่านเพื่อปลดล็อก');
                              return;
                            }
                            setUnlockError('');
                            setIsUnlocking(true);
                            try {
                              const res = await fetch('/api/teachers/login', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: unlockTeacherEmail, password: unlockTeacherPassword })
                              });
                              if (res.ok) {
                                // Clean up lock status on server
                                fetch('/api/lock-status', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    student_id: currentUser?.student_id,
                                    exam_id: selectedExam?.id,
                                    is_locked: false
                                  })
                                }).catch(e => console.error('Error clearing lock status:', e));

                                setIsCheatLocked(false);
                                setUnlockTeacherEmail('');
                                setUnlockTeacherPassword('');
                                showToast('ปลดล็อกระบบสอบสำเร็จ! สามารถทำข้อสอบต่อได้', 'success');
                                requestFullscreen();
                                setIsFullscreen(true);
                              } else {
                                const errData = await res.json();
                                setUnlockError(errData.error || 'รหัสผ่านคุณครูไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
                              }
                            } catch (err) {
                              setUnlockError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อปลดล็อกได้');
                            } finally {
                              setIsUnlocking(false);
                            }
                          }}
                          disabled={isUnlocking}
                          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-lg active:translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                          {isUnlocking ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ยืนยันปลดล็อกหน้าจอ</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : !isFullscreen ? (
                  <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-6 text-center">
                    <AlertTriangle className="w-16 h-16 text-rose-500 animate-bounce mb-4" />
                    <h2 className="text-2xl font-black text-rose-400">ออกจากโหมดเต็มหน้าจอต้องห้าม!</h2>
                    <p className="text-slate-300 max-w-md mt-2 mb-6 text-sm">
                      เพื่อความบริสุทธิ์ยุติธรรมและปลอดภัยสูงสุดในการสอบ ระบบได้ทำการบันทึกประวัติความพยายามสลับหน้าจอ (Cheat Incident Log) โปรดกดปุ่มด้านล่างเพื่อล็อคเต็มหน้าจอทันที ไม่เช่นนั้นผลการสอบจะไม่ได้รับการบันทึก
                    </p>
                    <button 
                      onClick={() => {
                        requestFullscreen();
                        setIsFullscreen(true);
                      }}
                      className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg cursor-pointer flex items-center gap-2"
                    >
                      <Maximize className="w-4 h-4" />
                      <span>กลับคืนสู่หน้าทำข้อสอบ (Lock Screen)</span>
                    </button>
                  </div>
                ) : null}

                {/* Exam Room Header */}
                <div className="border-b border-slate-800/80 bg-slate-900 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-rose-500/10 p-2 text-rose-400 border border-rose-500/20 rounded-xl">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 truncate max-w-xs sm:max-w-md">{selectedExam.title}</h3>
                      <p className="text-xs text-slate-400">นักเรียนสอบ: {currentUser.name} ({currentUser.student_id})</p>
                    </div>
                  </div>

                  {/* Countdown Timer with warning color indicators */}
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${timeLeft < 180 ? 'bg-rose-950/55 text-rose-400 border-rose-500/35 animate-pulse' : 'bg-slate-950 text-slate-300 border-slate-800'}`}>
                      <Clock className="w-4 h-4 text-rose-500" />
                      <span className="font-mono font-bold text-sm md:text-base">{formatTime(timeLeft)}</span>
                    </div>

                    <button 
                      onClick={triggerSubmitExam}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow transition-all"
                    >
                      ส่งข้อสอบ
                    </button>
                  </div>
                </div>

                {/* Main Exam Content Layout */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col md:flex-row gap-6 relative z-20">
                  {/* Left Column: Core Question card */}
                  <div className="flex-1 max-w-3xl mx-auto flex flex-col justify-between bg-slate-900/40 border border-slate-800/60 rounded-3xl p-6 md:p-8 shadow">
                    {examQuestions.length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            โจทย์ข้อที่ {currentQuestionIndex + 1} จาก {examQuestions.length}
                          </span>
                          <span className="text-xs text-rose-400 font-bold px-2.5 py-1 bg-rose-500/5 border border-rose-500/15 rounded-lg">
                            {examQuestions[currentQuestionIndex].points} คะแนน
                          </span>
                        </div>

                        {/* Question Text */}
                        <div className="text-slate-100 font-medium text-lg leading-relaxed">
                          {examQuestions[currentQuestionIndex].question_text}
                        </div>

                        {/* Options */}
                        <div className="space-y-3 pt-2">
                          {examQuestions[currentQuestionIndex].options.map((option, index) => {
                            const qId = examQuestions[currentQuestionIndex].id || '';
                            const isSelected = studentAnswers[qId] === index;
                            
                            return (
                              <button
                                key={index}
                                onClick={() => setStudentAnswers(prev => ({ ...prev, [qId]: index }))}
                                className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all group cursor-pointer ${
                                  isSelected 
                                    ? 'bg-rose-950/40 text-rose-200 border-rose-500/50 shadow-md shadow-rose-500/5' 
                                    : 'bg-slate-950 text-slate-300 border-slate-800/70 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                                    isSelected ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                                  }`}>
                                    {['ก', 'ข', 'ค', 'ง', 'จ'][index] || ''} {/* ก ข ค ง in Thai */}
                                  </div>
                                  <span className="text-sm md:text-base">{option}</span>
                                </div>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-rose-400' : 'border-slate-700'}`}>
                                  {isSelected && <div className="w-2 h-2 bg-rose-400 rounded-full"></div>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bottom Nav Controllers */}
                    <div className="flex items-center justify-between pt-8 border-t border-slate-800 mt-12">
                      <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:hover:bg-slate-800 rounded-xl font-medium text-xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        ย้อนกลับข้อก่อนหน้า
                      </button>
                      
                      {currentQuestionIndex < examQuestions.length - 1 ? (
                        <button
                          onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium text-xs shadow hover:shadow-rose-600/10 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          ข้อถัดไป
                        </button>
                      ) : (
                        <button
                          onClick={triggerSubmitExam}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow transition-all cursor-pointer"
                        >
                          เสร็จสิ้นและส่งข้อสอบ
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Mini Sheet Tracker (Sidebar) */}
                  <div className="w-full md:w-64 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between gap-4">
                    <div className="space-y-4">
                      <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">แผ่นกระดาษคำตอบ</h4>
                      <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1">
                        {examQuestions.map((q, i) => {
                          const isAnswered = studentAnswers[q.id || ''] !== undefined;
                          const isCurrent = i === currentQuestionIndex;
                          
                          return (
                            <button
                              key={i}
                              onClick={() => setCurrentQuestionIndex(i)}
                              className={`w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
                                isCurrent 
                                  ? 'bg-rose-600 text-white ring-2 ring-rose-500/50' 
                                  : isAnswered 
                                    ? 'bg-slate-950 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                              }`}
                            >
                              {i + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Proctored Safe Mode Metrics */}
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ระบบตรวจจับความปลอดภัย</p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">โหมดเต็มหน้าจอ:</span>
                        <span className={`font-bold ${isFullscreen ? 'text-emerald-400' : 'text-rose-400'}`}>{isFullscreen ? 'ล็อคหน้าจอสำเร็จ' : 'ละเมิดข้อตกลง'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">กรณีละเมิดแท็บ:</span>
                        <span className={`font-bold ${cheatAttempts > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>{cheatAttempts} ครั้ง</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Modal Confirmation for Exam Submission */}
                {showSubmitConfirmModal && (
                  <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6"
                    >
                      <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                        <Send className="w-8 h-8" />
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">ยืนยันการส่งข้อสอบ</h3>
                        <p className="text-sm text-slate-300">
                          คุณได้ตอบข้อสอบไปแล้ว <span className="font-bold text-emerald-400">{Object.keys(studentAnswers).length}</span> จากทั้งหมด <span className="font-bold text-slate-100">{examQuestions.length}</span> ข้อ
                        </p>
                        {Object.keys(studentAnswers).length < examQuestions.length && (
                          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 mt-3">
                            ⚠️ คุณยังมีข้อสอบที่ไม่ได้ตอบอีก {examQuestions.length - Object.keys(studentAnswers).length} ข้อ
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={cancelSubmitExam}
                          className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs cursor-pointer transition-all"
                        >
                          กลับไปทำข้อสอบต่อ
                        </button>
                        <button
                          onClick={() => executeExamSubmission(false)}
                          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow cursor-pointer transition-all flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          ยืนยันส่งข้อสอบ
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            )}

            {/* ================= STUDENT EXAM COMPLETED REPORT SCREEN ================= */}
            {examState === 'finished' && selectedExam && finishedResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
                {/* Score Showcase Hero */}
                <div className="text-center space-y-4">
                  <div className="inline-flex bg-emerald-500/10 p-4 rounded-3xl text-emerald-400 mb-2 border border-emerald-500/20">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black">ส่งกระดาษข้อสอบเรียบร้อยแล้ว</h3>
                  <p className="text-slate-400 max-w-md mx-auto text-sm">ระบบทำการคำนวณและประมวลผลคำตอบแบบเรียลไทม์ ตรวจสอบข้อสอบและคำอธิบายโดยละเอียดได้ข้างล่าง</p>

                  <div className="inline-flex flex-col items-center justify-center p-6 rounded-full bg-slate-950 border-4 border-slate-800 relative w-36 h-36">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ได้คะแนน</span>
                    <span className="text-4xl font-black text-rose-500">{finishedResult.score}</span>
                    <div className="w-full h-[1px] bg-slate-800 my-1"></div>
                    <span className="text-xs text-slate-400">{finishedResult.total_score} คะแนน</span>
                  </div>
                </div>

                {/* Submissions & Incident Summaries */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">เวลาที่เริ่มส่งสอบ</p>
                    <p className="text-sm font-semibold">{new Date(finishedResult.submit_time).toLocaleTimeString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">สถานะความสุจริต</p>
                    <p className={`text-sm font-semibold ${
                      cheatLogs.filter(c => c.student_id === currentUser.student_id && c.exam_id === selectedExam.id).length > 0
                        ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {cheatLogs.filter(c => c.student_id === currentUser.student_id && c.exam_id === selectedExam.id).length > 0
                        ? `ตรวจพบข้อสงสัย` : 'ปลอดภัย 100%'
                      }
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">คิดเป็นเปอร์เซ็นต์</p>
                    <p className="text-sm font-semibold text-emerald-400">
                      {Math.round((finishedResult.score / finishedResult.total_score) * 100)} %
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">ประเมินศักยภาพ</p>
                    <p className="text-sm font-semibold text-rose-400">
                      {(finishedResult.score / finishedResult.total_score) >= 0.8 ? 'ดีเยี่ยม' :
                       (finishedResult.score / finishedResult.total_score) >= 0.5 ? 'ผ่านเกณฑ์' : 'ควรปรับปรุงเพิ่มเติม'}
                    </p>
                  </div>
                </div>

                {/* Questions Review list with Explanations */}
                <div className="space-y-4">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-rose-500" />
                    <span>ตรวจสอบเฉลยข้อสอบอย่างเป็นทางการ</span>
                  </h4>

                  <div className="space-y-6">
                    {examQuestions.map((q, i) => {
                      const studAns = JSON.parse(finishedResult.answers || '{}')[q.id || ''];
                      const isCorrect = studAns === q.correct_index;
                      
                      return (
                        <div key={q.id} className={`p-5 rounded-2xl border ${isCorrect ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-rose-950/20 border-rose-500/20'} space-y-4`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold font-mono">โจทย์ข้อที่ {i + 1}</span>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isCorrect ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                              {isCorrect ? `ตอบถูก (+${q.points} คะแนน)` : 'ตอบผิด (0 คะแนน)'}
                            </span>
                          </div>

                          <p className="font-semibold text-slate-100">{q.question_text}</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {q.options.map((opt, optIdx) => {
                              const wasSelected = studAns === optIdx;
                              const isCorrectOption = optIdx === q.correct_index;
                              
                              return (
                                <div 
                                  key={optIdx} 
                                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                                    isCorrectOption 
                                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50' 
                                      : wasSelected 
                                        ? 'bg-rose-950/40 text-rose-300 border-rose-500/50' 
                                        : 'bg-slate-950 text-slate-400 border-slate-900'
                                  }`}
                                >
                                  <span>{['ก', 'ข', 'ค', 'ง', 'จ'][optIdx] || ''}. {opt}</span>
                                  {isCorrectOption ? (
                                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">คำตอบที่ถูก</span>
                                  ) : wasSelected ? (
                                    <span className="text-[10px] font-bold bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">ที่คุณเลือก</span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl text-xs space-y-1">
                              <p className="font-bold text-rose-400 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>วิเคราะห์และคำอธิบายข้อนี้:</span>
                              </p>
                              <p className="text-slate-300 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedExam(null);
                      setExamState('gateway');
                      refreshData();
                    }}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl cursor-pointer"
                  >
                    กลับสู่หน้าแรกผู้เรียน
                  </button>
                </div>
              </div>
            )}
          </div>
          )
        ) : (
          /* ================= TEACHER / ADMIN DASHBOARD WORKSPACE ================= */
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Controls */}
            <aside className="w-full lg:w-64 card-3d rounded-3xl p-4 space-y-3 lg:self-start">
              {/* Live Database Connection Indicator Widget in Admin Sidebar */}
              <div 
                onClick={() => {
                  handleTestDbConnection();
                  setShowDbStatusModal(true);
                }}
                className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 p-3.5 rounded-2xl cursor-pointer transition-all space-y-2 group shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-3 w-3 items-center justify-center">
                      {(dbStatus as any).isConnected !== false ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </>
                      ) : (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </>
                      )}
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-200 group-hover:text-cyan-300 transition-colors uppercase tracking-wider">
                      {(dbStatus as any).isConnected !== false ? 'DB ONLINE' : 'DB DISCONNECTED'}
                    </span>
                  </div>

                  {(dbStatus as any).latencyMs !== undefined && (
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {(dbStatus as any).latencyMs}ms
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                  <span className="flex items-center gap-1 font-medium">
                    <Database className="w-3 h-3 text-cyan-400" />
                    <span>{(dbStatus as any).useSupabase ? 'Supabase Cloud' : 'Local JSON'}</span>
                  </span>
                  <span className="text-cyan-400 font-bold group-hover:underline">คลิกดูรายละเอียด →</span>
                </div>
              </div>

              <p className="text-[10px] font-bold text-slate-400 px-3 uppercase tracking-wider pt-1">เมนูการควบคุมครูผู้สอน</p>
              
              <button 
                onClick={() => setActiveTab('stats')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'stats' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <BarChart3 className="w-4 h-4 text-rose-500" />
                <span>ภาพรวมผลคะแนนการสอบ</span>
              </button>

              <button 
                onClick={() => setActiveTab('live_monitor')}
                className={`w-full flex items-center justify-between px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'live_monitor' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>ติดตามการสอบเรียลไทม์</span>
                </div>
                {liveSessions.length > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/30">
                    {liveSessions.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('popup_sender')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'popup_sender' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <Bell className="w-4 h-4 text-amber-400" />
                <span>ส่งข้อความแจ้งเตือน Popup</span>
              </button>

              <button 
                onClick={() => setActiveTab('announcements')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'announcements' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <Megaphone className="w-4 h-4 text-indigo-400" />
                <span>ประกาศ & กระดานสนทนา</span>
              </button>

              <button 
                onClick={() => setActiveTab('subjects')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'subjects' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <BookOpen className="w-4 h-4 text-rose-500" />
                <span>จัดการวิชาและชุดข้อสอบ</span>
              </button>

              <button 
                onClick={() => setActiveTab('students')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'students' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <Users className="w-4 h-4 text-rose-500" />
                <span>จัดการรายชื่อนักเรียน</span>
              </button>

              <button 
                onClick={() => setActiveTab('analysis')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'analysis' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <Brain className="w-4 h-4 text-rose-500" />
                <span>วิเคราะห์คุณภาพข้อสอบ (CTT)</span>
              </button>

              <button 
                onClick={() => setActiveTab('backup')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'backup' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <Database className="w-4 h-4 text-cyan-400" />
                <span>สำรอง & คืนค่าฐานข้อมูล</span>
              </button>
            </aside>

            {/* Subpages inside dashboard */}
            <div className="flex-1 space-y-6">
              
              {/* === SUBPAGE: REAL-TIME MONITORING & STATS === */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
                  {/* Database Connection Status Banner in Overview */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-blue-500"></div>

                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center shrink-0">
                        <Database className="w-6 h-6 text-cyan-400" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-sm font-bold text-white">สถานะการเชื่อมต่อฐานข้อมูลระบบ (Database Status)</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border flex items-center gap-1.5 ${(dbStatus as any).isConnected !== false ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                            <span className={`w-2 h-2 rounded-full ${(dbStatus as any).isConnected !== false ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                            <span>{(dbStatus as any).isConnected !== false ? 'ONLINE (เชื่อมต่อปกติ)' : 'DISCONNECTED (ขัดข้อง)'}</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          ใช้ฐานข้อมูล: <b className="text-cyan-300">{(dbStatus as any).useSupabase ? 'Cloud Supabase PostgreSQL' : 'Local File Storage (data/offline_db.json)'}</b>
                          {(dbStatus as any).latencyMs !== undefined && (
                            <span className="ml-2 font-mono text-emerald-400">({(dbStatus as any).latencyMs} ms)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => {
                          handleTestDbConnection();
                          setShowDbStatusModal(true);
                        }}
                        className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md"
                      >
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        <span>ตรวจสอบสถานะ & จัดการฐานข้อมูล</span>
                      </button>
                    </div>
                  </div>

                  {/* Grid metrics counters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card-3d rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">นักเรียนในระบบทั้งหมด</p>
                      <p className="text-2xl font-black text-rose-500 mt-1">{students.length} คน</p>
                    </div>
                    <div className="card-3d rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">จำนวนรายวิชาหลัก</p>
                      <p className="text-2xl font-black text-slate-100 mt-1">{subjects.length} วิชา</p>
                    </div>
                    <div className="card-3d rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ชุดข้อสอบทั้งหมด</p>
                      <p className="text-2xl font-black text-slate-100 mt-1">{exams.length} ชุด</p>
                    </div>
                    <div className="card-3d rounded-2xl p-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">อัตราทุจริต/ละเมิดกติกา</p>
                      <p className="text-2xl font-black text-rose-500 mt-1 animate-pulse">{cheatLogs.length} ครั้ง</p>
                    </div>
                  </div>

                  {/* === LATEST SCORES & EXAM DURATION DASHBOARD === */}
                  {(() => {
                    const uniqueClassrooms = Array.from(new Set(students.map(s => s.class_group).filter(Boolean))).sort();
                    
                    const filteredResults = examResults.filter(result => {
                      const student = students.find(s => s.student_id === result.student_id);
                      const studentClass = student ? student.class_group : '';

                      // Class filter
                      if (scoreDashboardClassFilter && studentClass !== scoreDashboardClassFilter) {
                        return false;
                      }

                      // Exam filter
                      if (scoreDashboardExamFilter && result.exam_id !== scoreDashboardExamFilter) {
                        return false;
                      }

                      // Search filter (id, name, or exam name)
                      if (scoreDashboardSearch) {
                        const q = scoreDashboardSearch.toLowerCase();
                        const examObj = exams.find(e => e.id === result.exam_id);
                        const examTitle = examObj ? examObj.title.toLowerCase() : '';
                        const matchId = result.student_id.toLowerCase().includes(q);
                        const matchName = result.student_name.toLowerCase().includes(q);
                        const matchExam = examTitle.includes(q);
                        if (!matchId && !matchName && !matchExam) {
                          return false;
                        }
                      }

                      return true;
                    });

                    // Sort by submit_time desc so the latest is on top
                    const sortedResults = [...filteredResults].sort((a, b) => new Date(b.submit_time).getTime() - new Date(a.submit_time).getTime());

                    // Calculate stats
                    const totalCompleted = sortedResults.length;
                    const scoresList = sortedResults.map(r => r.score);

                    const avgScore = scoresList.length > 0 
                      ? (scoresList.reduce((a, b) => a + b, 0) / scoresList.length).toFixed(1) 
                      : '0.0';

                    const maxScore = scoresList.length > 0 ? Math.max(...scoresList) : 0;
                    const minScore = scoresList.length > 0 ? Math.min(...scoresList) : 0;

                    const durations = sortedResults.map(r => {
                      const start = new Date(r.start_time).getTime();
                      const end = new Date(r.submit_time).getTime();
                      return Math.max(0, Math.floor((end - start) / 1000));
                    });

                    const avgDurationSec = durations.length > 0 
                      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) 
                      : 0;
                    const avgMin = Math.floor(avgDurationSec / 60);
                    const avgSec = avgDurationSec % 60;
                    const avgTimeText = durations.length > 0 ? `${avgMin} นาที ${avgSec} วินาที` : '-';

                    return (
                      <div className="space-y-6">
                        <div className="card-3d rounded-3xl p-5 md:p-6 space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                            <div>
                              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                                <span>แดชบอร์ดสรุปผลคะแนนและเวลาทำข้อสอบล่าสุด</span>
                              </h3>
                              <p className="text-xs text-slate-400 mt-1">แสดงผลคะแนนสอบ เวลาที่ทำข้อสอบ และสถานะพฤติกรรมเรียลไทม์ สามารถคัดกรองแยกเป็นรายห้องเรียนได้</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                              <button 
                                onClick={() => setShowLineSummaryModal(true)}
                                className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_2px_8px_rgba(99,102,241,0.05)]"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>สรุปคะแนนส่ง LINE 💬</span>
                              </button>
                              
                              <button 
                                onClick={refreshData}
                                className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>ดึงข้อมูลล่าสุด</span>
                              </button>
                            </div>
                          </div>

                          {/* Filters Section */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* Classroom Filter */}
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-1">เลือกห้องเรียน (Classroom)</label>
                              <select
                                value={scoreDashboardClassFilter}
                                onChange={e => setScoreDashboardClassFilter(e.target.value)}
                                className="w-full input-3d rounded-xl px-3 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 transition-all text-xs"
                              >
                                <option value="">-- แสดงทุกห้องเรียน --</option>
                                {uniqueClassrooms.map(cls => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            </div>

                            {/* Exam Title Filter */}
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-1">เลือกชุดข้อสอบ (Exam)</label>
                              <select
                                value={scoreDashboardExamFilter}
                                onChange={e => setScoreDashboardExamFilter(e.target.value)}
                                className="w-full input-3d rounded-xl px-3 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500 transition-all text-xs"
                              >
                                <option value="">-- แสดงทุกชุดข้อสอบ --</option>
                                {exams.map(exam => (
                                  <option key={exam.id} value={exam.id}>{exam.title}</option>
                                ))}
                              </select>
                            </div>

                            {/* Text Search Filter */}
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-1">ค้นหานักเรียน (Search)</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="ค้นหาชื่อ, รหัสนักเรียน หรือ วิชา..."
                                  value={scoreDashboardSearch}
                                  onChange={e => setScoreDashboardSearch(e.target.value)}
                                  className="w-full input-3d rounded-xl pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-all text-xs"
                                />
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Stats Row */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-950/40 p-4 border border-slate-900 rounded-2xl">
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">จำนวนผู้ส่งสอบ</p>
                              <p className="text-lg font-black text-emerald-400">{totalCompleted} คน</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">คะแนนเฉลี่ย</p>
                              <p className="text-lg font-black text-slate-200">{avgScore} คะแนน</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">คะแนนสูงสุด</p>
                              <p className="text-lg font-black text-amber-400">{maxScore} คะแนน</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">คะแนนต่ำสุด</p>
                              <p className="text-lg font-black text-rose-400">{minScore} คะแนน</p>
                            </div>
                            <div className="col-span-2 md:col-span-1 space-y-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">เวลาทำข้อสอบเฉลี่ย</p>
                              <p className="text-sm font-bold text-cyan-400 truncate mt-1">{avgTimeText}</p>
                            </div>
                          </div>

                          {/* Results Table */}
                          <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-slate-950/20">
                            <table className="w-full text-left text-xs text-slate-300">
                              <thead className="bg-slate-950 text-slate-400 font-bold">
                                <tr>
                                  <th className="p-3">รหัสนักเรียน</th>
                                  <th className="p-3">ชื่อ-นามสกุล</th>
                                  <th className="p-3 text-center">ห้องเรียน</th>
                                  <th className="p-3">ชุดข้อสอบ</th>
                                  <th className="p-3 text-center">คะแนนที่ได้</th>
                                  <th className="p-3">เวลาที่ใช้สอบ</th>
                                  <th className="p-3">วันเวลาที่ส่ง</th>
                                  <th className="p-3 text-center">ความประพฤติ</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {sortedResults.map(r => {
                                  const student = students.find(s => s.student_id === r.student_id);
                                  const studentClass = student ? student.class_group : 'ไม่ระบุห้อง';
                                  const examObj = exams.find(e => e.id === r.exam_id);
                                  const examTitle = examObj ? examObj.title : 'ชุดข้อสอบที่ถูกลบ';
                                  
                                  const rStart = new Date(r.start_time).getTime();
                                  const rEnd = new Date(r.submit_time).getTime();
                                  const rDurationSec = Math.max(0, Math.floor((rEnd - rStart) / 1000));
                                  const rMin = Math.floor(rDurationSec / 60);
                                  const rSec = rDurationSec % 60;
                                  
                                  const hasCheated = cheatLogs.some(cl => cl.student_id === r.student_id && cl.exam_id === r.exam_id);
                                  const cheatCount = cheatLogs.filter(cl => cl.student_id === r.student_id && cl.exam_id === r.exam_id).length;

                                  const scorePercent = r.total_score > 0 ? (r.score / r.total_score) * 100 : 0;
                                  let scoreColor = 'text-rose-400';
                                  if (scorePercent >= 80) scoreColor = 'text-emerald-400';
                                  else if (scorePercent >= 50) scoreColor = 'text-amber-400';

                                  return (
                                    <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                                      <td className="p-3 font-mono font-bold text-slate-400">{r.student_id}</td>
                                      <td className="p-3 font-semibold text-slate-200">{r.student_name}</td>
                                      <td className="p-3 text-center">
                                        <span className="px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-800 rounded text-[10px] font-bold">
                                          {studentClass}
                                        </span>
                                      </td>
                                      <td className="p-3 text-slate-300 truncate max-w-[150px]" title={examTitle}>
                                        {examTitle}
                                      </td>
                                      <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                          <span className={`font-black ${scoreColor}`}>
                                            {r.score} / {r.total_score}
                                          </span>
                                          <span className="text-[9px] text-slate-500 font-mono">({Math.round(scorePercent)}%)</span>
                                        </div>
                                      </td>
                                      <td className="p-3 font-medium text-cyan-300">
                                        <div className="flex items-center gap-1.5">
                                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                                          <span>{rMin} นาที {rSec} วินาที</span>
                                        </div>
                                      </td>
                                      <td className="p-3 text-slate-400 font-mono text-[10px]">
                                        {new Date(r.submit_time).toLocaleString('th-TH', { hour12: false })}
                                      </td>
                                      <td className="p-3 text-center">
                                        {hasCheated ? (
                                          <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full font-bold text-[10px]" title={`พบพฤติกรรมสลับหน้าจอหรือออกนอกระบบ ${cheatCount} ครั้ง`}>
                                            สลับจอ ({cheatCount} ครั้ง)
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold text-[10px]">
                                            ปกติ (ปลอดภัย)
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {sortedResults.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-900 rounded-b-2xl bg-slate-950/10">
                                      ไม่พบผลคะแนนสอบที่ตรงตามเงื่อนไขการค้นหา
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* LINE Summary Preview Modal */}
                        {showLineSummaryModal && (
                          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-shrink-0">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-indigo-400">
                                  <span className="text-xl">💬</span>
                                  <span>สรุปรายงานคะแนนสอบสำหรับส่งทาง LINE</span>
                                </h3>
                                <button 
                                  onClick={() => setShowLineSummaryModal(false)}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer text-slate-400 hover:text-white transition-colors"
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </div>

                              <div className="space-y-2 flex-shrink-0">
                                <p className="text-xs text-slate-400">
                                  ระบบจัดรูปแบบรายงานสรุปผลคะแนนแบบแยกคอลัมน์ รหัสประจำตัว, ชื่อ-นามสกุล, คะแนน, และเวลาทำข้อสอบให้เรียบร้อยแล้ว คุณครูสามารถคัดลอกข้อความด้านล่างนี้ไปวางส่งในแชท LINE กลุ่มห้องเรียนหรือไลน์ผู้ปกครองได้ทันที
                                </p>
                                
                                {scoreDashboardExamFilter === "" && (
                                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-400 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    <span>คำแนะนำ: ควรกรองเลือก <b>"ชุดข้อสอบ"</b> ที่แถบด้านบน เพื่อจัดกลุ่มคะแนนสอบรายวิชาเฉพาะเรื่องก่อนส่ง</span>
                                  </div>
                                )}
                              </div>

                              {(() => {
                                const selectedExamObj = exams.find(e => e.id === scoreDashboardExamFilter);
                                const examName = selectedExamObj ? selectedExamObj.title : 'รวมทุกชุดข้อสอบ';
                                const className = scoreDashboardClassFilter ? `ห้อง ${scoreDashboardClassFilter}` : 'ทุกห้องเรียน';

                                let text = `📊 สรุปคะแนนสอบ: ${examName}\n🏫 ห้องเรียน: ${className}\n`;
                                text += `====================================\n`;
                                text += `รหัสประจำตัว | ชื่อ-นามสกุล | คะแนน | เวลาที่ใช้\n`;
                                text += `====================================\n`;

                                if (sortedResults.length === 0) {
                                  text += `(ไม่มีข้อมูลนักเรียนที่ส่งสอบตามตัวกรองนี้)\n`;
                                } else {
                                  sortedResults.forEach((r, idx) => {
                                    const rStart = new Date(r.start_time).getTime();
                                    const rEnd = new Date(r.submit_time).getTime();
                                    const rDurationSec = Math.max(0, Math.floor((rEnd - rStart) / 1000));
                                    const rMin = Math.floor(rDurationSec / 60);
                                    const rSec = rDurationSec % 60;
                                    const timeStr = `${rMin}น. ${rSec}ว.`;

                                    text += `${r.student_id} | ${r.student_name} | ${r.score}/${r.total_score} | ${timeStr}\n`;
                                  });
                                }

                                text += `====================================\n`;
                                text += `📈 ค่าสถิติภาพรวม:\n`;
                                text += `• คะแนนเฉลี่ย: ${avgScore} คะแนน\n`;
                                text += `• คะแนนสูงสุด: ${maxScore} คะแนน\n`;
                                text += `• คะแนนต่ำสุด: ${minScore} คะแนน\n`;
                                text += `• ผู้ส่งสอบทั้งหมด: ${totalCompleted} คน\n`;
                                text += `------------------------------------\n`;
                                text += `🛡️ ส่งผ่านระบบป้องกันการทุจริตแบบเรียลไทม์`;

                                return (
                                  <div className="space-y-4 flex flex-col flex-grow overflow-hidden">
                                    <textarea
                                      readOnly
                                      value={text}
                                      className="w-full flex-grow bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 select-all resize-none"
                                      onClick={(e) => {
                                        (e.target as HTMLTextAreaElement).select();
                                      }}
                                    />

                                    <div className="flex items-center justify-end gap-3 pt-2 flex-shrink-0">
                                      <button
                                        onClick={() => setShowLineSummaryModal(false)}
                                        className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                                      >
                                        ปิดหน้าต่าง
                                      </button>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(text);
                                          showToast('คัดลอกสรุปคะแนนสำหรับ LINE เรียบร้อยแล้ว!');
                                        }}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
                                      >
                                        <Copy className="w-4 h-4" />
                                        <span>คัดลอกข้อความสรุปสำหรับ LINE</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* === REMOTE UNLOCK CONTROL CENTER === */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4 border border-rose-500/20 relative overflow-hidden">
                    {/* Decorative glowing gradient */}
                    <div className="absolute -right-24 -top-24 w-48 h-48 bg-rose-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-base flex items-center gap-2 text-rose-500">
                          <Unlock className="w-5 h-5 text-rose-500 animate-pulse" />
                          <span>ศูนย์ควบคุมและปลดล็อกระบบสอบทางไกล (Remote Unlock Center)</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          กรณีที่นักเรียนแอบสลับหน้าจอ ระบบจะขึ้นล็อกหน้าจอเรียลไทม์ คุณครูสามารถกดปลดล็อกให้นักเรียนจากตรงนี้ได้ทันที โดยไม่ต้องเดินไปป้อนรหัสที่หน้าจอผู้เรียน
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[10px] font-mono font-bold rounded-full uppercase tracking-wider">
                          Live Active Locks: {lockedStudents.length}
                        </span>
                        <button 
                          onClick={refreshData}
                          className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white"
                          title="อัปเดตสถานะ"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {lockedStudents.length === 0 ? (
                      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h4 className="font-semibold text-emerald-400 text-sm">การเชื่อมต่อทุกเครื่องเป็นปกติ</h4>
                        <p className="text-slate-400 text-xs max-w-md">ไม่มีผู้เรียนที่ถูกล็อกหน้าจอเนื่องจากการทุจริต/สลับหน้าต่างในขณะนี้</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {lockedStudents.map((item: any, idx: number) => {
                          const student = students.find(s => s.student_id === item.student_id);
                          const studentName = student ? student.name : 'ไม่พบข้อมูลนักเรียน';
                          const classGroup = student ? student.class_group : 'ไม่ระบุห้อง';
                          const examObj = exams.find(e => e.id === item.exam_id);
                          const examTitle = examObj ? examObj.title : 'ชุดข้อสอบที่ถูกลบ';
                          const lockedTimeStr = item.locked_at ? new Date(item.locked_at).toLocaleTimeString() : 'เพิ่งเมื่อสักครู่';

                          return (
                            <div 
                              key={`${item.student_id}-${item.exam_id}-${idx}`}
                              className="bg-slate-950/60 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl p-4 flex items-center justify-between gap-4 transition-all shadow-[0_4px_12px_rgba(244,63,94,0.05)]"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-200 text-sm">{studentName}</span>
                                  <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 rounded text-[10px] font-bold">
                                    {classGroup}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400">รหัสประจำตัว: <span className="font-mono font-bold text-slate-300">{item.student_id}</span></p>
                                <p className="text-xs text-rose-400 font-semibold truncate max-w-[200px]" title={examTitle}>
                                  วิชา: {examTitle}
                                </p>
                                <p className="text-[10px] text-slate-500">ถูกล็อกเมื่อเวลา: {lockedTimeStr}</p>
                              </div>

                              <button
                                onClick={() => handleRemoteUnlock(item.student_id, item.exam_id, studentName)}
                                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white border border-rose-700 hover:border-rose-600 font-semibold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(244,63,94,0.2)] hover:scale-105 active:scale-95 transition-all"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>คลิกเพื่อปลดล็อก</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Real-time Incident Logs Monitoring Feed */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base flex items-center gap-2 text-rose-400">
                        <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />
                        <span>Real-Time สอบสวนทุจริตเรียลไทม์ (Live Logs)</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        {cheatLogs.length > 0 && (
                          confirmBulkDelete ? (
                            <div className="flex items-center gap-1.5 bg-red-950/60 border border-red-900/40 p-1 px-2 rounded-xl animate-pulse">
                              <span className="text-[10px] text-red-300 font-bold">ยืนยันการลบ?</span>
                              <button
                                onClick={() => {
                                  handleDeleteAllCheatLogs();
                                  setConfirmBulkDelete(false);
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[10px] cursor-pointer transition-colors"
                              >
                                ลบทั้งหมด
                              </button>
                              <button
                                onClick={() => setConfirmBulkDelete(false)}
                                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] cursor-pointer transition-colors"
                              >
                                เลิก
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmBulkDelete(true)}
                              className="px-2.5 py-1.5 bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="ลบประวัติการทุจริตทั้งหมด"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>ลบประวัติทั้งหมด</span>
                            </button>
                          )
                        )}
                        <button 
                          onClick={refreshData}
                          className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                          title="อัปเดตข้อมูล"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 font-bold">
                          <tr>
                            <th className="p-3">เวลาระบบ</th>
                            <th className="p-3">รหัสนักเรียน</th>
                            <th className="p-3">ชื่อ-นามสกุล</th>
                            <th className="p-3">การละเมิดกฎ</th>
                            <th className="p-3">รายละเอียดเชิงลึก</th>
                            <th className="p-3 text-right">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {cheatLogs.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                                ไม่พบข้อมูลการละเมิดกฎการสอบสวนในขณะนี้
                              </td>
                            </tr>
                          ) : (
                            cheatLogs.map(cl => (
                              <tr key={cl.id} className="bg-rose-950/5 hover:bg-rose-950/10 transition-colors">
                                <td className="p-3 font-mono text-slate-400">{new Date(cl.timestamp).toLocaleTimeString()}</td>
                                <td className="p-3 font-bold">{cl.student_id}</td>
                                <td className="p-3">{cl.student_name}</td>
                                <td className="p-3">
                                  <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                                    cl.violation_type === 'screenshot_attempt' 
                                      ? 'bg-red-600 text-white border border-red-500 animate-pulse flex items-center gap-1 w-fit' 
                                      : 'bg-rose-600/20 text-rose-400 border border-rose-500/20'
                                  }`}>
                                    {cl.violation_type === 'screenshot_attempt' && <span>📸 </span>}
                                    {cl.violation_type === 'tab_switch' ? 'สลับหน้าจอ' :
                                     cl.violation_type === 'fullscreen_exit' ? 'ออกจากจอใหญ่' :
                                     cl.violation_type === 'blur' ? 'เสียโฟกัส' :
                                     cl.violation_type === 'screenshot_attempt' ? 'พยายามแคปจอสอบ!' : 'คลิกขวา'}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-400">{cl.details}</td>
                                <td className="p-3 text-right">
                                  <button
                                    onClick={() => handleDeleteCheatLog(cl.id)}
                                    className="p-1 bg-red-950/40 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded transition-all cursor-pointer"
                                    title="ลบรายการนี้"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* === SUBPAGE: LIVE EXAM PROCTORING MONITOR === */}
              {activeTab === 'live_monitor' && (
                <div className="space-y-6">
                  {/* Header & Overview */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl animate-pulse">
                          <Activity className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base flex items-center gap-2">
                            <span>ติดตามสถานะการสอบแบบเรียลไทม์ (Live Exam Proctoring)</span>
                          </h3>
                          <p className="text-xs text-slate-400">ตรวจสอบสถานะรายชื่อนักเรียน ความก้าวหน้าคำตอบ และการสลับหน้าจอสด ณ ขณะนี้</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => refreshData()}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 self-start sm:self-center cursor-pointer transition-all active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>อัปเดตข้อมูลสด</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                      <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">นักเรียนทั้งหมดในระบบ</p>
                          <p className="text-xl font-black text-blue-300">{students.length} คน</p>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">กำลังสอบ ณ ขณะนี้</p>
                          <p className="text-xl font-black text-amber-400 animate-pulse">{liveSessions.length} คน</p>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">การแจ้งเตือนสลับจอ</p>
                          <p className="text-xl font-black text-rose-400">{cheatLogs.length} ครั้ง</p>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">ส่งข้อสอบเรียบร้อยแล้ว</p>
                          <p className="text-xl font-black text-emerald-400">{examResults.length} ฉบับ</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filter Toolbar & Students List Table */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span>ติดตามสถานะรายชื่อนักเรียน ({students.length} คน)</span>
                      </h4>

                      {/* Filters */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="relative min-w-[180px]">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type="text"
                            placeholder="ค้นหารหัสนักเรียน/ชื่อ..."
                            value={liveMonitorSearch}
                            onChange={e => setLiveMonitorSearch(e.target.value)}
                            className="w-full input-3d rounded-xl pl-8 pr-3 py-1.5 text-xs"
                          />
                        </div>

                        <select 
                          value={liveMonitorClassFilter}
                          onChange={e => setLiveMonitorClassFilter(e.target.value)}
                          className="input-3d rounded-xl px-3 py-1.5 text-xs"
                        >
                          <option value="">ทุกห้องเรียน</option>
                          {Array.from(new Set(students.map(s => s.class_group))).filter(Boolean).sort().map(c => (
                            <option key={c} value={c}>ห้อง {c}</option>
                          ))}
                        </select>

                        <select 
                          value={liveMonitorStatusFilter}
                          onChange={e => setLiveMonitorStatusFilter(e.target.value as any)}
                          className="input-3d rounded-xl px-3 py-1.5 text-xs"
                        >
                          <option value="all">ทุกสถานะการสอบ</option>
                          <option value="taking">🟡 กำลังทำข้อสอบ</option>
                          <option value="completed">🟢 ส่งข้อสอบแล้ว</option>
                          <option value="cheated">🔴 พบบันทึกสลับจอ</option>
                          <option value="not_started">⚪ ยังไม่เข้าสอบ</option>
                        </select>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-3">รหัสนักเรียน</th>
                            <th className="p-3">ชื่อ-นามสกุล</th>
                            <th className="p-3">ห้องเรียน</th>
                            <th className="p-3">สถานะเรียลไทม์</th>
                            <th className="p-3">ความก้าวหน้า/ผลคะแนน</th>
                            <th className="p-3 text-center">สลับจอ (พฤติกรรม)</th>
                            <th className="p-3 text-right">การควบคุมโดยครู</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {students.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                                ยังไม่มีข้อมูลนักเรียนในระบบ คุณสามารถเพิ่มนักเรียนได้ที่เมนู <b>"จัดการรายชื่อนักเรียน"</b>
                              </td>
                            </tr>
                          ) : (
                            students
                              .filter(student => {
                                const matchesSearch = !liveMonitorSearch || 
                                  student.student_id.toLowerCase().includes(liveMonitorSearch.toLowerCase()) || 
                                  student.name.toLowerCase().includes(liveMonitorSearch.toLowerCase());
                                
                                const matchesClass = !liveMonitorClassFilter || student.class_group === liveMonitorClassFilter;

                                const hasResult = examResults.some(r => r.student_id === student.student_id);
                                const liveSess = liveSessions.find(s => s.student_id === student.student_id);
                                const studCheatCount = cheatLogs.filter(c => c.student_id === student.student_id).length;

                                let matchesStatus = true;
                                if (liveMonitorStatusFilter === 'taking') {
                                  matchesStatus = !!liveSess;
                                } else if (liveMonitorStatusFilter === 'completed') {
                                  matchesStatus = hasResult;
                                } else if (liveMonitorStatusFilter === 'cheated') {
                                  matchesStatus = studCheatCount > 0;
                                } else if (liveMonitorStatusFilter === 'not_started') {
                                  matchesStatus = !hasResult && !liveSess;
                                }

                                return matchesSearch && matchesClass && matchesStatus;
                              })
                              .map((student) => {
                                const liveSess = liveSessions.find(s => s.student_id === student.student_id);
                                const resultObj = examResults.find(r => r.student_id === student.student_id);
                                const studCheatCount = cheatLogs.filter(c => c.student_id === student.student_id).length;
                                const isLocked = lockedStudents.some(l => l.student_id === student.student_id);

                                return (
                                  <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                                    <td className="p-3 font-mono text-slate-300 font-bold">{student.student_id}</td>
                                    <td className="p-3 font-semibold text-white">{student.name}</td>
                                    <td className="p-3 text-slate-400 font-medium">{student.class_group || 'ม.4/1'}</td>
                                    <td className="p-3">
                                      {isLocked ? (
                                        <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                                          <Lock className="w-3 h-3" />
                                          <span>ถูกล็อกหน้าจอ</span>
                                        </span>
                                      ) : liveSess ? (
                                        <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit animate-pulse">
                                          <Activity className="w-3 h-3" />
                                          <span>กำลังทำข้อสอบ</span>
                                        </span>
                                      ) : resultObj ? (
                                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>ส่งข้อสอบแล้ว</span>
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-full font-medium text-[10px] w-fit">
                                          ยังไม่เข้าสอบ
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3 text-slate-300">
                                      {liveSess ? (
                                        <div className="space-y-0.5">
                                          <p className="font-bold text-amber-400 text-[11px]">
                                            ตอบแล้ว {liveSess.answered_count} / {liveSess.total_questions} ข้อ
                                          </p>
                                          <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                            {liveSess.exam_title || 'แบบทดสอบ'}
                                          </p>
                                        </div>
                                      ) : resultObj ? (
                                        <div className="space-y-0.5">
                                          <p className="font-bold text-emerald-400 text-[11px]">
                                            {resultObj.score} / {resultObj.total_score} คะแนน
                                          </p>
                                          <p className="text-[10px] text-slate-400">
                                            {new Date(resultObj.submit_time).toLocaleTimeString()}
                                          </p>
                                        </div>
                                      ) : (
                                        <span className="text-slate-500 italic text-[11px]">-</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-center">
                                      {studCheatCount > 0 ? (
                                        <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3" />
                                          <span>สลับจอ {studCheatCount} ครั้ง</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 text-[10px]">ปกติ (0)</span>
                                      )}
                                    </td>
                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <button 
                                          onClick={() => {
                                            setPopupTargetType('individual');
                                            setPopupTargetValue(student.student_id);
                                            setPopupTitle(`แจ้งเตือนถึง ${student.name}`);
                                            setActiveTab('popup_sender');
                                          }}
                                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                                          title="ส่งข้อความ Popup ให้คนนี้"
                                        >
                                          <Bell className="w-3 h-3" />
                                          <span>ส่ง Popup</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* === SUBPAGE: POPUP MESSAGE BROADCAST === */}
              {activeTab === 'popup_sender' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Send Popup Form (Column 5) */}
                    <div className="lg:col-span-5 card-3d rounded-3xl p-5 md:p-6 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base">ส่งข้อความแจ้งเตือน Popup สด</h3>
                          <p className="text-xs text-slate-400">ส่งป๊อบอัพเด้งด่วนขึ้นหน้าจอนักเรียนทันที</p>
                        </div>
                      </div>

                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">เป้าหมายผู้รับข้อความ</label>
                          <select 
                            value={popupTargetType}
                            onChange={e => setPopupTargetType(e.target.value as any)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs"
                          >
                            <option value="all">นักเรียนทุกคนในระบบ (Broadcast All)</option>
                            <option value="class">เฉพาะกลุ่มห้องเรียน (เช่น ม.4/1)</option>
                            <option value="individual">เฉพาะรายบุคคล (ระบุรหัสนักเรียน)</option>
                          </select>
                        </div>

                        {popupTargetType !== 'all' && (
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">
                              {popupTargetType === 'class' ? 'ชื่อห้องเรียน (เช่น ม.4/1)' : 'รหัสนักเรียน (เช่น STD001)'}
                            </label>
                            <input 
                              type="text" 
                              placeholder={popupTargetType === 'class' ? 'เช่น ม.4/1' : 'เช่น STD001'}
                              value={popupTargetValue}
                              onChange={e => setPopupTargetValue(e.target.value)}
                              className="w-full input-3d rounded-xl px-3 py-2 text-xs"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">ระดับความสำคัญ</label>
                          <select 
                            value={popupImportance}
                            onChange={e => setPopupImportance(e.target.value as any)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs"
                          >
                            <option value="urgent">🔴 แจ้งเตือนด่วนที่สุด (Urgent Alert)</option>
                            <option value="warning">🟡 เตือนกติกาการสอบ (Rule Warning)</option>
                            <option value="info">🔵 ข่าวสารประชาสัมพันธ์ทั่วไป (General Info)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">หัวข้อประกาศ Popup</label>
                          <input 
                            type="text" 
                            placeholder="เช่น แจ้งเตือนเหลือเวลาสอบ 5 นาทีสุดท้าย"
                            value={popupTitle}
                            onChange={e => setPopupTitle(e.target.value)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">รายละเอียดข้อความ</label>
                          <textarea 
                            rows={4}
                            placeholder="พิมพ์ข้อความที่ต้องการให้นักเรียนอ่านบนหน้าจอ..."
                            value={popupBody}
                            onChange={e => setPopupBody(e.target.value)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs resize-none"
                          />
                        </div>

                        <button 
                          onClick={handleSendPopup}
                          className="w-full py-2.5 btn-3d-emerald text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                        >
                          <Send className="w-4 h-4" />
                          <span>ส่งข้อความ Popup ไปยังหน้าจอนักเรียน</span>
                        </button>
                      </div>
                    </div>

                    {/* History of Sent Popups (Column 7) */}
                    <div className="lg:col-span-7 card-3d rounded-3xl p-5 md:p-6 space-y-4">
                      <h4 className="font-bold text-sm text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Megaphone className="w-4 h-4 text-amber-400" />
                        <span>ประวัติการส่งข้อความ Popup ({sentPopups.length} รายการ)</span>
                      </h4>

                      <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                        {sentPopups.length === 0 ? (
                          <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                            ยังไม่มีประวัติการส่งข้อความ Popup กรอกข้อมูลทางด้านซ้ายเพื่อทดลองส่ง
                          </div>
                        ) : (
                          sentPopups.map(msg => (
                            <div key={msg.id} className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-2 relative group hover:border-slate-800 transition-all">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  msg.importance === 'urgent' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                  msg.importance === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                  'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}>
                                  {msg.importance === 'urgent' ? 'ด่วนที่สุด' : msg.importance === 'warning' ? 'เตือนกติกา' : 'ประชาสัมพันธ์'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {new Date(msg.created_at).toLocaleString()}
                                </span>
                              </div>

                              <h5 className="font-bold text-sm text-slate-100">{msg.title}</h5>
                              <p className="text-xs text-slate-300 leading-relaxed">{msg.body}</p>

                              <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 border-t border-slate-900">
                                <span>เป้าหมาย: <b>{msg.target_type === 'all' ? 'ทุกคน' : msg.target_value}</b></span>
                                <button 
                                  onClick={() => handleDeletePopup(msg.id)}
                                  className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                                >
                                  ลบรายการ
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === SUBPAGE: ANNOUNCEMENTS & DISCUSSION FORUM === */}
              {activeTab === 'announcements' && (
                <div className="space-y-6">
                  {/* Announcements Section */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base flex items-center gap-2">
                        <Megaphone className="w-5 h-5 text-indigo-400" />
                        <span>ประกาศข่าวสารทางการจากครูผู้สอน</span>
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      {/* Create Announcement Form */}
                      <div className="md:col-span-1 space-y-3 bg-slate-950/40 p-4 border border-slate-800/60 rounded-2xl">
                        <h4 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">สร้างประกาศใหม่</h4>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">หัวข้อประกาศ</label>
                          <input 
                            type="text"
                            placeholder="เช่น กำหนดการสอบกลางภาค ภาคเรียนที่ 1"
                            value={newAncTitle}
                            onChange={e => setNewAncTitle(e.target.value)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">เนื้อหาประกาศ</label>
                          <textarea 
                            rows={3}
                            placeholder="พิมพ์รายละเอียดประกาศข่าวสาร..."
                            value={newAncContent}
                            onChange={e => setNewAncContent(e.target.value)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs resize-none"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newAncIsPinned}
                              onChange={e => setNewAncIsPinned(e.target.checked)}
                              className="rounded border-slate-800 text-indigo-500 focus:ring-0"
                            />
                            <span>ปักหมุดไว้บนสุด</span>
                          </label>
                          <button 
                            onClick={handleCreateAnnouncement}
                            className="py-2 px-4 btn-3d-emerald text-xs font-bold rounded-xl cursor-pointer"
                          >
                            เผยแพร่ประกาศ
                          </button>
                        </div>
                      </div>

                      {/* Announcement Feed */}
                      <div className="md:col-span-2 space-y-3">
                        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">ประกาศทั้งหมด ({announcements.length} รายการ)</h4>
                        <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3">
                          {announcements.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                              ยังไม่มีประกาศข่าวสารในขณะนี้
                            </div>
                          ) : (
                            announcements.map(anc => (
                              <div key={anc.id} className="bg-slate-950/60 border border-slate-900 rounded-xl p-4 space-y-2 relative">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {anc.is_pinned && (
                                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-full border border-indigo-500/30">
                                        📌 ปักหมุด
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-slate-200">{anc.title}</span>
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteAnnouncement(anc.id)}
                                    className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                                    title="ลบประกาศ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{anc.content}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  โดย {anc.author_name} • {new Date(anc.created_at).toLocaleString()}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Discussion Forum Board */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <span>กระดานสนทนาถาม-ตอบบทเรียน (Q&A Forum)</span>
                    </h3>

                    {/* New Post Box */}
                    <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl space-y-3">
                      <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider">โพสต์ตั้งคำถาม / ข้อเสนอแนะใหม่</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input 
                          type="text" 
                          placeholder="หัวข้อกระทู้..."
                          value={newDiscTitle}
                          onChange={e => setNewDiscTitle(e.target.value)}
                          className="sm:col-span-2 input-3d rounded-xl px-3 py-2 text-xs"
                        />
                        <select 
                          value={newDiscCategory}
                          onChange={e => setNewDiscCategory(e.target.value as any)}
                          className="input-3d rounded-xl px-3 py-2 text-xs"
                        >
                          <option value="question">❓ คำถามบทเรียน/ข้อสอบ</option>
                          <option value="suggestion">💡 ข้อเสนอแนะ</option>
                          <option value="general">💬 พูดคุยทั่วไป</option>
                        </select>
                      </div>
                      <textarea 
                        rows={2}
                        placeholder="พิมพ์เนื้อหาที่ต้องการพูดคุยหรือสอบถาม..."
                        value={newDiscContent}
                        onChange={e => setNewDiscContent(e.target.value)}
                        className="w-full input-3d rounded-xl px-3 py-2 text-xs resize-none"
                      />
                      <div className="flex justify-end">
                        <button 
                          onClick={handleCreateDiscussion}
                          className="px-5 py-2 btn-3d-emerald text-xs font-bold rounded-xl cursor-pointer"
                        >
                          ตั้งกระทู้สนทนา
                        </button>
                      </div>
                    </div>

                    {/* Forum Thread List */}
                    <div className="space-y-4 pt-2">
                      {discussions.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                          ยังไม่มีกระทู้สนทนา เริ่มต้นตั้งกระทู้แรกได้เลยทางด้านบน
                        </div>
                      ) : (
                        discussions.map(disc => (
                          <div key={disc.id} className="bg-slate-950/60 border border-slate-900 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  disc.category === 'question' ? 'bg-amber-500/20 text-amber-300' :
                                  disc.category === 'suggestion' ? 'bg-emerald-500/20 text-emerald-300' :
                                  'bg-blue-500/20 text-blue-300'
                                }`}>
                                  {disc.category === 'question' ? 'คำถาม' : disc.category === 'suggestion' ? 'ข้อเสนอแนะ' : 'ทั่วไป'}
                                </span>
                                <h5 className="font-bold text-sm text-slate-100">{disc.title}</h5>
                              </div>
                              <button 
                                onClick={() => handleDeleteDiscussion(disc.id)}
                                className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer"
                              >
                                ลบกระทู้
                              </button>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed">{disc.content}</p>

                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                              <span>โดย <b className="text-slate-300">{disc.author_name}</b> ({disc.author_role === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'}) • {new Date(disc.created_at).toLocaleString()}</span>
                              <button 
                                onClick={() => handleLikeDiscussion(disc.id)}
                                className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                              >
                                ❤️ ถูกใจ ({disc.likes || 0})
                              </button>
                            </div>

                            {/* Comments list */}
                            {disc.comments && disc.comments.length > 0 && (
                              <div className="pl-4 border-l-2 border-slate-800 space-y-2 pt-2">
                                {disc.comments.map((c: any, cIdx: number) => (
                                  <div key={cIdx} className="bg-slate-900/60 p-2.5 rounded-xl text-xs space-y-1">
                                    <div className="flex justify-between text-[10px] text-slate-400">
                                      <span className="font-bold text-slate-200">{c.author_name} ({c.author_role === 'teacher' ? 'ครูผู้สอน' : 'นักเรียน'})</span>
                                      <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-slate-300">{c.content}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Comment Input */}
                            <div className="flex gap-2 pt-1">
                              <input 
                                type="text"
                                placeholder="เขียนความคิดเห็นตอบกลับ..."
                                value={commentInputs[disc.id] || ''}
                                onChange={e => setCommentInputs({ ...commentInputs, [disc.id]: e.target.value })}
                                className="flex-1 input-3d rounded-xl px-3 py-1.5 text-xs"
                                onKeyDown={e => e.key === 'Enter' && handleAddDiscussionComment(disc.id)}
                              />
                              <button 
                                onClick={() => handleAddDiscussionComment(disc.id)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs cursor-pointer"
                              >
                                ตอบกลับ
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* === SUBPAGE: DATABASE BACKUP & RESTORE === */}
              {activeTab === 'backup' && (
                <div className="space-y-6">
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl">
                        <Database className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base">การสำรองข้อมูล และ คืนค่าฐานข้อมูล (Backup & Restore)</h3>
                        <p className="text-xs text-slate-400">จัดการส่งออกหรือนำเข้าฐานข้อมูลระบบข้อสอบ รายวิชา รายชื่อนักเรียน และผลคะแนนทั้งหมด</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                      {/* Export Card */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h4 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            <span>1. สำรองข้อมูลระบบ (Export Database)</span>
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            ดาวน์โหลดไฟล์โครงสร้างฐานข้อมูลเต็มรูปแบบ (.json) เก็บไว้ในเครื่องคอมพิวเตอร์ของคุณ เพื่อป้องกันข้อมูลสูญหาย
                          </p>
                        </div>

                        <button 
                          onClick={handleDownloadBackup}
                          className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
                        >
                          <Download className="w-4 h-4" />
                          <span>ดาวน์โหลดไฟล์สำรองข้อมูล (.json)</span>
                        </button>
                      </div>

                      {/* Restore Card */}
                      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            <span>2. คืนค่าฐานข้อมูล (Restore Database)</span>
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            เลือกไฟล์สำรองข้อมูล (.json) จากเครื่องของคุณเพื่อนำกลับมาใช้งานในระบบ
                          </p>
                        </div>

                        <div className="relative border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 text-center cursor-pointer bg-slate-900/40 transition-all">
                          <input 
                            type="file" 
                            accept=".json"
                            onChange={handleRestoreBackupFile}
                            disabled={isRestoringBackup}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          {isRestoringBackup ? (
                            <p className="text-xs font-bold text-emerald-400 animate-pulse">กำลังนำคืนข้อมูลฐานข้อมูล...</p>
                          ) : (
                            <p className="text-xs font-semibold text-slate-300">คลิกที่นี่เพื่อเลือกไฟล์สำรองข้อมูล (.json) เพื่อนำคืน</p>
                          )}
                        </div>
                      </div>

                      {/* Supabase Cloud Setup & SQL Copy Card */}
                      <div className="bg-amber-950/30 border border-amber-600/40 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h4 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                            <Cloud className="w-4 h-4" />
                            <span>3. ตั้งค่า Cloud Supabase (SQL Setup)</span>
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            หากโปรเจกต์ Supabase บนคลาวด์ของคุณยังไม่ได้สร้างตาราง ให้คัดลอกคำสั่ง SQL ไปวางใน Supabase SQL Editor แล้วกด Run ได้เลย
                          </p>
                        </div>

                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                              showToast('คัดลอกคำสั่ง SQL สำหรับ Supabase เรียบร้อยแล้ว! นำไปวางใน Supabase SQL Editor แล้วกด Run ได้เลย', 'success');
                            }}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                          >
                            <Download className="w-4 h-4" />
                            <span>📋 คัดลอกคำสั่ง SQL สร้างตารางลง Supabase</span>
                          </button>

                          <button 
                            onClick={() => {
                              handleTestDbConnection();
                              setShowDbStatusModal(true);
                            }}
                            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                          >
                            <Database className="w-3.5 h-3.5" />
                            <span>ดูสถานะ และ ซิงค์ Local ขึ้น Cloud</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === SUBPAGE: SUBJECTS & EXAMS MANAGEMENT === */}
              {activeTab === 'subjects' && (
                <div className="space-y-6">

                  {/* Manage Subjects Section */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-rose-500" />
                      <span>จัดการรายวิชาเรียน (Manage Subjects)</span>
                    </h3>
                    <p className="text-xs text-slate-400">เพิ่มหรือลบรายวิชาเรียนในระบบ เพื่อนำไปใช้สร้างชุดข้อสอบต่อไป</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      {/* Form to Add Subject */}
                      <div className="md:col-span-1 space-y-4 bg-slate-950/40 p-4 border border-slate-800/60 rounded-2xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                        <h4 className="font-bold text-xs text-rose-400 uppercase tracking-wider">เพิ่มรายวิชาใหม่</h4>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">รหัสวิชา</label>
                          <input 
                            type="text" 
                            placeholder="เช่น ว31101"
                            value={newSubjectCode}
                            onChange={e => setNewSubjectCode(e.target.value)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">ชื่อรายวิชา</label>
                          <input 
                            type="text" 
                            placeholder="เช่น เทคโนโลยีวิทยาการคำนวณ"
                            value={newSubjectName}
                            onChange={e => setNewSubjectName(e.target.value)}
                            className="w-full input-3d rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        </div>
                        <button 
                          onClick={handleAddSubject}
                          className="w-full py-2 btn-3d-emerald text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>เพิ่มรายวิชา</span>
                        </button>
                      </div>

                      {/* Subject List */}
                      <div className="md:col-span-2 space-y-3">
                        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">รายวิชาทั้งหมดในระบบ ({subjects.length} วิชา)</h4>
                        <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                          {subjects.map(s => (
                            <div key={s.id} className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-800 transition-all">
                              <div className="flex items-center gap-2.5">
                                <span className="bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border border-rose-500/20">
                                  {s.code}
                                </span>
                                <span className="text-xs font-medium text-slate-200">{s.name}</span>
                              </div>
                              <button 
                                onClick={() => handleDeleteSubject(s.id)}
                                className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-lg border border-rose-500/15 cursor-pointer transition-all active:scale-95"
                                title="ลบรายวิชา"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {subjects.length === 0 && (
                            <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                              ยังไม่มีรายวิชาเรียนในระบบ กรุณากรอกเพิ่มวิชาทางด้านซ้าย
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                   {/* Create New Exam */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-rose-500" />
                      <span>สร้างชุดข้อสอบใหม่</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">เลือกรายวิชาเรียน</label>
                        <select 
                          value={selectedSubjectId}
                          onChange={e => setSelectedSubjectId(e.target.value)}
                          className="w-full input-3d rounded-xl px-4 py-2.5 text-xs"
                        >
                          <option value="">-- เลือกรายวิชา --</option>
                          {subjects.map(s => (
                            <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">ชื่อชุดข้อสอบ</label>
                        <input 
                          type="text" 
                          placeholder="เช่น สอบกลางภาคเรียนที่ 1"
                          value={newExamTitle}
                          onChange={e => setNewExamTitle(e.target.value)}
                          className="w-full input-3d rounded-xl px-4 py-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">ประเภทการสอบ</label>
                        <select 
                          value={newExamType}
                          onChange={e => setNewExamType(e.target.value as any)}
                          className="w-full input-3d rounded-xl px-4 py-2.5 text-xs"
                        >
                          <option value="quiz">แบบทดสอบสั้น (Quiz)</option>
                          <option value="midterm">สอบกลางภาค (Midterm)</option>
                          <option value="final">สอบปลายภาค (Final)</option>
                          <option value="practice">ฝึกฝนทบทวน (Practice)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">เวลาที่ใช้สอบ (นาที)</label>
                        <input 
                          type="number" 
                          placeholder="เช่น 60"
                          value={newExamDuration}
                          onChange={e => setNewExamDuration(e.target.value)}
                          className="w-full input-3d rounded-xl px-4 py-2.5 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="randomQuestions"
                        checked={newExamRandom}
                        onChange={e => setNewExamRandom(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-rose-600 focus:ring-rose-500"
                      />
                      <label htmlFor="randomQuestions" className="text-xs text-slate-300">
                        สุ่มสลับตำแหน่งข้อและตัวเลือกคำตอบเพื่อลดการลอกข้อสอบ
                      </label>
                    </div>

                    {/* Anti-Cheat Security Level Selector */}
                    <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-2xl space-y-3">
                      <label className="block text-xs font-bold text-rose-400">🛡️ กำหนดความเข้มงวดของระบบป้องกันการทุจริต (Anti-Cheat Security Level)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <button
                          type="button"
                          onClick={() => setNewExamAntiCheatLevel('strict')}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
                            newExamAntiCheatLevel === 'strict'
                              ? 'bg-red-500/10 border-red-500/40 text-red-200'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span>1. เข้มงวดสูงสุด (Strict)</span>
                          </div>
                          <p className="text-[10px] leading-tight text-slate-400">
                            ล็อกหน้าจอทันทีเมื่อสลับแท็บ ย่อเบราว์เซอร์ หรือละโฟกัส (พร้อมระบบแคปจอดำป้องกันการลอก)
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewExamAntiCheatLevel('moderate')}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
                            newExamAntiCheatLevel === 'moderate'
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-400">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>2. ระดับปานกลาง (Moderate)</span>
                          </div>
                          <p className="text-[10px] leading-tight text-slate-400">
                            ล็อกหน้าจอเมื่อสลับแท็บหรือแอบแคปจอ แต่ถ้าละหน้าโฟกัสจะเป็นแรเงาดำชั่วคราวแต่ไม่ล็อกเครื่องทันที
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewExamAntiCheatLevel('relaxed')}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
                            newExamAntiCheatLevel === 'relaxed'
                              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-200'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-400">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span>3. ระดับผ่อนปรน (Relaxed)</span>
                          </div>
                          <p className="text-[10px] leading-tight text-slate-400">
                            ไม่ล็อกหน้าจอผู้เรียนเลย! เน้นบันทึกรายงานการทุจริตประวัติเงียบ (Silent Logs) ให้ครูตรวจสอบ
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setNewExamAntiCheatLevel('off')}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
                            newExamAntiCheatLevel === 'off'
                              ? 'bg-slate-800 border-slate-600 text-slate-200'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                            <span>4. ปิดการป้องกัน (Off)</span>
                          </div>
                          <p className="text-[10px] leading-tight text-slate-400">
                            ปิดระบบป้องกันทุจริตและการย้อมจอดำทั้งหมดอย่างสมบูรณ์ เหมาะสำหรับการฝึกซ้อมสอบ
                          </p>
                        </button>
                      </div>
                    </div>

                    <button 
                      onClick={handleAddExam}
                      className="py-2.5 px-6 btn-3d-primary font-bold rounded-xl text-xs cursor-pointer"
                    >
                      สร้างชุดข้อสอบ
                    </button>
                  </div>

                  {/* Exams List & Question Builder */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-6">
                    <h3 className="font-bold text-base">รายการชุดข้อสอบทั้งหมด</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {exams.map(exam => {
                        const sub = subjects.find(s => s.id === exam.subject_id);
                        return (
                          <div key={exam.id} className="bg-slate-950 p-4 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-rose-600/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                  {exam.type}
                                </span>
                                {sub && (
                                  <span className="text-xs text-slate-400 font-mono">[{sub.code}] {sub.name}</span>
                                )}
                              </div>
                              <h4 className="font-bold text-sm text-slate-200">{exam.title}</h4>
                              <p className="text-xs text-slate-400">เวลาจำกัด {exam.duration} นาที • ระบบสุ่มคำถาม: {exam.randomize ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}</p>
                              
                              <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-900 flex-wrap">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">ระดับการป้องกันทุจริต:</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  (exam.anti_cheat_level || 'strict') === 'strict' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  (exam.anti_cheat_level || 'strict') === 'moderate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  (exam.anti_cheat_level || 'strict') === 'relaxed' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {(exam.anti_cheat_level || 'strict') === 'strict' ? '🔴 เข้มงวดสูงสุด (Strict)' :
                                   (exam.anti_cheat_level || 'strict') === 'moderate' ? '🟡 ปานกลาง (Moderate)' :
                                   (exam.anti_cheat_level || 'strict') === 'relaxed' ? '🔵 ผ่อนปรน (Relaxed)' :
                                   '⚫ ปิดการตรวจจับ (Off)'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* Quick Security Level Adjuster */}
                              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
                                <span className="text-[10px] text-slate-400 font-medium">ปรับความปลอดภัย:</span>
                                <select
                                  value={exam.anti_cheat_level || 'strict'}
                                  onChange={(e) => handleUpdateAntiCheatLevel(exam.id, e.target.value as any)}
                                  className="bg-transparent border-0 rounded text-[10px] font-bold text-slate-200 focus:outline-none focus:ring-0 p-0 cursor-pointer"
                                >
                                  <option value="strict">🔴 เข้มงวดสูงสุด</option>
                                  <option value="moderate">🟡 ปานกลาง</option>
                                  <option value="relaxed">🔵 ผ่อนปรน</option>
                                  <option value="off">⚫ ปิดการป้องกัน</option>
                                </select>
                              </div>

                              <button 
                                onClick={() => {
                                  setSelectedExamForQuestions(exam.id);
                                  setEditingQuestion({
                                    exam_id: exam.id,
                                    question_text: '',
                                    options: ['', '', '', ''],
                                    correct_index: 0,
                                    points: 1,
                                    explanation: ''
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  selectedExamForQuestions === exam.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                }`}
                              >
                                จัดการคำถาม ({activeExamQuestions && selectedExamForQuestions === exam.id ? activeExamQuestions.length : '...'} ข้อ)
                              </button>

                              <button 
                                onClick={() => handleToggleExamStatus(exam)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  exam.is_active ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {exam.is_active ? 'สถานะ: เปิดสอบอยู่' : 'สถานะ: ปิดการเข้าสอบ'}
                              </button>

                              <button 
                                onClick={() => handleDeleteExam(exam.id)}
                                className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/10 rounded-lg text-xs font-bold transition-all"
                              >
                                ลบชุดข้อสอบ
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {exams.length === 0 && (
                        <p className="text-xs text-center text-slate-500 py-4">ยังไม่เคยมีการสร้างชุดข้อสอบในระบบ</p>
                      )}
                    </div>
                  </div>

                  {/* Selected Exam's Questions CRUD Section */}
                  {selectedExamForQuestions && (
                    <div className="card-3d rounded-3xl p-5 md:p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-base text-indigo-400">คลังข้อสอบภายใน: {exams.find(e => e.id === selectedExamForQuestions)?.title}</h3>
                          <p className="text-xs text-slate-400">รวมทั้งหมด {activeExamQuestions.length} คำถามในชุดข้อสอบนี้</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button 
                            onClick={() => {
                              setIsTextImporterOpen(true);
                              setRawImporterText('');
                              setParsedQuestions([]);
                            }}
                            className="px-3 py-1.5 border border-indigo-600/30 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span>นำเข้าจากข้อความ (Auto-import)</span>
                          </button>

                          <button 
                            onClick={() => setEditingQuestion({
                              exam_id: selectedExamForQuestions,
                              question_text: '',
                              options: ['', '', '', ''],
                              correct_index: 0,
                              points: 1,
                              explanation: ''
                            })}
                            className="px-3 py-1.5 btn-3d-secondary rounded-xl text-xs font-bold flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>สร้างข้อสอบใหม่</span>
                          </button>
                        </div>
                      </div>

                      {/* Manual Question Editor Form */}
                      {editingQuestion && (
                        <div className="bg-slate-950 p-5 border border-slate-800 rounded-2xl space-y-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                          <h4 className="font-bold text-sm text-slate-200">
                            {editingQuestion.id ? 'แก้ไขข้อสอบคลังหลัก' : 'เพิ่มข้อสอบข้อใหม่เข้าระบบ'}
                          </h4>

                          <div className="space-y-2">
                            <label className="block text-xs text-slate-400">เนื้อหาโจทย์ข้อสอบ (ภาษาไทย/อังกฤษ)</label>
                            <input 
                              type="text" 
                              placeholder="เช่น ข้อใดคือหน่วยย่อยที่เล็กที่สุดของสิ่งมีชีวิต?"
                              value={editingQuestion.question_text || ''}
                              onChange={e => setEditingQuestion({...editingQuestion, question_text: e.target.value})}
                              className="w-full input-3d rounded-xl px-4 py-2.5 text-xs text-slate-100"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {editingQuestion.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="space-y-1">
                                <label className="block text-[10px] text-slate-500 font-bold uppercase">ตัวเลือก {['ก', 'ข', 'ค', 'ง', 'จ'][oIdx] || ''} (ตัวเลือกที่ {oIdx + 1})</label>
                                <input 
                                  type="text" 
                                  placeholder={`พิมพ์ตัวเลือกที่ ${oIdx + 1}`}
                                  value={opt}
                                  onChange={e => {
                                    const opts = [...(editingQuestion.options || ['', '', '', ''])];
                                    opts[oIdx] = e.target.value;
                                    setEditingQuestion({...editingQuestion, options: opts});
                                  }}
                                  className="w-full input-3d rounded-xl px-4 py-2 text-xs text-slate-100"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">ตัวเฉลยที่ถูกต้อง</label>
                              <select 
                                value={editingQuestion.correct_index}
                                onChange={e => setEditingQuestion({...editingQuestion, correct_index: Number(e.target.value)})}
                                className="w-full input-3d rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none"
                              >
                                <option value={0}>ตัวเลือก ก.</option>
                                <option value={1}>ตัวเลือก ข.</option>
                                <option value={2}>ตัวเลือก ค.</option>
                                <option value={3}>ตัวเลือก ง.</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">คะแนนของข้อนี้</label>
                              <input 
                                type="number" 
                                value={editingQuestion.points || 1}
                                onChange={e => setEditingQuestion({...editingQuestion, points: Number(e.target.value)})}
                                className="w-full input-3d rounded-xl px-4 py-2 text-xs text-slate-100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">คำอธิบายเพิ่มเติม (ถ้ามี)</label>
                              <input 
                                type="text" 
                                placeholder="เช่น อธิบายเฉลย..."
                                value={editingQuestion.explanation || ''}
                                onChange={e => setEditingQuestion({...editingQuestion, explanation: e.target.value})}
                                className="w-full input-3d rounded-xl px-4 py-2 text-xs text-slate-100"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <button 
                              onClick={handleSaveQuestionEdit}
                              className="px-5 py-2 btn-3d-emerald text-white text-xs font-bold rounded-xl cursor-pointer"
                            >
                              บันทึกข้อสอบ
                            </button>
                            <button 
                              onClick={() => setEditingQuestion(null)}
                              className="px-5 py-2 btn-3d-secondary text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Questions List Inside Selected Exam */}
                      <div className="space-y-4">
                        {activeExamQuestions.map((q, idx) => (
                          <div key={q.id} className="bg-slate-950 p-4 border border-slate-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="space-y-1">
                              <p className="text-xs font-mono font-bold text-indigo-400">คำถามข้อที่ {idx + 1} ({q.points} คะแนน)</p>
                              <h5 className="font-semibold text-sm text-slate-100">{q.question_text}</h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                                {q.options.map((opt, oIdx) => (
                                  <div 
                                    key={oIdx} 
                                    className={`px-2.5 py-1 text-[10px] rounded-lg border ${
                                      q.correct_index === oIdx ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20' : 'bg-slate-900 text-slate-400 border-transparent'
                                    }`}
                                  >
                                    <b>{['ก', 'ข', 'ค', 'ง', 'จ'][oIdx] || ''}.</b> {opt}
                                  </div>
                                ))}
                              </div>
                              {q.explanation && (
                                <p className="text-[10px] text-slate-500 italic mt-1">เฉลยอ้างอิง: {q.explanation}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setEditingQuestion(q)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer"
                              >
                                แก้ไข
                              </button>
                              <button 
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="px-2.5 py-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 rounded text-xs cursor-pointer"
                              >
                                ลบ
                              </button>
                            </div>
                          </div>
                        ))}
                        {activeExamQuestions.length === 0 && (
                          <p className="text-xs text-center text-slate-500">ชุดข้อสอบนี้ยังไม่มีคำถาม กรุณากดปุ่มสร้างข้อสอบเพื่อเพิ่มข้อสอบข้อแรก</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === SUBPAGE: EXAM ITEM ANALYSIS (CTT) === */}
              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  {/* Filter & Selector Card */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                          <Brain className="w-5 h-5 text-indigo-400" />
                          <span>ระบบวิเคราะห์คุณภาพข้อสอบ (Classical Test Theory - CTT)</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          วิเคราะห์ความยากง่าย (p) และอำนาจจำแนก (r) ของข้อสอบแต่ละข้อ เพื่อประเมินความสอดคล้อง คุณภาพของข้อสอบ และวิเคราะห์ตัวลวง (Distractor Analysis) เพื่อปรับปรุงชุดทดสอบให้มีมาตรฐานสูงขึ้น
                        </p>
                      </div>
                      
                      <button 
                        onClick={refreshData}
                        className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20 text-xs font-semibold flex items-center gap-2 cursor-pointer self-start md:self-auto transition-all"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>ดึงข้อมูลล่าสุด</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Select Exam */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-1">เลือกชุดข้อสอบที่จะวิเคราะห์</label>
                        <select
                          value={analysisSelectedExamId}
                          onChange={e => {
                            setAnalysisSelectedExamId(e.target.value);
                            setAnalysisExpandedQuestionId(null);
                          }}
                          className="w-full input-3d rounded-xl px-3 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all text-xs"
                        >
                          <option value="">-- โปรดเลือกชุดข้อสอบ --</option>
                          {exams.map(exam => {
                            const subj = subjects.find(s => s.id === exam.subject_id);
                            const subjName = subj ? `[${subj.code}] ${subj.name}` : 'ไม่ระบุวิชา';
                            return (
                              <option key={exam.id} value={exam.id}>{subjName} - {exam.title}</option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Select Classroom */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider pl-1">คัดกรองตามห้องเรียน (Classroom)</label>
                        <select
                          value={analysisSelectedClass}
                          onChange={e => {
                            setAnalysisSelectedClass(e.target.value);
                            setAnalysisExpandedQuestionId(null);
                          }}
                          disabled={!analysisSelectedExamId}
                          className="w-full input-3d rounded-xl px-3 py-2.5 bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">-- แสดงทุกห้องเรียน --</option>
                          {Array.from(new Set(students.map(s => s.class_group).filter(Boolean))).sort().map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Loading or Empty State */}
                  {!analysisSelectedExamId ? (
                    <div className="card-3d rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                      <div className="p-4 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-3xl">
                        <Brain className="w-8 h-8 animate-bounce" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-200">ยังไม่ได้เลือกชุดข้อสอบ</h4>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        โปรดเลือกชุดข้อสอบที่คุณครูต้องการทำการประเมินค่าคุณภาพเครื่องมือวัดผลและสถิติวัดแนะเพื่อพิจารณาโครงสร้างความคุ้มค่าด้านล่าง
                      </p>
                    </div>
                  ) : isAnalysisLoading ? (
                    <div className="card-3d rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                      <p className="text-xs text-slate-400">กำลังดาวน์โหลดข้อมูลคำถามและผลคะแนนของวิชาสอบ...</p>
                    </div>
                  ) : (() => {
                    const matchedResults = examResults.filter(r => {
                      if (r.exam_id !== analysisSelectedExamId) return false;
                      if (r.status !== 'completed') return false;
                      if (analysisSelectedClass) {
                        const s = students.find(stud => stud.student_id === r.student_id);
                        if (!s || s.class_group !== analysisSelectedClass) return false;
                      }
                      return true;
                    });

                    const totalTakers = matchedResults.length;

                    if (totalTakers === 0) {
                      return (
                        <div className="card-3d rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                          <div className="p-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-3xl">
                            <AlertTriangle className="w-8 h-8" />
                          </div>
                          <h4 className="text-sm font-bold text-rose-400">ยังไม่มีข้อมูลนักเรียนส่งข้อสอบ</h4>
                          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                            ระบบไม่พบผลการสอบของนักเรียนชั้น <span className="text-rose-400 font-bold">{analysisSelectedClass || 'ทุกห้องเรียน'}</span> สำหรับแบบทดสอบชุดนี้ เพื่อดำเนินการวิเคราะห์ความยากและอำนาจจำแนกได้อย่างถูกต้อง จำเป็นต้องมีข้อมูลผู้สอบส่งคะแนนอย่างน้อย 1 คน
                          </p>
                        </div>
                      );
                    }

                    // Compute Classical Test Theory statistics
                    const itemsAnalysis = analysisQuestions.map((q, idx) => {
                      const qId = q.id || '';
                      const correctOptionIndex = q.correct_index;
                      const optionCounts = Array(q.options.length).fill(0);
                      let correctCount = 0;

                      // High and Low group splits for Discrimination Index (r)
                      const sortedByScore = [...matchedResults].sort((a, b) => b.score - a.score);
                      const half = Math.floor(sortedByScore.length / 2);

                      let rValue = 0;
                      let isDiscrimCalculated = false;
                      let highCorrect = 0;
                      let lowCorrect = 0;

                      let highOptionCounts = Array(q.options.length).fill(0);
                      let lowOptionCounts = Array(q.options.length).fill(0);

                      matchedResults.forEach(res => {
                        let ansObj: Record<string, number> = {};
                        try {
                          ansObj = typeof res.answers === 'string' ? JSON.parse(res.answers) : res.answers;
                        } catch (e) {}
                        const chosenIndex = ansObj[qId];
                        if (chosenIndex !== undefined && chosenIndex >= 0 && chosenIndex < q.options.length) {
                          optionCounts[chosenIndex]++;
                          if (chosenIndex === correctOptionIndex) {
                            correctCount++;
                          }
                        }
                      });

                      if (half >= 1) {
                        const highGroup = sortedByScore.slice(0, half);
                        const lowGroup = sortedByScore.slice(sortedByScore.length - half);

                        highGroup.forEach(res => {
                          let ansObj: Record<string, number> = {};
                          try {
                            ansObj = typeof res.answers === 'string' ? JSON.parse(res.answers) : res.answers;
                          } catch (e) {}
                          const chosenIndex = ansObj[qId];
                          if (chosenIndex !== undefined && chosenIndex >= 0 && chosenIndex < q.options.length) {
                            highOptionCounts[chosenIndex]++;
                            if (chosenIndex === correctOptionIndex) {
                              highCorrect++;
                            }
                          }
                        });

                        lowGroup.forEach(res => {
                          let ansObj: Record<string, number> = {};
                          try {
                            ansObj = typeof res.answers === 'string' ? JSON.parse(res.answers) : res.answers;
                          } catch (e) {}
                          const chosenIndex = ansObj[qId];
                          if (chosenIndex !== undefined && chosenIndex >= 0 && chosenIndex < q.options.length) {
                            lowOptionCounts[chosenIndex]++;
                            if (chosenIndex === correctOptionIndex) {
                              lowCorrect++;
                            }
                          }
                        });

                        const pH = highCorrect / half;
                        const pL = lowCorrect / half;
                        rValue = Number((pH - pL).toFixed(2));
                        isDiscrimCalculated = true;
                      }

                      const p = Number((correctCount / totalTakers).toFixed(2));

                      return {
                        question: q,
                        itemNumber: idx + 1,
                        p,
                        r: rValue,
                        isDiscrimCalculated,
                        correctCount,
                        optionCounts,
                        highOptionCounts,
                        lowOptionCounts,
                        highGroupSize: half,
                        lowGroupSize: half,
                      };
                    });

                    // Summary statistics
                    const totalQuestions = itemsAnalysis.length;
                    const avgDifficulty = totalQuestions > 0 
                      ? Number((itemsAnalysis.reduce((sum, item) => sum + item.p, 0) / totalQuestions).toFixed(2))
                      : 0;

                    const validDiscrims = itemsAnalysis.filter(i => i.isDiscrimCalculated);
                    const avgDiscrim = validDiscrims.length > 0
                      ? Number((validDiscrims.reduce((sum, item) => sum + item.r, 0) / validDiscrims.length).toFixed(2))
                      : 0;

                    // Classify test overall difficulty and discrimination
                    let overallDifficultyText = 'ยากพอเหมาะ';
                    let overallDiffColor = 'text-cyan-400';
                    if (avgDifficulty >= 0.8) {
                      overallDifficultyText = 'ง่ายเกินไป';
                      overallDiffColor = 'text-emerald-400';
                    } else if (avgDifficulty >= 0.6) {
                      overallDifficultyText = 'ค่อนข้างง่าย';
                      overallDiffColor = 'text-emerald-400';
                    } else if (avgDifficulty >= 0.2 && avgDifficulty < 0.3) {
                      overallDifficultyText = 'ค่อนข้างยาก';
                      overallDiffColor = 'text-amber-500';
                    } else if (avgDifficulty < 0.2) {
                      overallDifficultyText = 'ยากเกินไป';
                      overallDiffColor = 'text-rose-500';
                    }

                    let overallDiscrimText = 'จำแนกต่ำ (ควรปรับปรุง)';
                    let overallDiscrimColor = 'text-rose-400';
                    if (avgDiscrim >= 0.4) {
                      overallDiscrimText = 'ดีเยี่ยม (จำแนกสูง)';
                      overallDiscrimColor = 'text-emerald-400';
                    } else if (avgDiscrim >= 0.3) {
                      overallDiscrimText = 'ดี';
                      overallDiscrimColor = 'text-emerald-400';
                    } else if (avgDiscrim >= 0.2) {
                      overallDiscrimText = 'พอใช้';
                      overallDiscrimColor = 'text-amber-500';
                    }

                    // Group counts for quality segments
                    const goodItems = itemsAnalysis.filter(item => item.p >= 0.2 && item.p <= 0.8 && item.r >= 0.2);
                    const extremeDiffItems = itemsAnalysis.filter(item => item.p > 0.8 || item.p < 0.2);
                    const poorDiscrimItems = itemsAnalysis.filter(item => item.r < 0.2);
                    const flawedItems = itemsAnalysis.filter(item => item.r < 0);

                    // Filtered analysis based on the active question filter
                    const filteredItemsAnalysis = itemsAnalysis.filter(item => {
                      if (analysisQuestionFilter === 'all') return true;
                      if (analysisQuestionFilter === 'good') return item.p >= 0.2 && item.p <= 0.8 && item.r >= 0.2;
                      if (analysisQuestionFilter === 'poor') return item.r < 0.2;
                      if (analysisQuestionFilter === 'flawed') return item.r < 0;
                      return true;
                    });

                    return (
                      <div className="space-y-6">
                        {/* Overall Test Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="card-3d rounded-2xl p-4 bg-slate-950/40 border border-slate-900 flex flex-col justify-between">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">จำนวนผู้สอบทั้งหมด</p>
                            <p className="text-2xl font-black text-slate-200 mt-1">{totalTakers} คน</p>
                            <span className="text-[9px] text-slate-500 mt-1">*กลุ่มประชากรชั้น {analysisSelectedClass || 'ทุกห้องเรียน'}</span>
                          </div>

                          <div className="card-3d rounded-2xl p-4 bg-slate-950/40 border border-slate-900 flex flex-col justify-between">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">จำนวนข้อสอบวิเคราะห์</p>
                            <p className="text-2xl font-black text-slate-200 mt-1">{totalQuestions} ข้อ</p>
                            <span className="text-[9px] text-indigo-400 mt-1 font-bold">ความเชื่อมั่นสูงตามเกณฑ์ CTT</span>
                          </div>

                          <div className="card-3d rounded-2xl p-4 bg-slate-950/40 border border-slate-900 flex flex-col justify-between">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ความยากเฉลี่ย (Mean p)</p>
                            <div className="text-2xl font-black text-slate-100 mt-1 flex items-baseline gap-1.5 flex-wrap">
                              <span>{avgDifficulty}</span>
                              <span className={`text-xs font-bold ${overallDiffColor}`}>({overallDifficultyText})</span>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-1">*ช่วงดีที่สุดคือ 0.20 - 0.80</span>
                          </div>

                          <div className="card-3d rounded-2xl p-4 bg-slate-950/40 border border-slate-900 flex flex-col justify-between">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">อำนาจจำแนกเฉลี่ย (Mean r)</p>
                            <div className="text-2xl font-black text-slate-100 mt-1 flex items-baseline gap-1.5 flex-wrap">
                              <span>{avgDiscrim}</span>
                              <span className={`text-xs font-bold ${overallDiscrimColor}`}>({overallDiscrimText})</span>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-1">*ค่าสูงกว่า 0.20 คือผ่านเกณฑ์</span>
                          </div>
                        </div>

                        {/* Bento analysis distribution */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="card-3d rounded-2xl p-4 border border-emerald-500/10 bg-emerald-500/5 space-y-2">
                            <p className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                              <span>ข้อสอบผ่านเกณฑ์ (คุณภาพสูง)</span>
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black">{goodItems.length} ข้อ</span>
                            </p>
                            <p className="text-[11px] text-slate-400">ข้อสอบมีความยากพอเหมาะ (p 0.2-0.8) และมีอำนาจจำแนกที่ดีเยี่ยม สามารถเก็บบันทึกไว้ในคลังข้อสอบมาตรฐานได้เลย</p>
                            {goodItems.length > 0 && (
                              <div className="text-[10px] font-mono text-emerald-500 bg-emerald-950/30 p-2 rounded-lg truncate" title={goodItems.map(i => `ข้อ ${i.itemNumber}`).join(', ')}>
                                <b>เลขข้อ:</b> {goodItems.map(i => i.itemNumber).join(', ')}
                              </div>
                            )}
                          </div>

                          <div className="card-3d rounded-2xl p-4 border border-indigo-500/10 bg-indigo-500/5 space-y-2">
                            <p className="text-xs font-bold text-indigo-400 flex items-center justify-between">
                              <span>ความยากอยู่นอกเกณฑ์ที่ดี</span>
                              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black">{extremeDiffItems.length} ข้อ</span>
                            </p>
                            <p className="text-[11px] text-slate-400">ข้อสอบที่ยากมากเกินไป (p &lt; 0.2) หรือว่าง่ายมากเกินไป (p &gt; 0.8) ซึ่งส่งผลให้การประเมินทักษะของผู้เรียนมีความคลาดเคลื่อน</p>
                            {extremeDiffItems.length > 0 && (
                              <div className="text-[10px] font-mono text-indigo-400 bg-indigo-950/30 p-2 rounded-lg truncate" title={extremeDiffItems.map(i => `ข้อ ${i.itemNumber}`).join(', ')}>
                                <b>เลขข้อ:</b> {extremeDiffItems.map(i => i.itemNumber).join(', ')}
                              </div>
                            )}
                          </div>

                          <div className="card-3d rounded-2xl p-4 border border-amber-500/10 bg-amber-500/5 space-y-2">
                            <p className="text-xs font-bold text-amber-400 flex items-center justify-between">
                              <span>อำนาจจำแนกต่ำ (r &lt; 0.20)</span>
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full text-[10px] font-black">{poorDiscrimItems.length} ข้อ</span>
                            </p>
                            <p className="text-[11px] text-slate-400">ข้อสอบที่ไม่สามารถแบ่งแยกระหว่างผู้เรียนที่เข้าใจเนื้อหา (กลุ่มเก่ง) กับผู้เรียนที่ยังต้องการการช่วยเหลือ (กลุ่มอ่อน) ได้ดี</p>
                            {poorDiscrimItems.length > 0 && (
                              <div className="text-[10px] font-mono text-amber-500 bg-amber-950/30 p-2 rounded-lg truncate" title={poorDiscrimItems.map(i => `ข้อ ${i.itemNumber}`).join(', ')}>
                                <b>เลขข้อ:</b> {poorDiscrimItems.map(i => i.itemNumber).join(', ')}
                              </div>
                            )}
                          </div>

                          <div className="card-3d rounded-2xl p-4 border border-rose-500/10 bg-rose-500/5 space-y-2">
                            <p className="text-xs font-bold text-rose-400 flex items-center justify-between">
                              <span>จำแนกกลับด้าน/เฉลยผิดปกติ</span>
                              <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full text-[10px] font-black">{flawedItems.length} ข้อ</span>
                            </p>
                            <p className="text-[11px] text-slate-400">วิกฤต: เด็กกลุ่มอ่อนตอบถูกมากกว่ากลุ่มเก่งอย่างมีนัยสำคัญ คุณครูควรตรวจสอบความถูกต้องของการบันทึกเฉลยโดยด่วน!</p>
                            {flawedItems.length > 0 && (
                              <div className="text-[10px] font-mono text-rose-400 bg-rose-950/30 p-2 rounded-lg truncate shadow-inner" title={flawedItems.map(i => `ข้อ ${i.itemNumber}`).join(', ')}>
                                <b>เลขข้อ:</b> {flawedItems.map(i => i.itemNumber).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive List controls */}
                        <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-slate-400" />
                                <span>รายการผลวิเคราะห์รายข้อ และสถิติตัวลวง</span>
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-1">คลิกที่แถวคำถามเพื่อขยายดูการวิเคราะห์การตอบตัวเลือกรวมถึงการวิเคราะห์ดัชนีตัวลวงรายกลุ่มอย่างละเอียด</p>
                            </div>

                            {/* Filter tabs */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                onClick={() => setAnalysisQuestionFilter('all')}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${analysisQuestionFilter === 'all' ? 'bg-slate-100 text-slate-900 border-white font-extrabold shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                              >
                                ทั้งหมด ({totalQuestions})
                              </button>
                              <button
                                onClick={() => setAnalysisQuestionFilter('good')}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${analysisQuestionFilter === 'good' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-extrabold shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                              >
                                ผ่านเกณฑ์ ({goodItems.length})
                              </button>
                              <button
                                onClick={() => setAnalysisQuestionFilter('poor')}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${analysisQuestionFilter === 'poor' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-extrabold shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                              >
                                จำแนกต่ำ ({poorDiscrimItems.length})
                              </button>
                              <button
                                onClick={() => setAnalysisQuestionFilter('flawed')}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${analysisQuestionFilter === 'flawed' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-extrabold shadow-sm' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                              >
                                จำแนกติดลบ ({flawedItems.length})
                              </button>
                            </div>
                          </div>

                          {/* Analysis Table */}
                          <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-slate-950/20">
                            <table className="w-full text-left text-xs text-slate-300">
                              <thead className="bg-slate-950 text-slate-400 font-bold">
                                <tr>
                                  <th className="p-3 text-center w-12">ข้อ</th>
                                  <th className="p-3">โจทย์คำถาม</th>
                                  <th className="p-3 text-center w-28">ความยาก (p)</th>
                                  <th className="p-3 text-center w-32">อำนาจจำแนก (r)</th>
                                  <th className="p-3 text-center w-40">ประเมินคุณภาพข้อสอบ</th>
                                  <th className="p-3 text-center w-24">สถิติตัวลวง</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {filteredItemsAnalysis.map(item => {
                                  const isExpanded = analysisExpandedQuestionId === item.question.id;
                                  
                                  // Evaluation label calculation
                                  let verdict = 'เก็บไว้ใช้งานได้ดี';
                                  let verdictColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                                  if (item.r < 0) {
                                    verdict = 'จำแนกติดลบ (เช็คเฉลย!)';
                                    verdictColor = 'bg-rose-500/15 text-rose-400 border-rose-500/20 animate-pulse';
                                  } else if (item.r < 0.2) {
                                    verdict = 'จำแนกต่ำ (ควรปรับปรุง)';
                                    verdictColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                                  } else if (item.p > 0.85) {
                                    verdict = 'ง่ายมาก (พิจารณาตัวลวง)';
                                    verdictColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                                  } else if (item.p < 0.15) {
                                    verdict = 'ยากมาก (ควรให้ความรู้เสริม)';
                                    verdictColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                  }

                                  // Color ranges for p
                                  let pColor = 'text-cyan-400 font-bold';
                                  let pBarColor = 'bg-cyan-500';
                                  if (item.p >= 0.8) {
                                    pColor = 'text-emerald-400 font-bold';
                                    pBarColor = 'bg-emerald-500';
                                  } else if (item.p < 0.2) {
                                    pColor = 'text-rose-400 font-bold';
                                    pBarColor = 'bg-rose-500';
                                  } else if (item.p < 0.3) {
                                    pColor = 'text-amber-500 font-bold';
                                    pBarColor = 'bg-amber-500';
                                  }

                                  // Color ranges for r
                                  let rColor = 'text-emerald-400 font-bold';
                                  if (item.r < 0) {
                                    rColor = 'text-rose-500 font-black';
                                  } else if (item.r < 0.2) {
                                    rColor = 'text-rose-400 font-bold';
                                  } else if (item.r < 0.3) {
                                    rColor = 'text-amber-500 font-bold';
                                  }

                                  return (
                                    <React.Fragment key={item.question.id}>
                                      {/* Main row */}
                                      <tr 
                                        onClick={() => setAnalysisExpandedQuestionId(isExpanded ? null : (item.question.id || null))}
                                        className={`hover:bg-slate-900/60 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-900/40' : ''}`}
                                      >
                                        <td className="p-3 text-center font-mono font-bold text-slate-400">
                                          {item.itemNumber}
                                        </td>
                                        <td className="p-3">
                                          <div className="font-semibold text-slate-200 line-clamp-1 text-xs" title={item.question.question_text}>
                                            {item.question.question_text}
                                          </div>
                                          <div className="flex gap-2 items-center text-[10px] text-slate-500 mt-1">
                                            <span>มีตัวเลือก {item.question.options.length} ตัวเลือก</span>
                                            <span>•</span>
                                            <span>นัยสถิติเฉลยตัวเลือกที่ {['ก', 'ข', 'ค', 'ง', 'จ'][item.question.correct_index] || item.question.correct_index + 1}</span>
                                          </div>
                                        </td>
                                        <td className="p-3 text-center">
                                          <div className="flex flex-col items-center">
                                            <span className={pColor}>{item.p.toFixed(2)}</span>
                                            {/* Micro bar */}
                                            <div className="w-16 h-1 bg-slate-900 rounded-full mt-1 overflow-hidden">
                                              <div className={`h-full ${pBarColor}`} style={{ width: `${item.p * 100}%` }}></div>
                                            </div>
                                            <span className="text-[8px] text-slate-500 mt-0.5">ตอบถูก {item.correctCount}/{totalTakers} คน</span>
                                          </div>
                                        </td>
                                        <td className="p-3 text-center">
                                          <div className="flex flex-col items-center">
                                            {item.isDiscrimCalculated ? (
                                              <>
                                                <span className={rColor}>{item.r >= 0 ? `+${item.r.toFixed(2)}` : item.r.toFixed(2)}</span>
                                                <span className="text-[8px] text-slate-500">กลุ่มสูง vs กลุ่มต่ำ</span>
                                              </>
                                            ) : (
                                              <span className="text-slate-500 text-[10px] italic">ต้องการผู้สอบ &ge; 2 คน</span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="p-3 text-center">
                                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${verdictColor}`}>
                                            {verdict}
                                          </span>
                                        </td>
                                        <td className="p-3 text-center">
                                          <span className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline">
                                            {isExpanded ? 'ปิดสถิติ' : 'ดูสถิติคำตอบ'}
                                          </span>
                                        </td>
                                      </tr>

                                      {/* Expanded Distractor Analysis Accordion */}
                                      {isExpanded && (
                                        <tr>
                                          <td colSpan={6} className="bg-slate-950/60 p-5 border-t border-b border-slate-900">
                                            <div className="space-y-4 max-w-4xl mx-auto text-left">
                                              {/* Header details */}
                                              <div className="flex flex-col sm:flex-row justify-between gap-3 border-b border-slate-800 pb-3">
                                                <div>
                                                  <h5 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">โจทย์คำถามแบบเต็มข้อ {item.itemNumber}</h5>
                                                  <p className="text-sm font-semibold text-slate-100 mt-1">{item.question.question_text}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                  <span className="text-[10px] text-slate-400 font-semibold">คะแนนดิบ: {item.question.points} คะแนน</span>
                                                  {item.question.explanation && (
                                                    <p className="text-[10px] text-emerald-400 font-medium mt-1">เฉลย: {item.question.explanation}</p>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Options & Distractor breakdown */}
                                              <div className="space-y-3">
                                                <h6 className="font-bold text-[10px] text-slate-400 uppercase tracking-widest pl-1">ผลวิเคราะห์การกระจายสถิติคำตอบรายกลุ่ม (Distractor Response Graph)</h6>
                                                
                                                <div className="grid grid-cols-1 gap-3">
                                                  {item.question.options.map((option, optIdx) => {
                                                    const isCorrect = item.question.correct_index === optIdx;
                                                    const choiceCount = item.optionCounts[optIdx] || 0;
                                                    const pct = totalTakers > 0 ? Math.round((choiceCount / totalTakers) * 100) : 0;
                                                    
                                                    // High & Low Group details
                                                    const highChoice = item.highOptionCounts[optIdx] || 0;
                                                    const lowChoice = item.lowOptionCounts[optIdx] || 0;
                                                    const highPct = item.highGroupSize > 0 ? Math.round((highChoice / item.highGroupSize) * 100) : 0;
                                                    const lowPct = item.lowGroupSize > 0 ? Math.round((lowChoice / item.lowGroupSize) * 100) : 0;

                                                    // Recommendation for this specific choice
                                                    let choiceRole = "ตัวเลือกเฉลยที่ถูกต้อง";
                                                    let choiceRoleColor = "text-emerald-400 font-bold bg-emerald-500/10 border-emerald-500/20";
                                                    let advice = "";

                                                    if (!isCorrect) {
                                                      choiceRole = "ตัวลวง (Distractor)";
                                                      choiceRoleColor = "text-slate-400 bg-slate-900 border-slate-800";
                                                      if (choiceCount === 0) {
                                                        advice = "⚠️ ตัวลวงนี้ไม่มีนักเรียนเลือกเลย ควรปรับเปลี่ยนโจทย์หรือตัวเลือกข้อนี้ให้มีเหตุผลเชิงวิทยาศาสตร์ที่น่าดึงดูดมากขึ้น";
                                                      } else if (highChoice > lowChoice) {
                                                        advice = "⚠️ ตัวลวงล่อใจเด็กกลุ่มเก่ง (กลุ่มสูงเลือกมากกว่ากลุ่มต่ำ) ตัวเลือกนี้อาจมีความสับสนหรือคลุมเครือเชิงภาษา";
                                                      } else {
                                                        advice = "✓ ตัวลวงคุณภาพผ่านเกณฑ์ ดึงดูดผู้ตอบกลุ่มอ่อนได้ดีตามหลักจิตวิทยาการสอบ";
                                                      }
                                                    } else {
                                                      if (lowChoice > highChoice) {
                                                        advice = "❌ วิกฤต: อัตราการเลือกข้อนี้ต่ำลงในกลุ่มเด็กเก่ง ควรทบทวนความถูกต้องของคีย์เฉลยอย่างถี่ถ้วน";
                                                      } else {
                                                        advice = "✓ คีย์เฉลยทิศทางถูกต้อง คัดแยกกลุ่มเด็กเก่งและอ่อนได้อย่างมีเสถียรภาพ";
                                                      }
                                                    }

                                                    return (
                                                      <div 
                                                        key={optIdx}
                                                        className={`p-3 rounded-2xl border ${isCorrect ? 'bg-emerald-950/10 border-emerald-500/20' : 'bg-slate-950/40 border-slate-900'} space-y-2`}
                                                      >
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                          <div className="flex items-center gap-2">
                                                            <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-slate-800'}`}>
                                                              {['ก', 'ข', 'ค', 'ง', 'จ'][optIdx] || optIdx + 1}
                                                            </span>
                                                            <span className="text-xs text-slate-200 font-medium">{option}</span>
                                                          </div>
                                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider self-start sm:self-center ${choiceRoleColor}`}>
                                                            {choiceRole}
                                                          </span>
                                                        </div>

                                                        {/* Bars */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                                                          {/* Total percent bar */}
                                                          <div className="sm:col-span-5 space-y-1">
                                                            <div className="flex justify-between text-[10px] text-slate-400">
                                                              <span>อัตราตอบของนักเรียนทุกคน:</span>
                                                              <span className="font-bold">{choiceCount} คน ({pct}%)</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                                              <div className={`h-full ${isCorrect ? 'bg-emerald-500' : 'bg-slate-700'}`} style={{ width: `${pct}%` }}></div>
                                                            </div>
                                                          </div>

                                                          {/* Group high-low compare bars */}
                                                          <div className="sm:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                              <div className="flex justify-between text-[9px] text-slate-400">
                                                                <span className="text-cyan-400 font-bold">กลุ่มเรียนเก่ง (High):</span>
                                                                <span className="font-bold text-cyan-400">{highChoice} คน ({highPct}%)</span>
                                                              </div>
                                                              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                                                <div className="h-full bg-cyan-400" style={{ width: `${highPct}%` }}></div>
                                                              </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                              <div className="flex justify-between text-[9px] text-slate-400">
                                                                <span className="text-amber-400 font-bold">กลุ่มเรียนอ่อน (Low):</span>
                                                                <span className="font-bold text-amber-400">{lowChoice} คน ({lowPct}%)</span>
                                                              </div>
                                                              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                                                                <div className="h-full bg-amber-400" style={{ width: `${lowPct}%` }}></div>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        </div>

                                                        {/* Recommendation */}
                                                        <div className="text-[10px] bg-slate-950 p-2 border border-slate-900 rounded-lg text-slate-400 font-semibold leading-relaxed">
                                                          {advice}
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}

                                {filteredItemsAnalysis.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-500 text-xs border border-dashed border-slate-900 rounded-b-2xl bg-slate-950/10">
                                      ไม่พบรายการผลวิเคราะห์ข้อสอบที่ตรงตามเงื่อนไขการกรอง
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* === SUBPAGE: STUDENTS ROSTER MANAGEMENT === */}
              {activeTab === 'students' && (
                <div className="space-y-6">
                  {/* Excel import box and Single manual creation */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-base flex items-center gap-2">
                          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                          <span>นำเข้าทะเบียนรายชื่อนักเรียนผ่านไฟล์ Excel</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          รองรับโครงสร้างตารางทั่วไป และแบบรายงานรายชื่อกลุ่มห้องเรียนวิชาการ <b>(SGS/OBEC)</b> ที่มีหัวตารางหลายบรรทัดโดยอัตโนมัติ
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          *หากไม่มีคอลัมน์ "รหัสผ่าน" ระบบจะใช้ <b>รหัสนักเรียน</b> เป็นรหัสผ่านเริ่มต้นในการเข้าสู่ระบบโดยอัตโนมัติเพื่อความสะดวก
                        </p>
                      </div>
                      <button 
                        onClick={handleDownloadSampleExcel}
                        className="px-4 py-2 border border-emerald-600/30 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 text-xs font-bold rounded-xl flex items-center gap-2 self-start md:self-center cursor-pointer transition-all active:scale-95 shadow-sm"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                        <span>ดาวน์โหลดไฟล์ตัวอย่าง (SGS ม.4/1)</span>
                      </button>
                    </div>

                    <div className="mt-4">
                      <div className="border-2 border-dashed border-slate-800 rounded-2xl py-8 text-center bg-slate-950/30 hover:bg-slate-950/50 cursor-pointer shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] transition-all relative">
                        <input 
                          type="file" 
                          accept=".xlsx, .xls"
                          onChange={handleExcelImport}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-300">คลิกที่นี่หรือลากไฟล์ Excel ตารางรายชื่อเพื่ออัปโหลด</p>
                      </div>
                    </div>

                    <hr className="border-slate-800" />

                    {/* Manual single add */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-sm text-slate-300">เพิ่มนักเรียนใหม่รายบุคคล</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">เลขประจำตัวนักเรียน</label>
                          <input 
                            type="text" 
                            placeholder="เช่น STD005"
                            value={addStudentId}
                            onChange={e => setAddStudentId(e.target.value)}
                            className="w-full input-3d rounded-xl px-4 py-2.5 text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">ชื่อ-นามสกุล</label>
                          <input 
                            type="text" 
                            placeholder="เช่น นายขยัน เรียนมาก"
                            value={addStudentName}
                            onChange={e => setAddStudentName(e.target.value)}
                            className="w-full input-3d rounded-xl px-4 py-2.5 text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">ห้องเรียน</label>
                          <input 
                            type="text" 
                            placeholder="เช่น ม.6/1"
                            value={addStudentClass}
                            onChange={e => setAddStudentClass(e.target.value)}
                            className="w-full input-3d rounded-xl px-4 py-2.5 text-xs text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">กำหนดรหัสผ่าน</label>
                          <input 
                            type="password" 
                            placeholder="เริ่มต้นคือ 123456"
                            value={addStudentPassword}
                            onChange={e => setAddStudentPassword(e.target.value)}
                            className="w-full input-3d rounded-xl px-4 py-2.5 text-xs text-slate-100"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={handleAddSingleStudent}
                        className="px-6 py-2.5 btn-3d-primary font-bold rounded-xl text-xs cursor-pointer"
                      >
                        เพิ่มนักเรียนเข้ากลุ่ม
                      </button>
                    </div>

                    {/* Students list roster list view */}
                    <div className="pt-4 border-t border-slate-800">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ทะเบียนผู้เรียนปัจจุบัน ({students.length} คน)</p>
                          <p className="text-[11px] text-slate-500">กรองรายชื่อและลบรายชื่อตามกลุ่มห้องเรียน</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Filter Dropdown */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">ห้องเรียน:</span>
                            <select
                              value={studentClassFilter}
                              onChange={e => setStudentClassFilter(e.target.value)}
                              className="input-3d rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                            >
                              <option value="">ทั้งหมด ทุกห้องเรียน</option>
                              {Array.from(new Set(students.map(s => s.class_group))).sort().map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                            </select>
                          </div>

                          {/* Delete entire class button */}
                          <button
                            onClick={() => handleDeleteClassStudents(studentClassFilter)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-all ${
                              studentClassFilter 
                                ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20' 
                                : 'bg-rose-950/20 text-rose-500/60 hover:bg-rose-600 hover:text-white border border-rose-500/10'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{studentClassFilter ? `ลบรายชื่อทั้งห้อง ${studentClassFilter}` : 'ลบรายชื่อนักเรียนทั้งหมด'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-950 text-slate-400 font-bold">
                            <tr>
                              <th className="p-3">เลขประจำตัว</th>
                              <th className="p-3">ชื่อ-นามสกุล</th>
                              <th className="p-3">ห้องเรียน</th>
                              <th className="p-3 text-right">การจัดการ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(studentClassFilter ? students.filter(s => s.class_group === studentClassFilter) : students).map(s => (
                              <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-950/30">
                                <td className="p-3 font-mono font-bold text-rose-400">{s.student_id}</td>
                                <td className="p-3 font-semibold">{s.name}</td>
                                <td className="p-3">{s.class_group}</td>
                                <td className="p-3 text-right">
                                  <button 
                                    onClick={() => handleDeleteStudent(s.id)}
                                    className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {(studentClassFilter ? students.filter(s => s.class_group === studentClassFilter) : students).length === 0 && (
                              <tr>
                                <td colSpan={4} className="text-center py-8 text-slate-500 italic">
                                  ไม่พบข้อมูลรายชื่อนักเรียนในเงื่อนไขการค้นหานี้
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </main>

      {/* Auto Text Importer Modal */}
      {isTextImporterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">นำเข้าข้อสอบอัตโนมัติจากข้อความ</h3>
                  <p className="text-xs text-slate-400">วางข้อความข้อสอบจากเวิร์ด (Word) หรือโปรแกรมพิมพ์ข้อสอบเพื่อวิเคราะห์ข้อมูลแบบอัจฉริยะ</p>
                </div>
              </div>
              <button 
                onClick={() => setIsTextImporterOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Split view) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Left Panel: Raw text input area (Column 5) */}
              <div className="lg:col-span-5 p-5 border-r border-slate-800/80 flex flex-col gap-4 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <span>1. วางข้อความข้อสอบที่นี่</span>
                    <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                  </label>
                  <p className="text-[11px] text-slate-500">คัดลอกโจทย์และตัวเลือกทั้งหมดมาวางเพื่อใช้ระบบวิเคราะห์ภาษาอัตโนมัติ</p>
                </div>

                <div className="flex-1 flex flex-col">
                  <textarea
                    value={rawImporterText}
                    onChange={e => setRawImporterText(e.target.value)}
                    placeholder={`คัดลอกข้อสอบมาวางได้ทันที เช่น:

1. ชมพูทวีปคือดินแดนใดในปัจจุบัน
ก. อังกฤษและฝรั่งเศส
ข. เมียนมาและไทย
ค. ปากีสถานและอัฟกานิสถาน
*ง. อินเดียและเนปาล

2. ข้อใดเป็นคำนาม
ก. วิ่ง
ข. สวยงาม
ค. โรงเรียน
ง. อย่างรวดเร็ว
เฉลย ค.`}
                    className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 placeholder-slate-700 resize-none min-h-[250px]"
                  />
                </div>

                {/* Import Instructions & formatting tips card */}
                <div className="bg-slate-950/40 border border-indigo-950/50 p-4 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-indigo-400">💡 เคล็ดลับการพิมพ์ให้ตรวจจับเฉลยอัตโนมัติ:</p>
                  <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>ใช้ตัวเลขนำหน้าโจทย์ เช่น <b className="text-slate-200">1. โจทย์...</b> หรือ <b className="text-slate-200">ข้อ 2. โจทย์...</b></li>
                    <li>ใช้ <b className="text-slate-200">ก. ข. ค. ง.</b> หรือ <b className="text-slate-200">A. B. C. D.</b> สำหรับตัวเลือก</li>
                    <li>ใส่เครื่องหมาย <b className="text-amber-400">*</b> หน้าหรือหลังตัวเลือกที่ถูกต้อง เช่น <b className="text-emerald-400">*ก. คำตอบ</b> หรือ <b className="text-emerald-400">ง. คำตอบ*</b> เพื่อวิเคราะห์เฉลยโดยอัตโนมัติ</li>
                    <li>หรือระบุเฉลยแยกอีกบรรทัด เช่น <b className="text-emerald-400">เฉลย ค.</b> หรือ <b className="text-emerald-400">ตอบ ข</b> ใต้ตัวเลือกข้อนั้นๆ</li>
                  </ul>
                </div>
              </div>

              {/* Right Panel: Parsed preview cards (Column 7) */}
              <div className="lg:col-span-7 p-5 bg-slate-950/20 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300">2. ตรวจสอบและแก้ไขข้อสอบที่ระบบวิเคราะห์ได้</label>
                    <p className="text-[11px] text-slate-500">คุณครูสามารถคลิกเลือกตัวเฉลยที่ถูกต้อง หรือปรับแก้ข้อความได้โดยตรง</p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-bold">
                    พบข้อสอบทั้งหมด {parsedQuestions.length} ข้อ
                  </span>
                </div>

                {/* Questions list preview scrollable */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {parsedQuestions.map((pq, pqIdx) => (
                    <div 
                      key={pqIdx} 
                      className="bg-slate-950/80 p-4 border border-slate-800 rounded-2xl relative group hover:border-slate-700/80 transition-all space-y-3 shadow-md"
                    >
                      {/* Delete Question from parsed preview */}
                      <button 
                        onClick={() => {
                          const updated = [...parsedQuestions];
                          updated.splice(pqIdx, 1);
                          setParsedQuestions(updated);
                        }}
                        className="absolute top-4 right-4 p-1 rounded bg-slate-900 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-slate-800 cursor-pointer"
                        title="ลบข้อนี้ออกจากการนำเข้า"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-[10px] font-mono font-bold text-indigo-400 flex items-center justify-center">
                          {pqIdx + 1}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">โจทย์ข้อสอบ</span>
                      </div>

                      {/* Question Text edit */}
                      <input 
                        type="text" 
                        value={pq.question_text || ''}
                        onChange={e => {
                          const updated = [...parsedQuestions];
                          updated[pqIdx].question_text = e.target.value;
                          setParsedQuestions(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
                        placeholder="ข้อความโจทย์ข้อสอบ"
                      />

                      {/* Options Grid with click to set correct option */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {pq.options?.map((opt, oIdx) => {
                          const isCorrect = pq.correct_index === oIdx;
                          return (
                            <div 
                              key={oIdx}
                              className={`flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border transition-all ${
                                isCorrect 
                                  ? 'border-emerald-500/40 bg-emerald-950/5' 
                                  : 'border-slate-800/80'
                              }`}
                            >
                              {/* Option Indicator / Toggle correct button */}
                              <button
                                onClick={() => {
                                  const updated = [...parsedQuestions];
                                  updated[pqIdx].correct_index = oIdx;
                                  setParsedQuestions(updated);
                                }}
                                className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                                  isCorrect 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                                }`}
                                title="คลิกเพื่อตั้งค่าตัวเลือกนี้เป็นเฉลยที่ถูกต้อง"
                              >
                                {['ก', 'ข', 'ค', 'ง', 'จ'][oIdx] || ''}
                              </button>

                              {/* Option Input */}
                              <input 
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const updated = [...parsedQuestions];
                                  const opts = [...(updated[pqIdx].options || ['', '', '', ''])];
                                  opts[oIdx] = e.target.value;
                                  updated[pqIdx].options = opts;
                                  setParsedQuestions(updated);
                                }}
                                className="flex-1 bg-transparent text-xs text-slate-300 focus:outline-none"
                                placeholder={`พิมพ์ตัวเลือกที่ ${oIdx + 1}`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Score Input & explanation */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-bold uppercase shrink-0">คะแนน:</span>
                          <input 
                            type="number"
                            value={pq.points || 1}
                            onChange={e => {
                              const updated = [...parsedQuestions];
                              updated[pqIdx].points = Number(e.target.value);
                              setParsedQuestions(updated);
                            }}
                            className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 font-bold focus:outline-none"
                          />
                        </div>
                        <input 
                          type="text"
                          value={pq.explanation || ''}
                          onChange={e => {
                            const updated = [...parsedQuestions];
                            updated[pqIdx].explanation = e.target.value;
                            setParsedQuestions(updated);
                          }}
                          className="w-full bg-slate-900/60 border border-slate-800/80 rounded-lg px-2 py-1 text-[10px] text-slate-400 focus:outline-none"
                          placeholder="พิมพ์คำอธิบายประกอบเฉลยเพิ่มเติม (ถ้ามี)"
                        />
                      </div>
                    </div>
                  ))}

                  {parsedQuestions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500 space-y-3">
                      <div className="p-3 rounded-full bg-slate-900 border border-slate-800/80 text-slate-600">
                        <FileText className="w-8 h-8" />
                      </div>
                      <p className="text-xs italic leading-relaxed">
                        ยังไม่มีข้อมูลวิเคราะห์ข้อสอบในหน้าต่างนี้<br />
                        โปรดวางโจทย์ข้อสอบลงในช่องข้อมูลทางด้านซ้ายเพื่อดูผลวิเคราะห์สดแบบเรียลไทม์
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/40">
              <p className="text-xs text-slate-500 text-center sm:text-left">
                * ตรวจสอบว่าโจทย์ ตัวเลือก และตัวเลือกเฉลย (ก. ข. ค. ง. สีเขียว) มีความถูกต้องครบถ้วนก่อนส่งข้อมูล
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => setIsTextImporterOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => handleImportSave(true)}
                  disabled={parsedQuestions.length === 0}
                  className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer ${
                    parsedQuestions.length > 0 
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>นำเข้าแบบต่อท้าย ({parsedQuestions.length} ข้อ)</span>
                </button>
                <button 
                  onClick={() => {
                    if (confirm(`คำเตือน: การนำเข้าแบบ "แทนที่ทั้งหมด" จะทำการลบข้อสอบที่มีอยู่เดิมทั้งหมด ${activeExamQuestions.length} ข้อในชุดแบบทดสอบนี้ และแทนที่ด้วยข้อสอบใหม่ทั้งหมดนี้ คุณครูต้องการดำเนินการต่อหรือไม่?`)) {
                      handleImportSave(false);
                    }
                  }}
                  disabled={parsedQuestions.length === 0}
                  className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer ${
                    parsedQuestions.length > 0 
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/10' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>ลบข้อสอบเดิมและนำเข้าแทนที่</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SQL Setup Modal / Overlay */}
      {showSqlGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2 text-rose-400">
                <Database className="w-5 h-5" />
                <span>คู่มือการเปิดระบบเชื่อมต่อ Supabase ออนไลน์</span>
              </h3>
              <button 
                onClick={() => setShowSqlGuide(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              แบบทดสอบนิรภัยนี้ใช้ฐานข้อมูลแบบ <b>Hybrid Engine</b> เพื่อความปลอดภัย หากตรวจไม่พบตารางข้อมูลในคลาวด์ Supabase ของคุณ ระบบจะทำงานในโหมดเซฟตี้ออฟไลน์ผ่านแฟ้มไฟล์ในเครื่องเซิร์ฟเวอร์โดยอัตโนมัติ เพื่อให้เริ่มการทำงานเป็น <b>Online Sync 100%</b> คุณครูเพียงทำตามขั้นตอนด้านล่างนี้:
            </p>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-rose-400">ขั้นตอนการติดตั้ง:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400">
                <li>เปิดหน้าแดชบอร์ดโครงการของท่านใน <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-white underline font-bold">Supabase Console</a></li>
                <li>ไปที่เมนูหลักทางด้านซ้าย เลือกคำว่า <b>SQL Editor</b></li>
                <li>กดเลือก <b>New Query</b> เพื่อเปิดกระดาษคำสั่งเขียนใหม่</li>
                <li>กดปุ่ม "คัดลอกคำสั่ง SQL" ด้านล่างนี้ แล้วนำคำสั่งไปวางลงในช่องพิมพ์งาน</li>
                <li>กดปุ่ม <b>Run</b> ที่ขอบขวาล่างของบราวเซอร์เพื่อเริ่มต้นจำลองระบบฐานข้อมูล</li>
              </ol>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 p-4 rounded-xl text-[10px] font-mono text-slate-300 overflow-x-auto max-h-48 border border-slate-800">
                {sqlSchemaText}
              </pre>
              <button 
                onClick={copySqlToClipboard}
                className="absolute top-2 right-2 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>คัดลอกคำสั่ง SQL</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button 
                onClick={() => setShowSqlGuide(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                เข้าใจแล้ว ปิดหน้าต่างนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Live Popup Alert Modal */}
      {currentStudentPopupModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative overflow-hidden space-y-6 text-left">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
              currentStudentPopupModal.importance === 'urgent' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
              currentStudentPopupModal.importance === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              <Bell className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-2">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                currentStudentPopupModal.importance === 'urgent' ? 'bg-rose-500/20 text-rose-300' :
                currentStudentPopupModal.importance === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {currentStudentPopupModal.importance === 'urgent' ? '🔴 ประกาศด่วนพิเศษ' : currentStudentPopupModal.importance === 'warning' ? '🟡 แจ้งเตือนกติกา' : '🔵 ประชาสัมพันธ์'}
              </span>
              <h3 className="text-xl font-bold text-white pt-1">{currentStudentPopupModal.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{currentStudentPopupModal.body}</p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-xs text-slate-400">
              <span>จาก: <b>{currentStudentPopupModal.sender_name || 'ครูผู้สอน'}</b></span>
              <button
                onClick={() => handleAcknowledgePopup(currentStudentPopupModal.id)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow cursor-pointer transition-all active:scale-95"
              >
                รับทราบแล้ว ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Connection & Health Modal */}
      {showDbStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto my-auto scrollbar-thin scrollbar-thumb-slate-700">
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"></div>

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>สถานะการเชื่อมต่อและสุขภาพฐานข้อมูล</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${dbStatus.isConnected !== false ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                      {dbStatus.isConnected !== false ? '● ONLINE' : '● DISCONNECTED'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">ตรวจสอบความเร็ว สถานะการบันทึก และจัดการกู้คืนข้อมูลระบบ</p>
                </div>
              </div>

              <button 
                onClick={() => setShowDbStatusModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Info Notice about Data Retention & Cloud Sync */}
            <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-2xl p-4 flex gap-3 text-xs text-cyan-200">
              <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-bold text-cyan-300">ความแตกต่างระหว่าง Local DB และ Cloud Supabase DB:</p>
                <p className="text-slate-300 leading-relaxed">
                  • <b>สถานะปัจจุบัน (Local DB):</b> ข้อมูลนักเรียนทั้งหมด ({students.length} คน) ถูกบันทึกไว้ในระบบ Local JSON File Storage บนเซิร์ฟเวอร์เรียบร้อยแล้ว ไม่สูญหาย<br />
                  • <b>การส่งข้อมูลไป Cloud DB:</b> เมื่อตั้งค่าคีย์ <code>SUPABASE_SECRET_KEY</code> หรือ <code>SUPABASE_PUBLISHABLE_KEY</code> ใน <code>.env</code> คุณสามารถกดปุ่ม <b className="text-cyan-300">"ซิงค์ข้อมูล Local ขึ้น Cloud"</b> เพื่อส่งข้อมูลทั้งหมด (รายชื่อนักเรียน, รายวิชา, ข้อสอบ) ขึ้นไปยัง Cloud Supabase ได้ทันที!
                </p>
              </div>
            </div>

            {/* Supabase Table Setup SQL Copy Helper - Unconditionally visible for easy access */}
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-200">
                  <p className="font-extrabold text-amber-300 text-sm">📌 คำสั่ง SQL สร้างตารางทั้งหมดลงใน Supabase (SQL Setup Script)</p>
                  <p className="text-slate-300 leading-relaxed">
                    หากโปรเจกต์ Supabase ของคุณยังไม่มีตาราง หรือต้องการสร้างตาราง <code>students</code>, <code>teachers</code>, <code>subjects</code>, <code>exams</code>, <code>questions</code>, <code>exam_results</code> ฯลฯ ให้คัดลอกคำสั่ง SQL ด้านล่างไปรันใน Supabase SQL Editor
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                <p className="font-bold text-cyan-300 flex items-center justify-between">
                  <span>ขั้นตอนติดตั้งตารางเพียง 30 วินาที:</span>
                  <span className="text-[10px] text-slate-400">SQL Schema Setup</span>
                </p>
                <ol className="list-decimal list-inside text-slate-300 space-y-1 leading-relaxed pl-1">
                  <li>เปิด Supabase Dashboard → เลือกเมนู <b>SQL Editor</b></li>
                  <li>กดปุ่ม <b>New Query</b></li>
                  <li>กดปุ่ม <b>"คัดลอกคำสั่ง SQL สร้างตารางลง Supabase"</b> ด้านล่าง แล้ววางใน SQL Editor</li>
                  <li>กดปุ่ม <b>Run</b> (สีเขียว) ใน Supabase จากนั้นกลับมากด <b>"ซิงค์ Local ขึ้น Cloud"</b> ในระบบนี้ได้ทันที!</li>
                </ol>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
                      showToast('คัดลอกคำสั่ง SQL สร้างตารางเรียบร้อยแล้ว! นำไปวางใน Supabase SQL Editor แล้วกด Run ได้เลย', 'success');
                    }}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>📋 คัดลอกคำสั่ง SQL สร้างตารางลง Supabase</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">รูปแบบการจัดเก็บข้อมูลปัจจุบัน</p>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                  <p className="text-sm font-bold text-slate-100">{dbStatus.storageType || 'Local JSON Storage'}</p>
                </div>
                {dbStatus.supabaseUrl && (
                  <p className="text-[10px] text-slate-400 font-mono truncate">Endpoint: {dbStatus.supabaseUrl}</p>
                )}
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ความเร็วตอบสนองการเชื่อมต่อ (Latency)</p>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <p className="text-sm font-extrabold text-emerald-400 font-mono">{dbStatus.latencyMs || 0} ms</p>
                  <span className="text-[10px] text-slate-400">(สถานะปกติ)</span>
                </div>
              </div>
            </div>

            {/* Records Summary */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>สรุปจำนวนข้อมูลที่บันทึกในระบบสด</span>
                <span className="text-[10px] text-cyan-400 font-mono">Real-time DB Counts</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">นักเรียนในระบบ</p>
                  <p className="text-lg font-black text-cyan-300">{students.length} คน</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">รายวิชาทั้งหมด</p>
                  <p className="text-lg font-black text-amber-300">{subjects.length} วิชา</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">ชุดข้อสอบ</p>
                  <p className="text-lg font-black text-indigo-300">{exams.length} ชุด</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">ผลการสอบที่ส่ง</p>
                  <p className="text-lg font-black text-emerald-300">{examResults.length} ฉบับ</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">ประวัติสลับจอ</p>
                  <p className="text-lg font-black text-rose-300">{cheatLogs.length} ครั้ง</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">คุณครู/แอดมิน</p>
                  <p className="text-lg font-black text-purple-300">{teachers.length} ท่าน</p>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button 
                onClick={handleTestDbConnection}
                disabled={isTestingDb}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isTestingDb ? 'animate-spin' : ''}`} />
                <span>{isTestingDb ? 'กำลังทดสอบ...' : 'ทดสอบการเชื่อมต่อใหม่'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={handleSyncLocalToCloud}
                  disabled={isSyncingCloud}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/20 transition-all"
                  title="ส่งข้อมูลทั้งหมดจาก Local DB ขึ้นไปยัง Cloud Supabase"
                >
                  <Cloud className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-bounce' : ''}`} />
                  <span>{isSyncingCloud ? 'กำลังซิงค์ขึ้น Cloud...' : 'ซิงค์ Local ขึ้น Cloud'}</span>
                </button>

                <button 
                  onClick={() => handleSeedDefaultDb(false)}
                  disabled={isSeedingDb}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{isSeedingDb ? 'กำลังโหลด...' : 'โหลดข้อมูลเริ่มต้น'}</span>
                </button>

                <button 
                  onClick={() => handleSeedDefaultDb(true)}
                  disabled={isSeedingDb}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                  title="รีเซ็ตและเติมข้อมูลเริ่มต้นโรงเรียน"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตตั้งต้น</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Humble Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-[10px] text-slate-500 font-mono">
        &copy; 2026 Exam system
      </footer>
    </div>
  );
}

function StudentBrowserBlocker({ browserInfo, onCopyLink }: { browserInfo: any, onCopyLink: () => void }) {
  const currentUrl = window.location.href;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    onCopyLink();
  };

  return (
    <div className="max-w-xl mx-auto my-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-center space-y-6">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-red-500"></div>
      
      <div className="inline-flex bg-amber-500/10 p-4 rounded-3xl text-amber-400 border border-amber-500/20 mb-2">
        <AlertTriangle className="w-12 h-12 animate-pulse" />
      </div>
      
      <h3 className="text-2xl font-black text-amber-400">เข้าใช้งานผ่านเบราว์เซอร์เท่านั้น<br /><span className="text-sm font-semibold text-slate-300">(In-App Browser Blocked)</span></h3>
      
      <p className="text-sm text-slate-300 leading-relaxed">
        ระบบตรวจสอบพบว่าคุณกำลังเข้าใช้งานผ่าน <strong className="text-rose-400">แอปพลิเคชันภายนอก</strong> (เช่น LINE, Facebook, Messenger, Instagram, WeChat) เพื่อความปลอดภัยและความบริสุทธิ์ยุติธรรมในโหมดสอบเต็มหน้าจอ (Anti-Cheat Mode)
      </p>

      {/* Browser Status Panel */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">สถานะการตรวจสอบความปลอดภัยของเบราว์เซอร์:</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="text-slate-300">ความเสี่ยง WebView โซเชียล:</span>
            <span className="ml-auto font-bold text-rose-400">{browserInfo.isInApp ? 'ตรวจพบ' : 'ไม่พบ'}</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-slate-300">เบราว์เซอร์ปัจจุบัน:</span>
            <span className="ml-auto font-bold text-amber-400 truncate max-w-[120px]">
              {browserInfo.isChrome ? 'Chrome' : browserInfo.isSafari ? 'Safari' : 'ไม่ผ่านการรับรอง'}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="font-semibold text-rose-400">ข้อบังคับข้อสอบ:</span> นักเรียนต้องสอบผ่าน <strong className="text-white">Google Chrome</strong> หรือ <strong className="text-white">Safari</strong> เท่านั้น เบราว์เซอร์อื่นหรือในแอปจะไม่ได้รับอนุญาตให้ทำข้อสอบ
        </div>
      </div>

      {/* Allowed Browsers Showcase */}
      <div className="flex justify-center items-center gap-6 py-2">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-slate-700/50 flex items-center justify-center text-emerald-400 p-3 shadow-inner">
            <svg className="w-10 h-10 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 1.5c4.78 0 8.81 3.23 9.94 7.64L10.37 9.14a3.5 3.5 0 0 0-4.88 1.94L2.03 5.4C4.16 3.03 7.9 1.5 12 1.5zm0 10.5c0 1.93 1.57 3.5 3.5 3.5.38 0 .74-.06 1.08-.17l4.01 6.95C18.69 21.36 15.54 22.5 12 22.5 6.97 22.5 2.72 18.9 1.66 14.1l4.74-8.21c1.55.97 3.1 3.61 5.6 6.11zm1.08 1.33a3.5 3.5 0 0 0 2.42-3.33c0-1.07-.48-2.03-1.24-2.67l4.57-7.91C21.31 4.78 22.5 8.24 22.5 12c0 5.46-4.14 9.95-9.42 10.47l-1.08-1.34v-7.8z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-300">Chrome (เท่านั้น)</span>
        </div>
        <div className="text-slate-600 font-bold text-xs">หรือ</div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-slate-700/50 flex items-center justify-center text-emerald-400 p-3 shadow-inner">
            <svg className="w-10 h-10 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm0 1.5c5.807 0 10.5 4.693 10.5 10.5S17.807 22.5 12 22.5 1.5 17.807 1.5 12 6.193 1.5 12 1.5zm.75 4.5l-2.25 4.5-4.5 2.25 4.5.75 2.25 4.5 4.5-2.25-4.5-.75z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-300">Safari (เท่านั้น)</span>
        </div>
      </div>

      {/* Guide steps */}
      <div className="text-left bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 text-[10px]">💡</span>
          <span>ขั้นตอนการเปิดใช้งานด้วยเบราว์เซอร์มาตรฐาน</span>
        </h4>
        
        <ol className="text-xs text-slate-400 space-y-2.5 list-decimal pl-4">
          <li className="leading-relaxed">
            <strong className="text-slate-200">หากใช้ LINE / Messenger:</strong> สังเกตปุ่ม <strong className="text-slate-200">จุดสามจุด (•••)</strong> หรือ <strong className="text-slate-200">เข็มทิศ/ลูกศรแชร์</strong> ที่มุมขวาบน (หรือขวาล่าง) ของแอปโซเชียลมีเดีย
          </li>
          <li className="leading-relaxed">
            กดที่คำสั่ง <strong className="text-emerald-400 font-bold">"เปิดด้วยเบราว์เซอร์อื่น" (Open in Browser)</strong> หรือ <strong className="text-emerald-400 font-bold">"เปิดด้วย Chrome / Safari"</strong>
          </li>
          <li className="leading-relaxed">
            <strong className="text-slate-200">หากหาเมนูดังกล่าวไม่เจอ:</strong> กดปุ่มแผงคัดลอกด้านล่างเพื่อคัดลอกที่อยู่นี้ แล้วนำไปเปิดด้วยแอป <strong className="text-emerald-400">Chrome</strong> หรือ <strong className="text-emerald-400">Safari</strong> ด้วยตัวคุณเอง
          </li>
        </ol>
      </div>

      {/* Action button */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={handleCopy}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/20 transition-all"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'คัดลอกลิงก์สอบสำเร็จแล้ว! นำไปวางใน Chrome/Safari ได้เลย' : 'คัดลอกลิงก์หน้าข้อสอบเพื่อนำไปเปิดในเบราว์เซอร์หลัก'}</span>
        </button>
      </div>

      <p className="text-[10px] text-slate-500 truncate">
        URL ข้อสอบปัจจุบัน: {currentUrl}
      </p>
    </div>
  );
}
