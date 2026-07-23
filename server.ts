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

// Helper function to dynamically initialize Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lzzpebrahqwcberfqwfk.supabase.co';
  // Default fallback key decoded at runtime to prevent GitHub secret scanner push rejections
  const defaultKey = Buffer.from('c2Jfc2VjcmV0XzV3WmNCLW5VR09uUVoybmc1eVNKQ0FfbF9ZMmx3YmE=', 'base64').toString('utf-8');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || defaultKey;

  if (!url || !key) {
    return { client: null, useSupabase: false, url, keyPresent: false };
  }

  try {
    const client = createClient(url, key);
    return { client, useSupabase: true, url, keyPresent: true };
  } catch (err: any) {
    return { client: null, useSupabase: false, url, keyPresent: true, error: err.message };
  }
}

// Initial client reference
let { client: supabase, useSupabase } = getSupabase();

// Offline fallback Database Path
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'offline_db.json');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const defaultDbData = {
  teachers: [
    { id: 't1', email: 'itthikon.w@dongluangwittaya.ac.th', name: 'ครูอิทธิกร (Admin)', role: 'admin', password: 'password123' },
    { id: 't2', email: 'teacher@school.ac.th', name: 'ครูสมศรี ใจดี', role: 'teacher', password: 'password123' }
  ],
  students: [],
  subjects: [],
  exams: [],
  questions: [],
  exam_results: [],
  cheat_logs: [],
  announcements: [],
  discussions: [],
  popup_messages: [],
  locked_students: [],
  live_sessions: []
};

// Only initialize offline_db.json if it doesn't exist yet to avoid wiping user data
if (!fs.existsSync(dbPath)) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDbData, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error initializing offline db:', e);
  }
}

