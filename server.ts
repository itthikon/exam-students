import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
let supabase: any = null;
let useSupabase = false;

if (supabaseUrl && supabaseSecretKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseSecretKey);
    useSupabase = true;
    console.log('Supabase client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

// Offline fallback Database Path
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'offline_db.json');

// Ensure offline db file exists with initial beautiful seed data
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const defaultDbData = {
  teachers: [
    { id: 't1', email: 'itthikon.w@dongluangwittaya.ac.th', name: 'ครูอิทธิกร (Admin)', role: 'admin', password: 'password123' },
    { id: 't2', email: 'teacher@school.ac.th', name: 'ครูสมศรี ใจดี', role: 'teacher', password: 'password123' }
  ],
  students: [
    { id: 's1', student_id: 'STD001', name: 'สมชาย รักเรียน', password: 'password123', class_group: 'ม.6/1' },
    { id: 's2', student_id: 'STD002', name: 'สมหญิง เรียนดี', password: 'password123', class_group: 'ม.6/1' },
    { id: 's3', student_id: 'STD003', name: 'มานะ พากเพียร', password: 'password123', class_group: 'ม.6/2' },
    { id: 's4', student_id: 'STD004', name: 'วิชัย เก่งวิทยา', password: 'password123', class_group: 'ม.6/2' }
  ],
  subjects: [
    { id: 'sub1', code: 'ค33101', name: 'คณิตศาสตร์พื้นฐาน ม.6' },
    { id: 'sub2', code: 'ว32201', name: 'ฟิสิกส์เพิ่มเติม ม.5' },
    { id: 'sub3', code: 'อ31101', name: 'ภาษาอังกฤษพื้นฐาน ม.4' }
  ],
  exams: [
    {
      id: 'ex1',
      subject_id: 'sub1',
      title: 'สอบเก็บคะแนน เรื่อง ลำดับและอนุกรม',
      type: 'quiz',
      duration: 30,
      randomize: true,
      is_active: true
    },
    {
      id: 'ex2',
      subject_id: 'sub2',
      title: 'สอบกลางภาควิชาฟิสิกส์ เรื่อง แรงและการเคลื่อนที่',
      type: 'midterm',
      duration: 60,
      randomize: true,
      is_active: true
    },
    {
      id: 'ex3',
      subject_id: 'sub3',
      title: 'ฝึกฝนทักษะคำศัพท์ภาษาอังกฤษ (สอบวนซ้ำได้)',
      type: 'practice',
      duration: 15,
      randomize: true,
      is_active: true
    }
  ],
  questions: [
    {
      id: 'q1',
      exam_id: 'ex1',
      question_text: 'พจน์ที่ 10 ของลำดับเลขคณิต 3, 7, 11, 15, ... มีค่าเท่าใด?',
      options: ['35', '39', '43', '47'],
      correct_index: 1,
      points: 1,
      explanation: 'สูตรลำดับเลขคณิต an = a1 + (n-1)d โดยที่ a1 = 3, d = 4 จะได้ a10 = 3 + (10-1)4 = 3 + 36 = 39'
    },
    {
      id: 'q2',
      exam_id: 'ex1',
      question_text: 'ผลบวก 10 พจน์แรกของอนุกรมเลขคณิต 1 + 3 + 5 + ... มีค่าเท่าใด?',
      options: ['50', '80', '100', '120'],
      correct_index: 2,
      points: 1,
      explanation: 'สูตรผลบวก Sn = (n/2)(2a1 + (n-1)d) จะได้ S10 = (10/2)(2(1) + 9(2)) = 5(2 + 18) = 100'
    },
    {
      id: 'q3',
      exam_id: 'ex2',
      question_text: 'ปล่อยวัตถุจากตึกสูงลงมาในแนวดิ่ง ความเร่งของวัตถุขณะเคลื่อนที่จะมีค่าประมาณเท่าใด?',
      options: ['0 m/s^2', '4.9 m/s^2', '9.8 m/s^2', 'ขึ้นอยู่กับมวลของวัตถุ'],
      correct_index: 2,
      points: 2,
      explanation: 'ภายใต้แรงดึงดูดของโลก วัตถุทุกชนิดที่ตกแบบเสรีจะเคลื่อนที่ด้วยความเร่งคงตัว g ซึ่งมีค่าประมาณ 9.8 m/s^2'
    },
    {
      id: 'q4',
      exam_id: 'ex3',
      question_text: 'Which of the following words is a synonym for "ELEGANT"?',
      options: ['Sophisticated', 'Clumsy', 'Ugly', 'Simple'],
      correct_index: 0,
      points: 1,
      explanation: '"Sophisticated" means elegant, refined, or cultured.'
    }
  ],
  exam_results: [
    {
      id: 'res1',
      student_id: 'STD001',
      student_name: 'สมชาย รักเรียน',
      exam_id: 'ex1',
      score: 2,
      total_score: 2,
      start_time: new Date(Date.now() - 3600000).toISOString(),
      submit_time: new Date(Date.now() - 3300000).toISOString(),
      answers: JSON.stringify({ q1: 1, q2: 2 }),
      status: 'completed'
    },
    {
      id: 'res2',
      student_id: 'STD002',
      student_name: 'สมหญิง เรียนดี',
      exam_id: 'ex1',
      score: 1,
      total_score: 2,
      start_time: new Date(Date.now() - 1800000).toISOString(),
      submit_time: new Date(Date.now() - 1500000).toISOString(),
      answers: JSON.stringify({ q1: 1, q2: 0 }),
      status: 'completed'
    }
  ],
  cheat_logs: [
    {
      id: 'cl1',
      student_id: 'STD002',
      student_name: 'สมหญิง เรียนดี',
      exam_id: 'ex1',
      violation_type: 'tab_switch',
      timestamp: new Date(Date.now() - 1600000).toISOString(),
      details: 'มีการสลับหน้าจอหรือเปิดแท็บอื่นจำนวน 1 ครั้ง'
    }
  ]
};

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify(defaultDbData, null, 2), 'utf-8');
}

