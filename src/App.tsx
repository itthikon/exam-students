import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, User, Lock, BookOpen, Sparkles, AlertTriangle, CheckCircle2, 
  XCircle, Plus, Trash2, Upload, FileText, FileSpreadsheet, BarChart3, 
  Database, Copy, Check, RotateCcw, RefreshCw, Sliders, LogOut, 
  Clock, Settings, Search, Filter, Users, Menu, Maximize, Minimize, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

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
  const [activeTab, setActiveTab] = useState<'students' | 'subjects' | 'exams' | 'stats'>('stats');
  const [dbStatus, setDbStatus] = useState({ useSupabase: false });

  // DB Data States
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [cheatLogs, setCheatLogs] = useState<CheatLog[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

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
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [finishedResult, setFinishedResult] = useState<ExamResult | null>(null);
  const [examStartTime, setExamStartTime] = useState<string>('');

  // Notifications & Copy Banner
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [showSqlGuide, setShowSqlGuide] = useState(false);

  // Manual Add Student State
  const [addStudentId, setAddStudentId] = useState('');
  const [addStudentName, setAddStudentName] = useState('');
  const [addStudentPassword, setAddStudentPassword] = useState('123456');
  const [addStudentClass, setAddStudentClass] = useState('ม.6/1');
  const [studentClassFilter, setStudentClassFilter] = useState('');

  // Trigger Notification
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch initial system states
  const refreshData = async () => {
    try {
      const dbRes = await fetch('/api/db-status');
      const dbData = await dbRes.json();
      setDbStatus(dbData);

      const [subRes, exRes, stuRes, resRes, cheatRes, tRes] = await Promise.all([
        fetch('/api/subjects'),
        fetch('/api/exams'),
        fetch('/api/students'),
        fetch('/api/exam-results'),
        fetch('/api/cheat-logs'),
        fetch('/api/teachers')
      ]);

      setSubjects(await subRes.json());
      setExams(await exRes.json());
      setStudents(await stuRes.json());
      setExamResults(await resRes.json());
      setCheatLogs(await cheatRes.json());
      setTeachers(await tRes.json());
    } catch (e) {
      showToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์หลักได้', 'error');
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      // Poll real-time cheat logs and scores for teachers
      if (userRole === 'teacher' || userRole === 'admin') {
        fetch('/api/cheat-logs').then(r => r.json()).then(setCheatLogs);
        fetch('/api/exam-results').then(r => r.json()).then(setExamResults);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [userRole]);

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
        randomize: newExamRandom
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
          showToast(`นำเข้ารายชื่อนักเรียนสำเร็จทั้งหมด ${parsedStudents.length} คน (ห้องเรียนเริ่มต้น: ${defaultClassGroup})`);
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
    setExamStartTime(new Date().toISOString());
    setExamState('taking');

    // Enable safety locks & request Fullscreen
    requestFullscreen();
    setIsFullscreen(true);
  };

  // Listeners for Fraud Detection
  useEffect(() => {
    if (examState !== 'taking' || !selectedExam) return;

    // 1. Tab switching / Minimizing / Visibility
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        setCheatAttempts(prev => {
          const next = prev + 1;
          logCheatEvent('tab_switch', `สลับแท็บ/ย่อหน้าต่าง หรือเข้าโปรแกรมอื่นในระบบ (ตรวจพบครั้งที่ ${next})`);
          return next;
        });
      }
    };

    // 2. Window Blur (e.g., clicking on developer tools or dual screen popup)
    const handleWindowBlur = () => {
      setCheatAttempts(prev => {
        const next = prev + 1;
        logCheatEvent('blur', `ละสายตาจากแท็บทำข้อสอบ หรือสลับโฟกัส (ตรวจพบครั้งที่ ${next})`);
        return next;
      });
    };

    // 3. Exit Fullscreen Detection
    const handleFullscreenChange = () => {
      const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) {
        setCheatAttempts(prev => {
          const next = prev + 1;
          logCheatEvent('fullscreen_exit', `พยายามออกจากโหมดเต็มหน้าจอ (ครั้งที่ ${next})`);
          return next;
        });
      }
    };

    // 4. Block hotkeys (Copy, Paste, Print, Inspect)
    const handleKeyDown = (e: KeyboardEvent) => {
      const blockedKeys = [
        e.ctrlKey && e.key === 'c', // Copy
        e.ctrlKey && e.key === 'v', // Paste
        e.ctrlKey && e.key === 'u', // View Source
        e.ctrlKey && e.key === 'p', // Print screen
        e.key === 'PrintScreen', // PrintScreen
        e.key === 'F12' // Developer tools
      ];
      if (blockedKeys.some(Boolean)) {
        e.preventDefault();
        logCheatEvent('right_click', `พยายามใช้คีย์บอร์ดชอร์ตคัตต้องห้ามเพื่อคัดลอก/พิมพ์หน้าจอ: ${e.key}`);
        showToast('ความปลอดภัยสูงสุด: บล็อกทางลัดคีย์บอร์ดเพื่อป้องกันข้อมูลรั่วไหล', 'warning');
      }
    };

    // 5. Block right click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logCheatEvent('right_click', 'พยายามคลิกขวาเปิดคำสั่ง');
      showToast('ความปลอดภัยสูงสุด: ปิดการใช้งานปุ่มคลิกขวา', 'warning');
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
          handleSubmitExam(true); // Auto submit on timeout
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

  const handleSubmitExam = async (isTimeout = false) => {
    if (!selectedExam || !currentUser) return;

    if (!isTimeout && !confirm('คุณยืนยันที่จะส่งข้อสอบใช่หรือไม่? การสแกนข้อมูลและคะแนนจะเริ่มทำงานทันที')) return;

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
        setFinishedResult(data);
        setExamState('finished');
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        showToast('บันทึกและตรวจคะแนนของคุณแบบเรียลไทม์เรียบร้อยแล้ว!');
        refreshData();
      }
    } catch (err) {
      showToast('ไม่สามารถบันทึกคะแนนเข้าฐานข้อมูลได้ โปรดแจ้งคุณครู', 'error');
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
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
      <header className="border-b-4 border-slate-900 bg-slate-900/95 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3">
          <div className="bg-rose-600 p-2.5 rounded-xl text-white shadow-[0_4px_0_0_#9f1239,0_8px_16px_rgba(244,63,94,0.3)] transition-transform hover:scale-105">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              SECURE EXAM SYSTEM
            </h1>
            <p className="text-xs text-slate-400 font-mono">ระบบแบบทดสอบออนไลน์นิรภัยและป้องกันการทุจริต</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Supabase Status Icon Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700/80 text-xs">
            <span className={`w-2 h-2 rounded-full ${dbStatus.useSupabase ? 'bg-emerald-400 shadow-emerald-500/50 shadow' : 'bg-amber-500'}`}></span>
            <span className="text-slate-300">
              {dbStatus.useSupabase ? 'Supabase คลาวด์ออนไลน์' : 'ออฟไลน์ (Local File DB)'}
            </span>
            <button 
              onClick={() => setShowSqlGuide(true)} 
              className="ml-1 text-rose-400 hover:text-rose-300 underline cursor-pointer"
            >
              ตั้งค่าคู่มือ
            </button>
          </div>

          {userRole !== 'guest' && (
            <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{currentUser?.name}</p>
                <p className="text-xs text-slate-400 capitalize">{userRole === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : userRole === 'teacher' ? 'คุณครูผู้สอน' : `นักเรียน: ${currentUser?.student_id}`}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700/80 transition-all cursor-pointer"
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
            <div className="max-w-md mx-auto my-12 card-3d rounded-3xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-500"></div>
            
            <div className="text-center mb-8">
              <div className="inline-flex bg-rose-500/10 p-3 rounded-2xl text-rose-500 mb-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
                <Shield className="w-8 h-8" />
              </div>
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
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">รหัสประจำตัวนักเรียน (Student ID)</label>
                  <input 
                    type="text" 
                    placeholder="ตัวอย่าง: STD001"
                    value={studentIdInput}
                    onChange={e => setStudentIdInput(e.target.value)}
                    className="w-full input-3d rounded-xl px-4 py-3 placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">รหัสผ่าน (Password)</label>
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
                  className="w-full py-3.5 btn-3d-primary font-semibold rounded-xl cursor-pointer mt-2"
                >
                  เข้าสู่ระบบสอบนิรภัย
                </button>
                <div className="text-center text-xs text-slate-500 mt-4">
                  มีบัญชีทดสอบเริ่มต้น: STD001 รหัสผ่าน password123
                </div>
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
                {!isFullscreen && (
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
                )}

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
                      onClick={() => handleSubmitExam(false)}
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
                                    {String.fromCharCode(3555 + index)} {/* ก ข ค ง in Thai unicode */}
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
                          onClick={() => handleSubmitExam(false)}
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
                                  <span>{String.fromCharCode(3555 + optIdx)}. {opt}</span>
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
            <aside className="w-full lg:w-64 card-3d rounded-3xl p-4 space-y-2 lg:self-start">
              <p className="text-[10px] font-bold text-slate-400 px-3 uppercase tracking-wider mb-2">เมนูการควบคุมครูผู้สอน</p>
              
              <button 
                onClick={() => setActiveTab('stats')}
                className={`w-full flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-all cursor-pointer ${activeTab === 'stats' ? 'tab-3d-active text-white' : 'tab-3d-inactive text-slate-300 hover:bg-slate-800'}`}
              >
                <BarChart3 className="w-4 h-4 text-rose-500" />
                <span>ภาพรวมและติดตามสอบเรียลไทม์</span>
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
            </aside>

            {/* Subpages inside dashboard */}
            <div className="flex-1 space-y-6">
              
              {/* === SUBPAGE: REAL-TIME MONITORING & STATS === */}
              {activeTab === 'stats' && (
                <div className="space-y-6">
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

                  {/* Real-time Incident Logs Monitoring Feed */}
                  <div className="card-3d rounded-3xl p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base flex items-center gap-2 text-rose-400">
                        <AlertTriangle className="w-5 h-5 text-rose-500 animate-bounce" />
                        <span>Real-Time สอบสวนทุจริตเรียลไทม์ (Live Logs)</span>
                      </h3>
                      <button 
                        onClick={refreshData}
                        className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white"
                        title="อัปเดตข้อมูล"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {cheatLogs.map(cl => (
                            <tr key={cl.id} className="bg-rose-950/5 hover:bg-rose-950/10 transition-colors">
                              <td className="p-3 font-mono text-slate-400">{new Date(cl.timestamp).toLocaleTimeString()}</td>
                              <td className="p-3 font-bold">{cl.student_id}</td>
                              <td className="p-3">{cl.student_name}</td>
                              <td className="p-3">
                                <span className="px-2.5 py-0.5 bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-full font-bold">
                                  {cl.violation_type === 'tab_switch' ? 'สลับหน้าจอ' :
                                   cl.violation_type === 'fullscreen_exit' ? 'ออกจากจอใหญ่' :
                                   cl.violation_type === 'blur' ? 'เสียโฟกัส' : 'คลิกขวา'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400">{cl.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-rose-600/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                  {exam.type}
                                </span>
                                {sub && (
                                  <span className="text-xs text-slate-400 font-mono">[{sub.code}] {sub.name}</span>
                                )}
                              </div>
                              <h4 className="font-bold text-sm text-slate-200 mt-1">{exam.title}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">เวลาจำกัด {exam.duration} นาที • ระบบสุ่มคำถาม: {exam.randomize ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
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
                                <label className="block text-[10px] text-slate-500 font-bold uppercase">ตัวเลือก {String.fromCharCode(3555 + oIdx)} (ตัวเลือกที่ {oIdx + 1})</label>
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
                                    <b>{String.fromCharCode(3555 + oIdx)}.</b> {opt}
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

      {/* Humble Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-[10px] text-slate-500 font-mono">
        &copy; 2026 SECURE EXAM SYSTEM
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