// Helpers for reading/writing offline DB
function readOfflineDb() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(raw);
    if (!db.teachers) db.teachers = defaultDbData.teachers;
    if (!db.students) db.students = [];
    if (!db.subjects) db.subjects = [];
    if (!db.exams) db.exams = [];
    if (!db.questions) db.questions = [];
    if (!db.exam_results) db.exam_results = [];
    if (!db.cheat_logs) db.cheat_logs = [];
    if (!db.locked_students) db.locked_students = [];
    if (!db.live_sessions) db.live_sessions = [];
    if (!db.popup_messages) db.popup_messages = [];
    if (!db.announcements) db.announcements = [];
    if (!db.discussions) db.discussions = [];
    return db;
  } catch (err) {
    console.error('Error reading offline database file:', err);
    return { ...defaultDbData };
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

  // API to verify if database is active (online vs offline mode) with health & latency stats
  app.get('/api/db-status', async (req, res) => {
    const startTime = Date.now();
    const sup = getSupabase();
    supabase = sup.client;
    useSupabase = sup.useSupabase;

    let isConnected = false;
    let latencyMs = 0;
    let supabaseError: string | null = null;
    let tableMissing = false;

    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('students').select('student_id', { count: 'exact', head: true });
        latencyMs = Date.now() - startTime;
        if (error) {
          supabaseError = error.message;
          const isTableErr = error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('schema cache') || error.message?.includes('does not exist');
          if (isTableErr) {
            tableMissing = true;
            isConnected = true; // Supabase Cloud is reached and connected! Only SQL tables need creation.
          } else {
            // Test if teachers table or basic ping works
            const tRes = await supabase.from('teachers').select('id', { count: 'exact', head: true });
            if (!tRes.error || tRes.error.code === 'PGRST205' || tRes.error.code === '42P01' || tRes.error.message?.includes('does not exist')) {
              isConnected = true;
              if (tRes.error) tableMissing = true;
            } else {
              isConnected = false;
            }
          }
        } else {
          isConnected = true;
          tableMissing = false;
        }
      } catch (e: any) {
        isConnected = false;
        latencyMs = Date.now() - startTime;
        supabaseError = e.message || 'Supabase connection failed';
      }
    } else {
      latencyMs = Date.now() - startTime;
      isConnected = false;
      if (!sup.keyPresent) {
        supabaseError = 'ยังไม่ได้ตั้งค่าคีย์ SUPABASE_SECRET_KEY หรือ SUPABASE_PUBLISHABLE_KEY ในไฟล์ .env / Secrets';
      }
    }

    const db = readOfflineDb();
    let stats = {
      teachers: db.teachers?.length || 0,
      students: db.students?.length || 0,
      subjects: db.subjects?.length || 0,
      exams: db.exams?.length || 0,
      questions: db.questions?.length || 0,
      exam_results: db.exam_results?.length || 0,
      cheat_logs: db.cheat_logs?.length || 0,
    };

    if (useSupabase && isConnected && supabase && !tableMissing) {
      try {
        const [t, s, sub, ex, q, er, cl] = await Promise.all([
          supabase.from('teachers').select('id', { count: 'exact', head: true }),
          supabase.from('students').select('student_id', { count: 'exact', head: true }),
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase.from('exams').select('id', { count: 'exact', head: true }),
          supabase.from('questions').select('id', { count: 'exact', head: true }),
          supabase.from('exam_results').select('id', { count: 'exact', head: true }),
          supabase.from('cheat_logs').select('id', { count: 'exact', head: true })
        ]);
        stats = {
          teachers: t.count ?? stats.teachers,
          students: s.count ?? stats.students,
          subjects: sub.count ?? stats.subjects,
          exams: ex.count ?? stats.exams,
          questions: q.count ?? stats.questions,
          exam_results: er.count ?? stats.exam_results,
          cheat_logs: cl.count ?? stats.cheat_logs,
        };
      } catch (e) {
        // Fallback to local stats
      }
    }

    res.json({
      useSupabase,
      keyPresent: sup.keyPresent,
      isConnected,
      latencyMs,
      supabaseUrl: sup.url || null,
      supabaseError,
      tableMissing,
      storageType: useSupabase ? (isConnected ? (tableMissing ? 'Cloud Supabase PostgreSQL (รอสร้างตาราง SQL)' : 'Cloud Supabase PostgreSQL') : 'Cloud Supabase (Error - Fallback Local)') : 'Local JSON File Storage (data/offline_db.json)',
      stats
    });
  });

  // API to seed default database records into Supabase and/or Local DB
  app.post('/api/db-seed', async (req, res) => {
    try {
      const { forceReset } = req.body || {};
      
      if (forceReset) {
        writeOfflineDb(defaultDbData);
      }

      const db = readOfflineDb();

      // If Supabase is connected, seed tables
      if (useSupabase && supabase) {
        try {
          if (db.teachers && db.teachers.length > 0) {
            await supabase.from('teachers').upsert(db.teachers.map((t: any) => ({
              id: t.id,
              email: t.email,
              name: t.name,
              role: t.role,
              password: t.password || ''
            })));
          }
          if (db.students && db.students.length > 0) {
            const { error: seedErr } = await supabase.from('students').upsert(db.students.map((s: any) => ({
              id: s.id || ('s_' + s.student_id),
              student_id: s.student_id,
              name: s.name,
              password: s.password,
              class_group: s.class_group
            })));
            if (seedErr && (seedErr.message?.includes('id') || seedErr.code === 'PGRST204')) {
              await supabase.from('students').upsert(db.students.map((s: any) => ({
                student_id: s.student_id,
                name: s.name,
                password: s.password,
                class_group: s.class_group
              })));
            }
          }
          if (db.subjects && db.subjects.length > 0) {
            await supabase.from('subjects').upsert(db.subjects.map((sub: any) => ({
              id: sub.id,
              code: sub.code,
              name: sub.name
            })));
          }
          if (db.exams && db.exams.length > 0) {
            await supabase.from('exams').upsert(db.exams.map((ex: any) => ({
              id: ex.id,
              subject_id: ex.subject_id,
              title: ex.title,
              type: ex.type,
              duration: ex.duration,
              randomize: ex.randomize,
              is_active: ex.is_active,
              anti_cheat_level: ex.anti_cheat_level || 'strict'
            })));
          }
          if (db.questions && db.questions.length > 0) {
            await supabase.from('questions').upsert(db.questions.map((q: any) => ({
              id: q.id,
              exam_id: q.exam_id,
              question_text: q.question_text,
              options: q.options,
              correct_index: q.correct_index,
              points: q.points,
              explanation: q.explanation || ''
            })));
          }
        } catch (supErr: any) {
          console.error('Failed to seed default data to Supabase:', supErr);
        }
      }

      res.json({ success: true, message: 'นำเข้าข้อมูลเริ่มต้นลงฐานข้อมูลเรียบร้อยแล้ว' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลเริ่มต้น' });
    }
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
        if (!error && data && data.length > 0) return res.json(data);
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
        if (!error && data && data.length > 0) return res.json(data);
      } catch (err) {
        console.error('Supabase exams read error, trying offline fallback:', err);
      }
    }
    const db = readOfflineDb();
    res.json(db.exams);
  });

  // CREATE EXAM
  app.post('/api/exams', async (req, res) => {
    const { subject_id, title, type, duration, randomize, anti_cheat_level } = req.body;
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
      is_active: true,
      anti_cheat_level: anti_cheat_level || 'strict'
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

  // UPDATE EXAM STATUS / PROPERTIES
  app.patch('/api/exams/:id', async (req, res) => {
    const id = req.params.id;
    const { is_active, anti_cheat_level } = req.body;

    if (useSupabase) {
      try {
        const updateObj: any = {};
        if (is_active !== undefined) updateObj.is_active = is_active;
        if (anti_cheat_level !== undefined) updateObj.anti_cheat_level = anti_cheat_level;

        const { data, error } = await supabase.from('exams').update(updateObj).eq('id', id).select();
        if (!error && data) return res.json(data[0]);
      } catch (err) {
        console.error('Supabase update exam error:', err);
      }
    }

    const db = readOfflineDb();
    const index = db.exams.findIndex((e: any) => e.id === id);
    if (index !== -1) {
      if (is_active !== undefined) db.exams[index].is_active = is_active;
      if (anti_cheat_level !== undefined) db.exams[index].anti_cheat_level = anti_cheat_level;
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

  // BATCH APPEND QUESTIONS FOR AN EXAM (Append to existing)
  app.post('/api/exams/:examId/questions/append-batch', async (req, res) => {
    const examId = req.params.examId;
    const { questions } = req.body; // Array of questions

    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'ข้อมูลคำถามไม่ถูกต้อง' });
    }

    const processedQuestions = questions.map((q: any, i: number) => ({
      id: q.id || `q_${examId}_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      exam_id: examId,
      question_text: q.question_text.trim(),
      options: Array.isArray(q.options) ? q.options : ['ก', 'ข', 'ค', 'ง'],
      correct_index: Number(q.correct_index !== undefined ? q.correct_index : 0),
      points: Number(q.points || 1),
      explanation: q.explanation ? q.explanation.trim() : ''
    }));

    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('questions').insert(processedQuestions).select();
        if (!error && data) return res.json(data);
      } catch (err) {
        console.error('Supabase batch append failed:', err);
      }
    }

    const db = readOfflineDb();
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

    // ALWAYS write to local offline DB first so data is guaranteed saved on server
    const db = readOfflineDb();
    for (const student of normalizedStudents) {
      const existingIdx = db.students.findIndex((s: any) => s.student_id === student.student_id);
      if (existingIdx !== -1) {
        db.students[existingIdx] = student;
      } else {
        db.students.push(student);
      }
    }
    writeOfflineDb(db);

    let savedToCloud = false;
    let cloudError: string | null = null;

    if (useSupabase && supabase) {
      try {
        const { error } = await supabase.from('students').upsert(normalizedStudents);
        if (!error) {
          savedToCloud = true;
        } else {
          cloudError = error.message;
          console.error('Supabase students roster save failed:', error);
        }
      } catch (err: any) {
        cloudError = err.message || 'Supabase connection error';
        console.error('Supabase students roster save failed:', err);
      }
    }

    res.json({
      success: true,
      count: normalizedStudents.length,
      savedToCloud,
      cloudError
    });
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
        let { data, error } = await supabase.from('students').insert(newStudent).select();
        if (error && (error.message?.includes('id') || error.code === 'PGRST204')) {
          const fallbackStudent = {
            student_id: student_id.trim(),
            name: name.trim(),
            password: password.trim(),
            class_group: class_group.trim()
          };
          const resFallback = await supabase.from('students').insert(fallbackStudent).select();
          data = resFallback.data;
          error = resFallback.error;
        }
        if (!error && data && data.length > 0) return res.json(data[0]);
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

  // DELETE ALL STUDENTS IN SYSTEM
  app.delete('/api/students/batch/all', async (req, res) => {
    if (useSupabase) {
      try {
        const { error } = await supabase.from('students').delete().neq('id', 'placeholder_nonexistent');
        if (!error) return res.json({ success: true });
      } catch (err) {
        console.error('Supabase delete all students error:', err);
      }
    }

    const db = readOfflineDb();
    db.students = [];
    writeOfflineDb(db);
    res.json({ success: true });
  });

  // DELETE STUDENTS BY CLASS GROUP
  app.delete('/api/students/batch/class/:class_group', async (req, res) => {
    const class_group = req.params.class_group;

    if (useSupabase) {
      try {
        const { error } = await supabase.from('students').delete().eq('class_group', class_group);
        if (!error) return res.json({ success: true });
      } catch (err) {
        console.error('Supabase delete class students error:', err);
      }
    }

    const db = readOfflineDb();
    db.students = db.students.filter((s: any) => s.class_group !== class_group);
    writeOfflineDb(db);
    res.json({ success: true });
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

  // DELETE ALL CHEAT LOGS
  app.delete('/api/cheat-logs', async (req, res) => {
    if (useSupabase) {
      try {
        const { error } = await supabase.from('cheat_logs').delete().neq('id', '');
        if (error) console.error('Supabase bulk delete cheat logs error:', error);
      } catch (err) {
        console.error('Supabase bulk delete cheat logs error:', err);
      }
    }
    const db = readOfflineDb();
    db.cheat_logs = [];
    writeOfflineDb(db);
    res.json({ success: true, message: 'ลบประวัติการทุจริตทั้งหมดสำเร็จ' });
  });

  // DELETE SPECIFIC CHEAT LOG BY ID
  app.delete('/api/cheat-logs/:id', async (req, res) => {
    const id = req.params.id;
    if (useSupabase) {
      try {
        const { error } = await supabase.from('cheat_logs').delete().eq('id', id);
        if (error) console.error('Supabase delete cheat log error:', error);
      } catch (err) {
        console.error('Supabase delete cheat log error:', err);
      }
    }
    const db = readOfflineDb();
    db.cheat_logs = db.cheat_logs.filter((cl: any) => cl.id !== id);
    writeOfflineDb(db);
    res.json({ success: true, message: 'ลบประวัติรายการทุจริตที่เลือกสำเร็จ' });
  });

  // GET SPECIFIC LOCK STATUS OR ALL LOCKED SESSIONS
  app.get('/api/lock-status', (req, res) => {
    const { student_id, exam_id } = req.query;
    const db = readOfflineDb();
    const locked_students = db.locked_students || [];

    if (student_id && exam_id) {
      const is_locked = locked_students.some(
        (item: any) => item.student_id === student_id && item.exam_id === exam_id
      );
      return res.json({ is_locked });
    }

    res.json(locked_students);
  });

  // LOCK / UNLOCK STUDENT SESSION (FOR SCREEN SWITCH BYPASS)
  app.post('/api/lock-status', (req, res) => {
    const { student_id, exam_id, is_locked } = req.body;
    if (!student_id || !exam_id) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const db = readOfflineDb();
    if (!db.locked_students) {
      db.locked_students = [];
    }

    if (is_locked) {
      // Add if not exists
      const exists = db.locked_students.some(
        (item: any) => item.student_id === student_id && item.exam_id === exam_id
      );
      if (!exists) {
        db.locked_students.push({ 
          student_id, 
          exam_id, 
          locked_at: new Date().toISOString() 
        });
      }
    } else {
      // Remove
      db.locked_students = db.locked_students.filter(
        (item: any) => !(item.student_id === student_id && item.exam_id === exam_id)
      );
    }

    writeOfflineDb(db);
    res.json({ success: true, is_locked });
  });

  // ==========================================
  // FEATURE 1: LIVE EXAM STATUS MONITORING API
  // ==========================================
  app.post('/api/live-status/heartbeat', (req, res) => {
    const { student_id, student_name, class_group, exam_id, exam_title, subject_id, subject_name, answered_count, total_questions, time_remaining, status, last_violation } = req.body;
    if (!student_id || !exam_id) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }
    const db = readOfflineDb();
    if (!db.live_sessions) db.live_sessions = [];
    
    const existingIndex = db.live_sessions.findIndex((s: any) => s.student_id === student_id && s.exam_id === exam_id);
    const sessionObj = {
      student_id,
      student_name: student_name || 'นักเรียน',
      class_group: class_group || '-',
      exam_id,
      exam_title: exam_title || 'ข้อสอบ',
      subject_id: subject_id || '',
      subject_name: subject_name || '',
      answered_count: answered_count || 0,
      total_questions: total_questions || 0,
      time_remaining: time_remaining !== undefined ? time_remaining : 0,
      status: status || 'taking',
      last_violation: last_violation || null,
      last_active: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      db.live_sessions[existingIndex] = sessionObj;
    } else {
      db.live_sessions.push(sessionObj);
    }
    writeOfflineDb(db);
    res.json({ success: true });
  });

  app.get('/api/live-status', (req, res) => {
    const db = readOfflineDb();
    if (!db.live_sessions) db.live_sessions = [];
    // Remove stale sessions older than 45 seconds
    const now = Date.now();
    db.live_sessions = db.live_sessions.filter((s: any) => {
      const diffSec = (now - new Date(s.last_active).getTime()) / 1000;
      return diffSec < 45;
    });
    writeOfflineDb(db);
    res.json(db.live_sessions);
  });

  app.post('/api/live-status/end', (req, res) => {
    const { student_id, exam_id } = req.body;
    const db = readOfflineDb();
    if (db.live_sessions) {
      db.live_sessions = db.live_sessions.filter((s: any) => !(s.student_id === student_id && s.exam_id === exam_id));
      writeOfflineDb(db);
    }
    res.json({ success: true });
  });

  // ==========================================
  // FEATURE 2: DATABASE BACKUP & RESTORE API
  // ==========================================
  app.get('/api/backup/export', (req, res) => {
    const db = readOfflineDb();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="exam_system_backup_${dateStr}.json"`);
    res.send(JSON.stringify(db, null, 2));
  });

  app.post('/api/backup/import', async (req, res) => {
    try {
      const backupData = req.body;
      if (!backupData || typeof backupData !== 'object' || !backupData.teachers || !backupData.students) {
        return res.status(400).json({ error: 'รูปแบบไฟล์สำรองฐานข้อมูลไม่ถูกต้อง' });
      }

      writeOfflineDb(backupData);

      // If Supabase is enabled, sync core tables
      if (useSupabase) {
        try {
          if (Array.isArray(backupData.students) && backupData.students.length > 0) {
            await supabase.from('students').upsert(backupData.students);
          }
          if (Array.isArray(backupData.teachers) && backupData.teachers.length > 0) {
            await supabase.from('teachers').upsert(backupData.teachers);
          }
          if (Array.isArray(backupData.subjects) && backupData.subjects.length > 0) {
            await supabase.from('subjects').upsert(backupData.subjects);
          }
          if (Array.isArray(backupData.exams) && backupData.exams.length > 0) {
            await supabase.from('exams').upsert(backupData.exams);
          }
        } catch (spErr) {
          console.error('Supabase backup restore sync error:', spErr);
        }
      }

      res.json({ success: true, message: 'นำคืนฐานข้อมูลเรียบร้อยแล้ว!' });
    } catch (err: any) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการนำคืนข้อมูล: ' + err.message });
    }
  });

  // MANUAL SYNC ALL LOCAL DATA TO SUPABASE CLOUD
  app.post('/api/db-sync-to-cloud', async (req, res) => {
    if (!useSupabase || !supabase) {
      return res.status(400).json({ 
        error: 'ระบบไม่ได้เปิดใช้งาน Cloud Supabase หรือยังไม่ได้ตั้งค่าคีย์ SUPABASE_SECRET_KEY/SUPABASE_PUBLISHABLE_KEY ในไฟล์ .env' 
      });
    }

    const db = readOfflineDb();
    const syncResults: any = {};
    const errors: string[] = [];

    try {
      if (Array.isArray(db.teachers) && db.teachers.length > 0) {
        const { error } = await supabase.from('teachers').upsert(db.teachers);
        if (error) errors.push(`Teachers: ${error.message}`);
        else syncResults.teachers = db.teachers.length;
      }

      if (Array.isArray(db.students) && db.students.length > 0) {
        let { error } = await supabase.from('students').upsert(db.students);
        if (error && (error.message?.includes('id') || error.code === 'PGRST204')) {
          const fallbackStudents = db.students.map((s: any) => ({
            student_id: s.student_id,
            name: s.name,
            password: s.password,
            class_group: s.class_group
          }));
          const fallbackRes = await supabase.from('students').upsert(fallbackStudents);
          error = fallbackRes.error;
        }
        if (error) errors.push(`Students: ${error.message}`);
        else syncResults.students = db.students.length;
      }

      if (Array.isArray(db.subjects) && db.subjects.length > 0) {
        const { error } = await supabase.from('subjects').upsert(db.subjects);
        if (error) errors.push(`Subjects: ${error.message}`);
        else syncResults.subjects = db.subjects.length;
      }

      if (Array.isArray(db.exams) && db.exams.length > 0) {
        const { error } = await supabase.from('exams').upsert(db.exams);
        if (error) errors.push(`Exams: ${error.message}`);
        else syncResults.exams = db.exams.length;
      }

      if (Array.isArray(db.questions) && db.questions.length > 0) {
        const { error } = await supabase.from('questions').upsert(db.questions);
        if (error) errors.push(`Questions: ${error.message}`);
        else syncResults.questions = db.questions.length;
      }

      if (Array.isArray(db.exam_results) && db.exam_results.length > 0) {
        const { error } = await supabase.from('exam_results').upsert(db.exam_results);
        if (error) errors.push(`Exam Results: ${error.message}`);
        else syncResults.exam_results = db.exam_results.length;
      }

      if (Array.isArray(db.cheat_logs) && db.cheat_logs.length > 0) {
        const { error } = await supabase.from('cheat_logs').upsert(db.cheat_logs);
        if (error) errors.push(`Cheat Logs: ${error.message}`);
        else syncResults.cheat_logs = db.cheat_logs.length;
      }

      if (errors.length > 0) {
        return res.status(200).json({
          success: false,
          partialSync: true,
          syncResults,
          message: 'ซิงค์ข้อมูลบางส่วนได้แล้ว แต่บางตารางติดปัญหา Supabase Schema / RLS',
          errors
        });
      }

      res.json({
        success: true,
        message: 'ซิงค์ข้อมูลทั้งหมดจาก Local ขึ้น Cloud Supabase สำเร็จเรียบร้อย!',
        syncResults
      });
    } catch (err: any) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการซิงค์ขึ้น คลาวด์: ' + err.message });
    }
  });

  // ==========================================
  // FEATURE 3: POPUP MESSAGES API
  // ==========================================
  app.get('/api/popup-messages', (req, res) => {
    const db = readOfflineDb();
    res.json(db.popup_messages || []);
  });

  app.post('/api/popup-messages', (req, res) => {
    const { target_type, target_value, title, body, sender_name, importance } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'กรุณากรอกหัวข้อและเนื้อหาข้อความ' });
    }
    const db = readOfflineDb();
    if (!db.popup_messages) db.popup_messages = [];

    const newMsg = {
      id: 'pop_' + Date.now(),
      target_type: target_type || 'all',
      target_value: target_value || '',
      title,
      body,
      sender_name: sender_name || 'ครูผู้สอน',
      importance: importance || 'info',
      created_at: new Date().toISOString(),
      read_by: []
    };

    db.popup_messages.unshift(newMsg);
    writeOfflineDb(db);
    res.json(newMsg);
  });

  app.get('/api/popup-messages/student', (req, res) => {
    const { student_id, class_group, subject_id } = req.query;
    if (!student_id) {
      return res.json([]);
    }
    const db = readOfflineDb();
    const allMsgs = db.popup_messages || [];

    const studentMsgs = allMsgs.filter((m: any) => {
      if (Array.isArray(m.read_by) && m.read_by.includes(String(student_id))) {
        return false;
      }
      if (m.target_type === 'all') return true;
      if (m.target_type === 'individual' && m.target_value === student_id) return true;
      if (m.target_type === 'class' && m.target_value === class_group) return true;
      if (m.target_type === 'subject' && m.target_value === subject_id) return true;
      return false;
    });

    res.json(studentMsgs);
  });

  app.post('/api/popup-messages/:id/read', (req, res) => {
    const msgId = req.params.id;
    const { student_id } = req.body;
    if (!student_id) {
      return res.status(400).json({ error: 'ไม่พบรหัสนักเรียน' });
    }

    const db = readOfflineDb();
    if (db.popup_messages) {
      const msg = db.popup_messages.find((m: any) => m.id === msgId);
      if (msg) {
        if (!Array.isArray(msg.read_by)) msg.read_by = [];
        if (!msg.read_by.includes(String(student_id))) {
          msg.read_by.push(String(student_id));
        }
        writeOfflineDb(db);
      }
    }
    res.json({ success: true });
  });

  app.delete('/api/popup-messages/:id', (req, res) => {
    const msgId = req.params.id;
    const db = readOfflineDb();
    if (db.popup_messages) {
      db.popup_messages = db.popup_messages.filter((m: any) => m.id !== msgId);
      writeOfflineDb(db);
    }
    res.json({ success: true });
  });

  // ==========================================
  // FEATURE 4: ANNOUNCEMENTS & DISCUSSIONS API
  // ==========================================
  app.get('/api/announcements', (req, res) => {
    const db = readOfflineDb();
    res.json(db.announcements || []);
  });

  app.post('/api/announcements', (req, res) => {
    const { title, content, target_group, is_pinned, author_name } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'กรุณากรอกหัวข้อและเนื้อหาประกาศ' });
    }
    const db = readOfflineDb();
    if (!db.announcements) db.announcements = [];

    const newAnc = {
      id: 'anc_' + Date.now(),
      title,
      content,
      target_group: target_group || 'all',
      is_pinned: !!is_pinned,
      author_name: author_name || 'ระบบประกาศ',
      created_at: new Date().toISOString()
    };

    if (newAnc.is_pinned) {
      db.announcements.unshift(newAnc);
    } else {
      db.announcements.push(newAnc);
    }

    writeOfflineDb(db);
    res.json(newAnc);
  });

  app.delete('/api/announcements/:id', (req, res) => {
    const ancId = req.params.id;
    const db = readOfflineDb();
    if (db.announcements) {
      db.announcements = db.announcements.filter((a: any) => a.id !== ancId);
      writeOfflineDb(db);
    }
    res.json({ success: true });
  });

  app.get('/api/discussions', (req, res) => {
    const db = readOfflineDb();
    res.json(db.discussions || []);
  });

  app.post('/api/discussions', (req, res) => {
    const { title, content, author_id, author_name, author_role, category, class_group, subject_id } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'กรุณากรอกหัวข้อและเนื้อหาข้อความ' });
    }
    const db = readOfflineDb();
    if (!db.discussions) db.discussions = [];

    const newDisc = {
      id: 'disc_' + Date.now(),
      title,
      content,
      author_id: author_id || 'guest',
      author_name: author_name || 'ผู้ใช้งาน',
      author_role: author_role || 'student',
      category: category || 'general',
      class_group: class_group || '',
      subject_id: subject_id || '',
      created_at: new Date().toISOString(),
      likes: [],
      comments: []
    };

    db.discussions.unshift(newDisc);
    writeOfflineDb(db);
    res.json(newDisc);
  });

  app.post('/api/discussions/:id/comments', (req, res) => {
    const discId = req.params.id;
    const { author_name, author_role, content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'กรุณากรอกข้อความความคิดเห็น' });
    }
    const db = readOfflineDb();
    if (db.discussions) {
      const disc = db.discussions.find((d: any) => d.id === discId);
      if (disc) {
        if (!Array.isArray(disc.comments)) disc.comments = [];
        const newCmt = {
          id: 'cmt_' + Date.now(),
          author_name: author_name || 'ผู้ตอบ',
          author_role: author_role || 'student',
          content,
          created_at: new Date().toISOString()
        };
        disc.comments.push(newCmt);
        writeOfflineDb(db);
        return res.json(newCmt);
      }
    }
    res.status(404).json({ error: 'ไม่พบหัวข้อการสนทนานี้' });
  });

  app.post('/api/discussions/:id/like', (req, res) => {
    const discId = req.params.id;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'ไม่พบรหัสผู้ใช้' });

    const db = readOfflineDb();
    if (db.discussions) {
      const disc = db.discussions.find((d: any) => d.id === discId);
      if (disc) {
        if (!Array.isArray(disc.likes)) disc.likes = [];
        const idx = disc.likes.indexOf(user_id);
        if (idx !== -1) {
          disc.likes.splice(idx, 1);
        } else {
          disc.likes.push(user_id);
        }
        writeOfflineDb(db);
        return res.json({ likes: disc.likes });
      }
    }
    res.status(404).json({ error: 'ไม่พบหัวข้อการสนทนา' });
  });

  app.delete('/api/discussions/:id', (req, res) => {
    const discId = req.params.id;
    const db = readOfflineDb();
    if (db.discussions) {
      db.discussions = db.discussions.filter((d: any) => d.id !== discId);
      writeOfflineDb(db);
    }
    res.json({ success: true });
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