// Helpers for reading/writing offline DB
function readOfflineDb() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading offline database file:', err);
    return defaultDbData;
  }
}

function writeOfflineDb(data: any) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing offline database file:', err);
    return false;
  }
}

async function startServer() {
  // Check if we are running in production and the frontend dist is not built
  if (process.env.NODE_ENV === 'production') {
    const distHtmlPath = path.join(__dirname, 'dist/index.html');
    if (!fs.existsSync(distHtmlPath)) {
      console.log('Production mode detected but dist/index.html was not found. Triggering automatic frontend build (npm run build)...');
      try {
        execSync('npm run build', { stdio: 'inherit' });
        console.log('Frontend build completed successfully!');
      } catch (buildErr: any) {
        console.error('Failed to run automatic frontend build on startup:', buildErr.message);
      }
    }
  }

  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // API to verify if database is active (online vs offline mode)
  app.get('/api/db-status', (req, res) => {
    res.json({
      useSupabase: useSupabase,
      supabaseUrl: supabaseUrl,
      hasGeminiKey: false,
    });
  });

  // STUDENT LOGIN
  app.post('/api/students/login', async (req, res) => {
    const { student_id, password } = req.body;
    if (!student_id || !password) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสนักเรียนและรหัสผ่าน' });
    }

    const trimmedId = student_id.trim();
    const trimmedPassword = password.trim();

    if (useSupabase) {
      try {
        // Try exact match first using maybeSingle to avoid throwing unhandled exception
        let { data: student, error: fetchError } = await supabase
          .from('students')
          .select('*')
          .eq('student_id', trimmedId)
          .eq('password', trimmedPassword)
          .maybeSingle();

        // If not found, try case-insensitive match on student_id
        if (!student && !fetchError) {
          const { data: ilikeStudent, error: ilikeError } = await supabase
            .from('students')
            .select('*')
            .ilike('student_id', trimmedId)
            .eq('password', trimmedPassword)
            .maybeSingle();
          
          if (ilikeStudent && !ilikeError) {
            student = ilikeStudent;
          }
        }

        if (student) {
          return res.json(student);
        }
      } catch (err: any) {
        console.log('Supabase student query encountered an error, falling back to local storage...', err.message);
      }
    }

    // Fallback Offline DB
    const db = readOfflineDb();
    const studentLocal = db.students.find(
      (s: any) => 
        String(s.student_id || '').toLowerCase() === trimmedId.toLowerCase() && 
        String(s.password || '').trim() === trimmedPassword
    );

    if (studentLocal) {
      // If we are using Supabase and found student locally, upsert them to Supabase in background to sync
      if (useSupabase) {
        supabase
          .from('students')
          .upsert({
            id: studentLocal.id,
            student_id: studentLocal.student_id,
            name: studentLocal.name,
            password: studentLocal.password,
            class_group: studentLocal.class_group
          })
          .then(({ error }) => {
            if (error) console.error('Failed to sync student to Supabase in background:', error.message);
            else console.log(`Successfully synced student ${studentLocal.student_id} to Supabase in background.`);
          })
          .catch(e => console.error('Background sync failed:', e));
      }
      return res.json(studentLocal);
    } else {
      return res.status(401).json({ error: 'รหัสประจำตัวนักเรียนหรือรหัสผ่านไม่ถูกต้อง' });
    }
  });

  // TEACHER LOGIN (Supports domain search or direct custom accounts, and OAuth check)
  app.post('/api/teachers/login', async (req, res) => {
    const { email, password, isGoogleLogin, googleProfile } = req.body;

    if (isGoogleLogin && googleProfile) {
      // Teachers/Admins logging in with Google
      const mail = googleProfile.email.toLowerCase();
      // Auto-register or verify domain
      const db = readOfflineDb();
      let teacher = db.teachers.find((t: any) => t.email.toLowerCase() === mail);

      if (!teacher) {
        // Automatically create user with teacher role for standard users or admin for itthikon.w
        const role = mail === 'itthikon.w@dongluangwittaya.ac.th' ? 'admin' : 'teacher';
        teacher = {
          id: 't_' + Date.now(),
          email: mail,
          name: googleProfile.name || mail.split('@')[0],
          role: role,
          password: ''
        };
        db.teachers.push(teacher);
        writeOfflineDb(db);
      }

      // If Supabase is connected, store in Supabase teachers too
      if (useSupabase) {
        try {
          await supabase.from('teachers').upsert({
            email: teacher.email,
            name: teacher.name,
            role: teacher.role
          });
        } catch (e) {
          console.error('Could not upsert teacher to Supabase:', e);
        }
      }

      return res.json(teacher);
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }

    // Manual Credentials Authentication (Default accounts fallback)
    const db = readOfflineDb();
    const teacher = db.teachers.find(
      (t: any) => t.email.toLowerCase() === email.trim().toLowerCase() && t.password === password
    );

    if (teacher) {
      return res.json(teacher);
    } else {
      return res.status(401).json({ error: 'อีเมลผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
  });

  // GET SUBJECTS
  app.get('/api/subjects', async (req, res) => {
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('subjects').select('*').order('code', { ascending: true });
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase subjects read error, trying offline fallback:', err);
      }
    }
    const db = readOfflineDb();
    res.json(db.subjects);
  });

  // CREATE SUBJECT
  app.post('/api/subjects', async (req, res) => {
    const { code, name } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const newSubject = { id: 'sub_' + Date.now(), code: code.trim(), name: name.trim() };

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('subjects').insert(newSubject).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase create subject error, trying offline fallback:', err);
      }
    }

    const db = readOfflineDb();
    db.subjects.push(newSubject);
    writeOfflineDb(db);
    res.json(newSubject);
  });

  // DELETE SUBJECT
  app.delete('/api/subjects/:id', async (req, res) => {
    const id = req.params.id;

    if (useSupabase) {
      try {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (!error) return res.json({ success: true });
      } catch (err) {
        console.error('Supabase delete subject error, trying offline fallback:', err);
      }
    }

    const db = readOfflineDb();
    db.subjects = db.subjects.filter((s: any) => s.id !== id);
    db.exams = db.exams.filter((e: any) => e.subject_id !== id);
    writeOfflineDb(db);
    res.json({ success: true });
  });

  // GET EXAMS
  app.get('/api/exams', async (req, res) => {
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('exams').select('*');
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase exams read error, trying offline fallback:', err);
      }
    }
    const db = readOfflineDb();
    res.json(db.exams);
  });

  // CREATE EXAM
  app.post('/api/exams', async (req, res) => {
    const { subject_id, title, type, duration, randomize } = req.body;
    if (!subject_id || !title || !type || !duration) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const newExam = {
      id: 'ex_' + Date.now(),
      subject_id,
      title: title.trim(),
      type,
      duration: Number(duration),
      randomize: !!randomize,
      is_active: true
    };

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('exams').insert(newExam).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase create exam error, trying offline fallback:', err);
      }
    }

    const db = readOfflineDb();
    db.exams.push(newExam);
    writeOfflineDb(db);
    res.json(newExam);
  });

  // UPDATE EXAM STATUS
  app.patch('/api/exams/:id', async (req, res) => {
    const id = req.params.id;
    const { is_active } = req.body;

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('exams').update({ is_active }).eq('id', id).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase update exam error:', err);
      }
    }

    const db = readOfflineDb();
    const index = db.exams.findIndex((e: any) => e.id === id);
    if (index !== -1) {
      db.exams[index].is_active = is_active;
      writeOfflineDb(db);
      res.json(db.exams[index]);
    } else {
      res.status(404).json({ error: 'ไม่พบชุดข้อสอบนี้' });
    }
  });

  // DELETE EXAM
  app.delete('/api/exams/:id', async (req, res) => {
    const id = req.params.id;

    if (useSupabase) {
      try {
        const { error } = await supabase.from('exams').delete().eq('id', id);
        if (!error) return res.json({ success: true });
      } catch (err) {
        console.error('Supabase delete exam error:', err);
      }
    }

    const db = readOfflineDb();
    db.exams = db.exams.filter((e: any) => e.id !== id);
    db.questions = db.questions.filter((q: any) => q.exam_id !== id);
    writeOfflineDb(db);
    res.json({ success: true });
  });

  // GET QUESTIONS BY EXAM
  app.get('/api/exams/:examId/questions', async (req, res) => {
    const examId = req.params.examId;

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('questions').select('*').eq('exam_id', examId);
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase questions read error:', err);
      }
    }

    const db = readOfflineDb();
    const questions = db.questions.filter((q: any) => q.exam_id === examId);
    res.json(questions);
  });

  // SAVE OR UPDATE A QUESTION
  app.post('/api/questions', async (req, res) => {
    const { id, exam_id, question_text, options, correct_index, points, explanation } = req.body;

    if (!exam_id || !question_text || !options || correct_index === undefined) {
      return res.status(400).json({ error: 'กรุณากรอกโจทย์ตัวเลือกและคำตอบที่ถูกต้อง' });
    }

    const targetId = id || 'q_' + Date.now();
    const questionObj = {
      id: targetId,
      exam_id,
      question_text: question_text.trim(),
      options,
      correct_index: Number(correct_index),
      points: Number(points || 1),
      explanation: explanation ? explanation.trim() : ''
    };

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('questions').upsert(questionObj).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase question save error:', err);
      }
    }

    const db = readOfflineDb();
    const index = db.questions.findIndex((q: any) => q.id === targetId);
    if (index !== -1) {
      db.questions[index] = questionObj;
    } else {
      db.questions.push(questionObj);
    }
    writeOfflineDb(db);
    res.json(questionObj);
  });

  // BATCH UPDATE QUESTIONS FOR AN EXAM (Replace or add)
  app.post('/api/exams/:examId/questions/batch', async (req, res) => {
    const examId = req.params.examId;
    const { questions } = req.body; // Array of questions

    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'ข้อมูลคำถามไม่ถูกต้อง' });
    }

    const processedQuestions = questions.map((q: any, i: number) => ({
      id: q.id || `q_${examId}_${Date.now()}_${i}`,
      exam_id: examId,
      question_text: q.question_text.trim(),
      options: Array.isArray(q.options) ? q.options : ['ก', 'ข', 'ค', 'ง'],
      correct_index: Number(q.correct_index),
      points: Number(q.points || 1),
      explanation: q.explanation ? q.explanation.trim() : ''
    }));

    if (useSupabase) {
      try {
        // Delete old questions
        await supabase.from('questions').delete().eq('exam_id', examId);
        // Insert new ones
        const { data, error } = await supabase.from('questions').insert(processedQuestions).select();
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase batch save failed:', err);
      }
    }

    const db = readOfflineDb();
    // Filter out old questions of this exam
    db.questions = db.questions.filter((q: any) => q.exam_id !== examId);
    db.questions.push(...processedQuestions);
    writeOfflineDb(db);
    res.json(processedQuestions);
  });

  // DELETE QUESTION
  app.delete('/api/questions/:id', async (req, res) => {
    const id = req.params.id;

    if (useSupabase) {
      try {
        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (!error) return res.json({ success: true });
      } catch (err) {
        console.error('Supabase delete question error:', err);
      }
    }

    const db = readOfflineDb();
    db.questions = db.questions.filter((q: any) => q.id !== id);
    writeOfflineDb(db);
    res.json({ success: true });
  });

  // IMPORT STUDENT ROSTER (Replacing or adding roster)
  app.post('/api/students/import', async (req, res) => {
    const { studentsList } = req.body;

    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      return res.status(400).json({ error: 'ไม่พบรายการนักเรียนที่นำเข้า' });
    }

    const normalizedStudents = studentsList.map((s: any, idx: number) => ({
      id: s.id || `s_${Date.now()}_${idx}`,
      student_id: String(s.student_id || '').trim(),
      name: String(s.name || '').trim(),
      password: String(s.password || '123456').trim(),
      class_group: String(s.class_group || 'ม.6').trim()
    })).filter(s => s.student_id && s.name);

    if (useSupabase) {
      try {
        const { error } = await supabase.from('students').upsert(normalizedStudents);
        if (!error) return res.json({ success: true, count: normalizedStudents.length });
      } catch (err) {
        console.error('Supabase students roster save failed:', err);
      }
    }

    const db = readOfflineDb();
    // Insert and avoid duplicate Student IDs
    for (const student of normalizedStudents) {
      const existingIdx = db.students.findIndex((s: any) => s.student_id === student.student_id);
      if (existingIdx !== -1) {
        db.students[existingIdx] = student;
      } else {
        db.students.push(student);
      }
    }
    writeOfflineDb(db);
    res.json({ success: true, count: normalizedStudents.length });
  });

  // GET STUDENTS
  app.get('/api/students', async (req, res) => {
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('students').select('*').order('student_id', { ascending: true });
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase students read failed:', err);
      }
    }
    const db = readOfflineDb();
    res.json(db.students);
  });

  // ADD SINGLE STUDENT
  app.post('/api/students', async (req, res) => {
    const { student_id, name, password, class_group } = req.body;
    if (!student_id || !name || !password || !class_group) {
      return res.status(400).json({ error: 'ข้อมูลนักเรียนไม่ครบถ้วน' });
    }

    const newStudent = {
      id: 's_' + Date.now(),
      student_id: student_id.trim(),
      name: name.trim(),
      password: password.trim(),
      class_group: class_group.trim()
    };

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('students').insert(newStudent).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase single student create error:', err);
      }
    }

    const db = readOfflineDb();
    // Check duplication
    if (db.students.some((s: any) => s.student_id === newStudent.student_id)) {
      return res.status(400).json({ error: 'มีรหัสนักเรียนนี้ในระบบอยู่แล้ว' });
    }
    db.students.push(newStudent);
    writeOfflineDb(db);
    res.json(newStudent);
  });

  // DELETE STUDENT
  app.delete('/api/students/:id', async (req, res) => {
    const id = req.params.id;

    if (useSupabase) {
      try {
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (!error) return res.json({ success: true });
      } catch (err) {
        console.error('Supabase student delete error:', err);
      }
    }

    const db = readOfflineDb();
    db.students = db.students.filter((s: any) => s.id !== id);
    writeOfflineDb(db);
    res.json({ success: true });
  });

  // SUBMIT EXAM RESULT
  app.post('/api/exam-results', async (req, res) => {
    const { student_id, student_name, exam_id, score, total_score, start_time, submit_time, answers, status } = req.body;

    if (!student_id || !exam_id) {
      return res.status(400).json({ error: 'ข้อมูลส่งคำตอบไม่ครบถ้วน' });
    }

    const resultObj = {
      id: 'res_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      student_id,
      student_name,
      exam_id,
      score: Number(score),
      total_score: Number(total_score),
      start_time: start_time || new Date().toISOString(),
      submit_time: submit_time || new Date().toISOString(),
      answers: typeof answers === 'string' ? answers : JSON.stringify(answers),
      status: status || 'completed'
    };

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('exam_results').insert(resultObj).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase save exam results failed, saving fallback:', err);
      }
    }

    const db = readOfflineDb();
    db.exam_results.push(resultObj);
    writeOfflineDb(db);
    res.json(resultObj);
  });

  // GET EXAM RESULTS (REAL-TIME PROGRESS / COMPLETED REPORTS)
  app.get('/api/exam-results', async (req, res) => {
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('exam_results').select('*');
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase exam results read failed:', err);
      }
    }
    const db = readOfflineDb();
    res.json(db.exam_results);
  });

  // SUBMIT CHEAT/FRAUD DETECTED EVENT
  app.post('/api/cheat-logs', async (req, res) => {
    const { student_id, student_name, exam_id, violation_type, details } = req.body;

    if (!student_id || !exam_id || !violation_type) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const cheatLogObj = {
      id: 'cl_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      student_id,
      student_name,
      exam_id,
      violation_type,
      timestamp: new Date().toISOString(),
      details: details || ''
    };

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('cheat_logs').insert(cheatLogObj).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase save cheat log failed:', err);
      }
    }

    const db = readOfflineDb();
    db.cheat_logs.push(cheatLogObj);
    writeOfflineDb(db);
    res.json(cheatLogObj);
  });

  // GET CHEAT LOGS (REAL-TIME DETECTION)
  app.get('/api/cheat-logs', async (req, res) => {
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('cheat_logs').select('*');
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase cheat logs read failed:', err);
      }
    }
    const db = readOfflineDb();
    res.json(db.cheat_logs);
  });

  // ADMIN ENDPOINT: UPDATE USER ROLE OR DETAILS
  app.post('/api/teachers', async (req, res) => {
    const { email, name, role, password } = req.body;
    if (!email || !role) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const db = readOfflineDb();
    const existingIdx = db.teachers.findIndex((t: any) => t.email.toLowerCase() === email.trim().toLowerCase());

    const teacherObj = {
      id: existingIdx !== -1 ? db.teachers[existingIdx].id : 't_' + Date.now(),
      email: email.trim().toLowerCase(),
      name: name ? name.trim() : email.split('@')[0],
      role,
      password: password || 'password123'
    };

    if (existingIdx !== -1) {
      db.teachers[existingIdx] = teacherObj;
    } else {
      db.teachers.push(teacherObj);
    }
    writeOfflineDb(db);

    if (useSupabase) {
      try {
        await supabase.from('teachers').upsert({
          email: teacherObj.email,
          name: teacherObj.name,
          role: teacherObj.role
        });
      } catch (e) {
        console.error('Could not upsert to Supabase teachers:', e);
      }
    }

    res.json(teacherObj);
  });

  // ADMIN ENDPOINT: GET ALL TEACHERS
  app.get('/api/teachers', (req, res) => {
    const db = readOfflineDb();
    res.json(db.teachers);
  });

  // ADMIN ENDPOINT: DELETE A TEACHER
  app.delete('/api/teachers/:id', (req, res) => {
    const id = req.params.id;
    const db = readOfflineDb();
    db.teachers = db.teachers.filter((t: any) => t.id !== id);
    writeOfflineDb(db);
    res.json({ success: true });
  });

  // Client SPA mounting
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Exam System server running on port ${port}`);
  });
}

startServer();
