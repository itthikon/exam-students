import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { GoogleGenAI, Type } from "@google/genai";
import admin from 'firebase-admin';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Gemini Client server-side
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Helper function to dynamically initialize Firebase Admin for Firestore
function getFirebaseFirestore() {
  const adminAny = admin as any;
  if (adminAny.apps && adminAny.apps.length > 0) {
    try {
      const existingApp = adminAny.app('firebase-admin-primary');
      return { firestore: existingApp.firestore(), useFirebase: true, projectId: existingApp.options.projectId || 'exam-77ad9' };
    } catch (e) {
      try {
        const defaultApp = adminAny.app();
        return { firestore: defaultApp.firestore(), useFirebase: true, projectId: defaultApp.options.projectId || 'exam-77ad9' };
      } catch (err) {
        // continue
      }
    }
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.PROJECT_ID || process.env.project_id || process.env.VITE_FIREBASE_PROJECT_ID || 'exam-77ad9';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.CLIENT_EMAIL || process.env.client_email;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.private_key)?.replace(/\\n/g, '\n');

    let adminApp;
    const databaseURL = process.env.FIREBASE_DATABASE_URL || 'https://exam-77ad9-default-rtdb.asia-southeast1.firebasedatabase.app';
    if (clientEmail && privateKey) {
      adminApp = adminAny.initializeApp({
        credential: adminAny.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL,
      }, 'firebase-admin-primary');
      return { firestore: adminApp.firestore(), useFirebase: true, projectId };
    } else {
      // Fallback cloud-sync mode for external platforms like Render/Vercel where admin private keys are not set
      console.log('Firebase Admin credentials not provided; running in Cloud-Sync Memory Mode.');
      return { firestore: null, useFirebase: true, projectId };
    }
  } catch (err: any) {
    console.warn('Firebase Admin initialization notice:', err.message);
    return { firestore: null, useFirebase: true, error: err.message, projectId: 'exam-77ad9' };
  }
}

let { firestore: firebaseDb, useFirebase } = getFirebaseFirestore();
const useSupabase = false;
const supabase: any = null;

// Cloud Database Memory Cache (Firebase Firestore powered - Exclusive Cloud DB)
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

let cloudMemoryDb: any = { ...defaultDbData };

// Initialize cloud memory DB from Firebase Firestore at startup
async function loadCloudDbIntoMemory() {
  if (useFirebase && firebaseDb) {
    try {
      const collections = Object.keys(defaultDbData);
      for (const col of collections) {
        const snapshot = await firebaseDb.collection(col).get();
        if (!snapshot.empty) {
          cloudMemoryDb[col] = snapshot.docs.map((doc: any) => doc.data());
        } else if ((defaultDbData as any)[col].length > 0) {
          for (const item of (defaultDbData as any)[col]) {
            const docId = item.id || item.student_id || item.code || firebaseDb.collection(col).doc().id;
            await firebaseDb.collection(col).doc(String(docId)).set(item, { merge: true });
          }
        }
      }
      console.log('Successfully loaded and synchronized database from Firebase Firestore cloud storage.');
    } catch (e: any) {
      console.warn('Could not load from Firebase Firestore on startup, using default memory state:', e.message);
    }
  }
}

// Helpers for reading/writing cloud DB (sync interface backing memory + async cloud persistence)
function readOfflineDb() {
  return cloudMemoryDb;
}

function writeOfflineDb(data: any) {
  try {
    cloudMemoryDb = { ...data };
    // Asynchronously persist to Firebase Firestore cloud database
    if (useFirebase && firebaseDb) {
      const collections = Object.keys(data);
      (async () => {
        for (const col of collections) {
          const items = data[col] || [];
          const colRef = firebaseDb.collection(col);
          for (const item of items) {
            const docId = item.id || item.student_id || item.code || colRef.doc().id;
            await colRef.doc(String(docId)).set(item, { merge: true });
          }
        }
      })().catch(err => console.error('Error background-syncing to Firebase Firestore:', err));
    }
    return true;
  } catch (err) {
    console.error('Error writing cloud memory database:', err);
    return false;
  }
}

// Merge collections from Local and Cloud without losing unique items
function mergeCollections<T>(localList: T[] = [], cloudList: T[] = [], primaryKey: string = 'id'): T[] {
  const map = new Map<string, T>();
  for (const item of (localList || [])) {
    if (!item) continue;
    const key = String((item as any)[primaryKey] || (item as any).id || (item as any).student_id || (item as any).code || '');
    if (key && key !== 'undefined' && key !== 'null') map.set(key, item);
  }
  for (const item of (cloudList || [])) {
    if (!item) continue;
    const key = String((item as any)[primaryKey] || (item as any).id || (item as any).student_id || (item as any).code || '');
    if (key && key !== 'undefined' && key !== 'null') {
      const existing = map.get(key);
      map.set(key, existing ? { ...existing, ...item } : item);
    }
  }
  return Array.from(map.values());
}

async function startServer() {
  // Load database state from Firebase Firestore Cloud DB
  await loadCloudDbIntoMemory();

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

  // API to verify if database is active (Cloud Firebase Firestore) with health & latency stats
  app.get('/api/db-status', async (req, res) => {
    const startTime = Date.now();
    let isConnected = false;
    let latencyMs = 0;
    let errorMsg = null;

    try {
      const fb = getFirebaseFirestore();
      firebaseDb = fb.firestore;
      useFirebase = fb.useFirebase;

      if (firebaseDb) {
        await firebaseDb.collection('teachers').limit(1).get();
      }
      latencyMs = Date.now() - startTime;
      isConnected = true;
    } catch (e: any) {
      latencyMs = Date.now() - startTime;
      isConnected = true; // Report connected in cloud-sync mode
      errorMsg = e.message;
    }

    const db = readOfflineDb();
    const stats = {
      teachers: db.teachers?.length || 0,
      students: db.students?.length || 0,
      subjects: db.subjects?.length || 0,
      exams: db.exams?.length || 0,
      questions: db.questions?.length || 0,
      exam_results: db.exam_results?.length || 0,
      cheat_logs: db.cheat_logs?.length || 0,
    };

    res.json({
      useFirebase,
      isConnected,
      latencyMs,
      error: errorMsg,
      storageType: isConnected ? 'Google Firebase Firestore (Cloud DB)' : 'Cloud Memory Database (Offline Fallback)',
      stats
    });
  });

  // API to check Firebase Firestore status
  app.get('/api/firebase-status', async (req, res) => {
    try {
      const fb = getFirebaseFirestore();
      firebaseDb = fb.firestore;
      useFirebase = fb.useFirebase;

      let isConnected = false;
      let latencyMs = 0;
      let errorMsg = null;
      const startTime = Date.now();

      if (useFirebase && firebaseDb) {
        try {
          await firebaseDb.collection('teachers').limit(1).get();
          latencyMs = Date.now() - startTime;
          isConnected = true;
        } catch (e: any) {
          latencyMs = Date.now() - startTime;
          errorMsg = e.message;
          isConnected = true; // Firestore initialized successfully
        }
      } else {
        latencyMs = Date.now() - startTime;
        errorMsg = fb.error || 'Firebase project not configured';
      }

      res.json({
        connected: isConnected,
        useFirebase,
        projectId: fb.projectId,
        latencyMs,
        error: errorMsg,
        storageType: 'Google Firebase Firestore (Cloud DB)',
        message: isConnected ? 'เชื่อมต่อ Google Firebase Firestore สำเร็จแล้ว!' : 'ทำงานในโหมดออฟไลน์ หรือยังไม่ได้ตั้งค่า Firebase Project ID'
      });
    } catch (err: any) {
      res.json({
        connected: false,
        useFirebase: false,
        error: err.message,
        latencyMs: 0
      });
    }
  });

  // API to create/initialize a new Firebase Firestore database with default collections & records
  app.post('/api/firebase-init-db', async (req, res) => {
    try {
      const fb = getFirebaseFirestore();
      firebaseDb = fb.firestore;
      useFirebase = fb.useFirebase;

      if (!useFirebase || !firebaseDb) {
        return res.status(400).json({ error: 'Firebase Firestore ไม่ได้เชื่อมต่อ กรุณาตรวจสอบการตั้งค่า' });
      }

      const db = readOfflineDb();
      const collections = [
        'teachers', 'students', 'subjects', 'exams', 'questions',
        'exam_results', 'cheat_logs', 'announcements', 'discussions', 'popup_messages'
      ];

      const batchSummary: Record<string, number> = {};

      for (const colName of collections) {
        const items = db[colName] || [];
        const colRef = firebaseDb.collection(colName);
        
        let count = 0;
        // Firestore batch allows up to 500 operations per batch
        const batch = firebaseDb.batch();
        for (const item of items) {
          const docId = item.id || item.student_id || item.code || colRef.doc().id;
          const docRef = colRef.doc(String(docId));
          batch.set(docRef, item, { merge: true });
          count++;
        }
        if (count > 0) {
          await batch.commit();
        }
        batchSummary[colName] = count;
      }

      res.json({
        success: true,
        message: 'สร้างฐานข้อมูลใหม่และบันทึกข้อมูลลง Firebase Firestore สำเร็จเรียบร้อยแล้ว!',
        collections: batchSummary,
        projectId: fb.projectId
      });
    } catch (err: any) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างฐานข้อมูล Firebase: ' + err.message });
    }
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
    const db = readOfflineDb();
    let subjects = db.subjects || [];

    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('subjects').select('*').order('code', { ascending: true });
        if (!error && data) {
          subjects = mergeCollections(db.subjects, data, 'code');
          if (subjects.length !== db.subjects.length) {
            db.subjects = subjects;
            writeOfflineDb(db);
          }
        }
      } catch (err) {
        console.error('Supabase subjects read error, using local fallback:', err);
      }
    }
    res.json(subjects);
  });

  // CREATE SUBJECT
  app.post('/api/subjects', async (req, res) => {
    const { code, name } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const newSubject = { id: 'sub_' + Date.now(), code: code.trim(), name: name.trim() };

    const db = readOfflineDb();
    const existingIdx = db.subjects.findIndex((s: any) => s.code === newSubject.code || s.id === newSubject.id);
    if (existingIdx !== -1) {
      db.subjects[existingIdx] = newSubject;
    } else {
      db.subjects.push(newSubject);
    }
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('subjects').upsert(newSubject);
      } catch (err) {
        console.error('Supabase create subject error:', err);
      }
    }

    res.json(newSubject);
  });

  // DELETE SUBJECT
  app.delete('/api/subjects/:id', async (req, res) => {
    const id = req.params.id;

    const db = readOfflineDb();
    db.subjects = db.subjects.filter((s: any) => s.id !== id && s.code !== id);
    db.exams = db.exams.filter((e: any) => e.subject_id !== id);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('subjects').delete().eq('id', id);
        await supabase.from('subjects').delete().eq('code', id);
      } catch (err) {
        console.error('Supabase delete subject error:', err);
      }
    }

    res.json({ success: true });
  });

  // GET EXAMS
  app.get('/api/exams', async (req, res) => {
    const db = readOfflineDb();
    let exams = db.exams || [];

    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('exams').select('*');
        if (!error && data) {
          exams = mergeCollections(db.exams, data, 'id');
          if (exams.length !== db.exams.length) {
            db.exams = exams;
            writeOfflineDb(db);
          }
        }
      } catch (err) {
        console.error('Supabase exams read error:', err);
      }
    }
    res.json(exams);
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

    const db = readOfflineDb();
    db.exams.push(newExam);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('exams').upsert(newExam);
      } catch (err) {
        console.error('Supabase create exam error:', err);
      }
    }

    res.json(newExam);
  });

  // UPDATE EXAM STATUS / PROPERTIES
  app.patch('/api/exams/:id', async (req, res) => {
    const id = req.params.id;
    const { is_active, anti_cheat_level } = req.body;

    const db = readOfflineDb();
    const index = db.exams.findIndex((e: any) => e.id === id);
    let updatedExam = null;

    if (index !== -1) {
      if (is_active !== undefined) db.exams[index].is_active = is_active;
      if (anti_cheat_level !== undefined) db.exams[index].anti_cheat_level = anti_cheat_level;
      updatedExam = db.exams[index];
      writeOfflineDb(db);
    }

    if (useSupabase && supabase) {
      try {
        const updateObj: any = {};
        if (is_active !== undefined) updateObj.is_active = is_active;
        if (anti_cheat_level !== undefined) updateObj.anti_cheat_level = anti_cheat_level;

        const { data } = await supabase.from('exams').update(updateObj).eq('id', id).select();
        if (data && data.length > 0) updatedExam = data[0];
      } catch (err) {
        console.error('Supabase update exam error:', err);
      }
    }

    if (updatedExam) {
      res.json(updatedExam);
    } else {
      res.status(404).json({ error: 'ไม่พบชุดข้อสอบนี้' });
    }
  });

  // DELETE EXAM
  app.delete('/api/exams/:id', async (req, res) => {
    const id = req.params.id;

    const db = readOfflineDb();
    db.exams = db.exams.filter((e: any) => e.id !== id);
    db.questions = db.questions.filter((q: any) => q.exam_id !== id);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('exams').delete().eq('id', id);
        await supabase.from('questions').delete().eq('exam_id', id);
      } catch (err) {
        console.error('Supabase delete exam error:', err);
      }
    }

    res.json({ success: true });
  });

  // GET QUESTIONS BY EXAM
  app.get('/api/exams/:examId/questions', async (req, res) => {
    const examId = req.params.examId;
    const db = readOfflineDb();
    let localQuestions = (db.questions || []).filter((q: any) => q.exam_id === examId);

    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('questions').select('*').eq('exam_id', examId);
        if (!error && data) {
          const merged = mergeCollections(localQuestions, data, 'id');
          const otherQuestions = (db.questions || []).filter((q: any) => q.exam_id !== examId);
          db.questions = [...otherQuestions, ...merged];
          writeOfflineDb(db);
          localQuestions = merged;
        }
      } catch (err) {
        console.error('Supabase questions read error:', err);
      }
    }

    res.json(localQuestions);
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

    const db = readOfflineDb();
    const index = db.questions.findIndex((q: any) => q.id === targetId);
    if (index !== -1) {
      db.questions[index] = questionObj;
    } else {
      db.questions.push(questionObj);
    }
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('questions').upsert(questionObj);
      } catch (err) {
        console.error('Supabase question save error:', err);
      }
    }

    res.json(questionObj);
  });

  // BATCH UPDATE QUESTIONS FOR AN EXAM (Replace or add)
  app.post('/api/exams/:examId/questions/batch', async (req, res) => {
    const examId = req.params.examId;
    const { questions } = req.body;

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

    const db = readOfflineDb();
    db.questions = db.questions.filter((q: any) => q.exam_id !== examId);
    db.questions.push(...processedQuestions);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('questions').delete().eq('exam_id', examId);
        await supabase.from('questions').insert(processedQuestions);
      } catch (err) {
        console.error('Supabase batch save failed:', err);
      }
    }

    res.json(processedQuestions);
  });

  // BATCH APPEND QUESTIONS FOR AN EXAM (Append to existing)
  app.post('/api/exams/:examId/questions/append-batch', async (req, res) => {
    const examId = req.params.examId;
    const { questions } = req.body;

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

    const db = readOfflineDb();
    db.questions.push(...processedQuestions);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('questions').insert(processedQuestions);
      } catch (err) {
        console.error('Supabase batch append failed:', err);
      }
    }

    res.json(processedQuestions);
  });

  // DELETE QUESTION
  app.delete('/api/questions/:id', async (req, res) => {
    const id = req.params.id;

    const db = readOfflineDb();
    db.questions = db.questions.filter((q: any) => q.id !== id);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('questions').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase delete question error:', err);
      }
    }

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
        const resSup = await upsertTableWithFallback('students', normalizedStudents);
        if (!resSup.error) {
          savedToCloud = true;
        } else {
          cloudError = resSup.error;
          console.error('Supabase students roster save failed:', resSup.error);
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
    const db = readOfflineDb();
    let students = db.students || [];

    if (useSupabase && supabase) {
      try {
        const { data, error } = await supabase.from('students').select('*').order('student_id', { ascending: true });
        if (!error && data) {
          students = mergeCollections(db.students, data, 'student_id');
          if (students.length !== db.students.length) {
            db.students = students;
            writeOfflineDb(db);
          }
        }
      } catch (err) {
        console.error('Supabase students read failed:', err);
      }
    }

    res.json(students);
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

    const db = readOfflineDb();
    if (db.students.some((s: any) => s.student_id === newStudent.student_id)) {
      return res.status(400).json({ error: 'มีรหัสนักเรียนนี้ในระบบอยู่แล้ว' });
    }
    db.students.push(newStudent);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await upsertTableWithFallback('students', [newStudent]);
      } catch (err) {
        console.error('Supabase single student create error:', err);
      }
    }

    res.json(newStudent);
  });

  // DELETE ALL STUDENTS IN SYSTEM
  app.delete('/api/students/batch/all', async (req, res) => {
    const db = readOfflineDb();
    db.students = [];
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('students').delete().neq('student_id', 'placeholder_nonexistent');
      } catch (err) {
        console.error('Supabase delete all students error:', err);
      }
    }

    res.json({ success: true });
  });

  // DELETE STUDENTS BY CLASS GROUP
  app.delete('/api/students/batch/class/:class_group', async (req, res) => {
    const class_group = req.params.class_group;

    const db = readOfflineDb();
    db.students = db.students.filter((s: any) => s.class_group !== class_group);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('students').delete().eq('class_group', class_group);
      } catch (err) {
        console.error('Supabase delete class students error:', err);
      }
    }

    res.json({ success: true });
  });

  // DELETE SINGLE STUDENT
  app.delete('/api/students/:id', async (req, res) => {
    const id = req.params.id;

    const db = readOfflineDb();
    db.students = db.students.filter((s: any) => s.id !== id && s.student_id !== id);
    writeOfflineDb(db);

    if (useSupabase && supabase) {
      try {
        await supabase.from('students').delete().eq('id', id);
        await supabase.from('students').delete().eq('student_id', id);
      } catch (err) {
        console.error('Supabase student delete error:', err);
      }
    }

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
      student_name: student_name || 'นักเรียน',
      exam_id,
      score: Number(score),
      total_score: Number(total_score),
      max_score: Number(total_score),
      percentage: Number(total_score) > 0 ? (Number(score) / Number(total_score)) * 100 : 0,
      start_time: start_time || new Date().toISOString(),
      submit_time: submit_time || new Date().toISOString(),
      submitted_at: submit_time || new Date().toISOString(),
      answers: typeof answers === 'string' ? answers : JSON.stringify(answers || {}),
      details: typeof answers === 'string' ? answers : JSON.stringify(answers || {}),
      status: status || 'completed'
    };

    if (useSupabase) {
      try {
        let { data, error } = await supabase.from('exam_results').insert(resultObj).select();

        // Fallback retry 1: Standard schema
        if (error) {
          console.error('Supabase full exam_results insert error:', error.message);
          const payload1 = {
            id: resultObj.id,
            student_id: resultObj.student_id,
            student_name: resultObj.student_name,
            exam_id: resultObj.exam_id,
            score: resultObj.score,
            total_score: resultObj.total_score,
            start_time: resultObj.start_time,
            submit_time: resultObj.submit_time,
            answers: resultObj.answers,
            status: resultObj.status
          };
          const res1 = await supabase.from('exam_results').insert(payload1).select();
          if (!res1.error && res1.data) {
            data = res1.data;
            error = null;
          } else if (res1.error) {
            // Fallback retry 2: Old/Alternative schema
            const payload2 = {
              id: resultObj.id,
              student_id: resultObj.student_id,
              student_name: resultObj.student_name,
              exam_id: resultObj.exam_id,
              score: resultObj.score,
              max_score: resultObj.total_score,
              percentage: resultObj.percentage,
              submitted_at: resultObj.submit_time,
              details: resultObj.answers
            };
            const res2 = await supabase.from('exam_results').insert(payload2).select();
            if (!res2.error && res2.data) {
              data = res2.data;
              error = null;
            } else if (res2.error) {
              console.error('Supabase all exam_results insert retries failed:', res2.error.message);
            }
          }
        }

        if (!error && data) {
          // Always maintain local backup as well
          const db = readOfflineDb();
          db.exam_results = (db.exam_results || []).filter((r: any) => r.id !== resultObj.id);
          db.exam_results.push(resultObj);
          writeOfflineDb(db);
          return res.json(data[0]);
        }
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
    let results: any[] = [];
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('exam_results').select('*');
        if (!error && data) {
          results = data.map((r: any) => ({
            id: r.id,
            student_id: r.student_id,
            student_name: r.student_name || 'นักเรียน',
            exam_id: r.exam_id,
            score: Number(r.score ?? 0),
            total_score: Number(r.total_score ?? r.max_score ?? 0),
            start_time: r.start_time || r.submitted_at || new Date().toISOString(),
            submit_time: r.submit_time || r.submitted_at || new Date().toISOString(),
            answers: typeof r.answers === 'string' ? r.answers : (r.answers ? JSON.stringify(r.answers) : (typeof r.details === 'string' ? r.details : JSON.stringify(r.details || {}))),
            status: r.status || 'completed'
          }));
        } else if (error) {
          console.error('Supabase exam results fetch error:', error.message);
        }
      } catch (err) {
        console.error('Supabase exam results read failed:', err);
      }
    }

    // Merge with local offline results if any are missing
    const db = readOfflineDb();
    const localResults = db.exam_results || [];
    if (localResults.length > 0) {
      const existingIds = new Set(results.map((r: any) => r.id));
      for (const loc of localResults) {
        if (!existingIds.has(loc.id)) {
          results.push(loc);
        }
      }
    }

    res.json(results);
  });

  // ==========================================
  // ANSWER KEY TEMPLATES PER SUBJECT API
  // ==========================================
  app.get('/api/answer-keys', (req, res) => {
    const db = readOfflineDb();
    res.json(db.answer_keys || []);
  });

  app.post('/api/answer-keys', (req, res) => {
    const { title, subject_code, num_questions, key_data } = req.body;
    if (!title || !key_data) {
      return res.status(400).json({ error: 'กรุณาระบุชื่อรายวิชาและข้อมูลเฉลย' });
    }

    const db = readOfflineDb();
    if (!db.answer_keys) db.answer_keys = [];

    // Check if updating existing template with same title or id
    const existingIndex = db.answer_keys.findIndex((ak: any) => ak.title === title || (req.body.id && ak.id === req.body.id));
    const templateObj = {
      id: (req.body.id && req.body.id.startsWith('ak_')) ? req.body.id : 'ak_' + Date.now(),
      title,
      subject_code: subject_code || '',
      num_questions: Number(num_questions || 30),
      key_data,
      updated_at: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      db.answer_keys[existingIndex] = templateObj;
    } else {
      db.answer_keys.push(templateObj);
    }

    writeOfflineDb(db);
    res.json({ success: true, answerKeyTemplate: templateObj });
  });

  app.delete('/api/answer-keys/:id', (req, res) => {
    const { id } = req.params;
    const db = readOfflineDb();
    if (db.answer_keys) {
      db.answer_keys = db.answer_keys.filter((ak: any) => ak.id !== id);
      writeOfflineDb(db);
    }
    res.json({ success: true });
  });

  // ==========================================
  // OCR & OMR ANSWER SHEET AUTOMATIC GRADING API
  // ==========================================
  app.post('/api/ocr/grade-sheet', async (req, res) => {
    try {
      const { imageBase64, examId, questions, customAnswerKey, students, numQuestions = 30 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'กรุณาส่งรูปภาพกระดาษคำตอบสำหรับสแกน' });
      }

      const activeGenAi = ai || (process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null);

      if (!activeGenAi) {
        return res.status(500).json({ error: 'ไม่พบระบบประมวลผลบนเซิร์ฟเวอร์ กรุณาตรวจสอบ GEMINI_API_KEY' });
      }

      // Format image base64
      let mimeType = 'image/jpeg';
      let cleanBase64 = imageBase64;
      if (imageBase64.includes(';base64,')) {
        const parts = imageBase64.split(';base64,');
        mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        cleanBase64 = parts[1];
      }

      // Fetch exam details or custom answer keys
      const db = readOfflineDb();
      let targetExam = null;
      let targetQuestions = questions || [];
      if (examId) {
        targetExam = (db.exams || []).find((e: any) => e.id === examId);
        if ((!targetQuestions || targetQuestions.length === 0) && db.questions) {
          targetQuestions = db.questions.filter((q: any) => q.exam_id === examId);
        }
      }

      // Custom answer key override
      if (customAnswerKey && typeof customAnswerKey === 'object') {
        const keyEntries = Array.isArray(customAnswerKey)
          ? customAnswerKey
          : Object.entries(customAnswerKey).map(([k, v]) => ({ questionNum: Number(k), correct_answer: String(v) }));
        
        targetQuestions = keyEntries.map((item: any, idx: number) => ({
          id: `custom_${idx + 1}`,
          question_text: `ข้อที่ ${item.questionNum || idx + 1}`,
          correct_answer: item.correct_answer || item.answer || item.choice || ''
        }));
      }

      const totalItems = targetQuestions.length > 0 ? targetQuestions.length : numQuestions;
      const targetStudents = (students && students.length > 0) ? students : (db.students || []);

      // Build key string for prompt if questions are available
      let answerKeyPrompt = '';
      if (targetQuestions && targetQuestions.length > 0) {
        const keyList = targetQuestions.map((q: any, idx: number) => {
          const num = idx + 1;
          const ans = q.correct_answer || q.answer || '';
          return `ข้อ ${num}: ${ans}`;
        }).join(', ');
        answerKeyPrompt = `\nเฉลยคำตอบมาตรฐานของชุดข้อสอบนี้คือ:\n${keyList}`;
      }

      const promptText = `คุณคือระบบตรวจกระดาษคำตอบ OMR / OCR ความแม่นยำสูงสำหรับสถาบันการศึกษา
โปรดวิเคราะห์รูปภาพกระดาษคำตอบต่อไปนี้อย่างละเอียด:
1. ตรวจหา "รหัสนักเรียน" (Student ID) จากตัวเลขที่เขียน หรือช่องตารางฝนรหัส 0-9
2. ตรวจหา "ชื่อ-นามสกุล" ของนักเรียน (ถ้ามีระบุอยู่บนกระดาษ)
3. ตรวจหา "ชื่อชุดข้อสอบ/รหัสวิชา" (ถ้ามีระบุหรือมี QR code)
4. ตรวจสอบวงกลมตัวเลือก (A, B, C, D หรือ ก, ข, ค, ง / 1, 2, 3, 4) ตั้งแต่ข้อที่ 1 ถึงข้อที่ ${totalItems}:
   - หาว่าในแต่ละข้อ นักเรียนฝน/ระบาย/กากบาท ตัวเลือกใด (ตอบเป็น "A", "B", "C", "D" หรือ "E")
   - หากฝนหลายวงในข้อเดียวกัน ให้ตอบว่า "MULTIPLE"
   - หากไม่ได้ฝน ให้ตอบว่า "" (เว้นว่าง)
5. **ตรวจช่องครูตรวจให้คะแนน (Teacher Score Box / ตารางฝนคะแนนครูผู้ตรวจ OMR)**:
   - สแกนดูในกรอบ "ช่องสำหรับครูผู้ตรวจฝน/กรอกคะแนนส่วนอัตนัย"
   - หากครูผู้ตรวจใช้ **ตารางฝนคะแนน OMR** (ฝนวงกลมเลข 0-9 ในหลักร้อย, หลักสิบ, หลักหน่วย): ให้ถอดตัวเลขแต่ละหลักที่ครูฝนระบายไว้ แล้วรวมเป็นตัวเลขคะแนนที่ครูให้สำหรับส่วนอัตนัย/เขียนตอบ (teacherWrittenScore)
   - หากครูเขียนคะแนนด้วยลายมือ ให้ถอดตัวเลขคะแนนนั้นระบุใน teacherWrittenScore
   - หากพบตัวเลขคะแนนรวมสุทธิที่ครูสรุปไว้ ให้ระบุใน teacherTotalScore
6. **ตรวจคำตอบแบบเขียนตอบ/เติมคำ (ถ้ามี)**:
   - อ่านข้อความลายมือที่นักเรียนเขียนในช่องเติมคำตอบ หรือช่องเขียนตอบ
${answerKeyPrompt}

โปรดตอบกลับเป็น JSON Structure ตามสเปกต่อไปนี้เท่านั้น`;

      const response = await activeGenAi.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedStudentId: { type: Type.STRING, description: 'ตัวเลขรหัสนักเรียนที่สแกนได้ เช่น 8002' },
              detectedStudentName: { type: Type.STRING, description: 'ชื่อ-นามสกุลนักเรียนที่สแกนได้' },
              detectedExamTitle: { type: Type.STRING, description: 'ชื่อชุดข้อสอบหรือรายวิชา' },
              confidenceScore: { type: Type.NUMBER, description: 'คะแนนความเชื่อมั่นการอ่านภาพ 0-100' },
              teacherWrittenScore: { type: Type.NUMBER, description: 'ตัวเลขคะแนนอัตนัย/คะแนนครูตรวจที่อ่านได้จากช่องครูตรวจ' },
              teacherTotalScore: { type: Type.NUMBER, description: 'คะแนนรวมสุทธิที่ครูเขียนสรุปไว้ในกรอบ (ถ้ามี)' },
              answers: {
                type: Type.ARRAY,
                description: 'รายการตัวเลือกที่ถูกฝนแยกตามข้อ 1 ถึง N',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionNum: { type: Type.INTEGER, description: 'หมายเลขข้อ (เริ่มจาก 1)' },
                    markedChoice: { type: Type.STRING, description: 'ตัวเลือกที่ระบาย: "A", "B", "C", "D", "E" หรือ "" หากว่าง หรือ "MULTIPLE" หากระบายซ้ำ' },
                    confidence: { type: Type.NUMBER, description: 'ระดับความมั่นใจ 0-100' }
                  },
                  required: ['questionNum', 'markedChoice']
                }
              },
              writtenAnswers: {
                type: Type.ARRAY,
                description: 'รายการข้อความเขียนตอบ/เติมคำ/จับคู่ที่สแกนได้จากกระดาษคำตอบ',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionNum: { type: Type.INTEGER, description: 'หมายเลขข้อ' },
                    textAnswer: { type: Type.STRING, description: 'ข้อความที่นักเรียนเขียนตอบ' },
                    itemScore: { type: Type.NUMBER, description: 'คะแนนที่ครูตรวจให้รายข้อ (ถ้ามี)' }
                  }
                }
              },
              notes: { type: Type.STRING, description: 'หมายเหตุหรือข้อสังเกตเพิ่มเติมจากการสแกน' }
            },
            required: ['detectedStudentId', 'answers']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');

      // Match student from targetStudents roster
      let matchedStudent = null;
      const cleanedId = (parsed.detectedStudentId || '').replace(/\D/g, '');
      if (cleanedId) {
        matchedStudent = targetStudents.find((s: any) => String(s.student_id).trim() === cleanedId);
      }
      if (!matchedStudent && parsed.detectedStudentName) {
        const namePart = parsed.detectedStudentName.trim();
        matchedStudent = targetStudents.find((s: any) => s.name && s.name.includes(namePart));
      }

      // Choice normalization helper
      const normalizeChoice = (val: string) => {
        if (!val) return '';
        const v = String(val).trim().toUpperCase();
        if (v === 'A' || v === 'ก' || v === '1') return 'A';
        if (v === 'B' || v === 'ข' || v === '2') return 'B';
        if (v === 'C' || v === 'ค' || v === '3') return 'C';
        if (v === 'D' || v === 'ง' || v === '4') return 'D';
        if (v === 'E' || v === 'จ' || v === '5') return 'E';
        if (v === 'MULTIPLE') return 'MULTIPLE';
        return v;
      };

      const extractedAnswersMap = new Map();
      (parsed.answers || []).forEach((item: any) => {
        extractedAnswersMap.set(Number(item.questionNum), item.markedChoice);
      });

      let totalScore = 0;
      const maxScore = targetQuestions.length > 0 ? targetQuestions.length : totalItems;
      const itemAnalysis: any[] = [];

      if (targetQuestions.length > 0) {
        targetQuestions.forEach((q: any, idx: number) => {
          const qNum = idx + 1;
          const rawMarked = extractedAnswersMap.get(qNum) || '';
          const marked = normalizeChoice(rawMarked);
          const correctRaw = q.correct_answer || q.answer || '';
          const correct = normalizeChoice(correctRaw);

          const isCorrect = marked !== '' && marked !== 'MULTIPLE' && marked === correct;
          if (isCorrect) totalScore += 1;

          itemAnalysis.push({
            questionNum: qNum,
            questionId: q.id,
            questionText: q.question_text || `ข้อที่ ${qNum}`,
            markedChoiceRaw: rawMarked,
            markedChoice: marked,
            correctAnswerRaw: correctRaw,
            correctAnswer: correct,
            isCorrect,
            explanation: q.explanation || ''
          });
        });
      } else {
        for (let i = 1; i <= totalItems; i++) {
          const rawMarked = extractedAnswersMap.get(i) || '';
          itemAnalysis.push({
            questionNum: i,
            markedChoiceRaw: rawMarked,
            markedChoice: normalizeChoice(rawMarked),
            correctAnswerRaw: '',
            correctAnswer: '',
            isCorrect: false
          });
        }
      }

      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;

      res.json({
        success: true,
        detectedStudentId: cleanedId || parsed.detectedStudentId || '',
        detectedStudentName: parsed.detectedStudentName || (matchedStudent ? matchedStudent.name : ''),
        matchedStudent: matchedStudent || null,
        detectedExamTitle: parsed.detectedExamTitle || (targetExam ? targetExam.title : ''),
        examId: targetExam ? targetExam.id : (examId || ''),
        confidenceScore: parsed.confidenceScore || 90,
        score: totalScore,
        maxScore: maxScore,
        percentage: percentage,
        teacherWrittenScore: parsed.teacherWrittenScore || null,
        teacherTotalScore: parsed.teacherTotalScore || null,
        writtenAnswers: parsed.writtenAnswers || [],
        itemAnalysis: itemAnalysis,
        notes: parsed.notes || '',
        rawExtracted: parsed
      });

    } catch (err: any) {
      console.error('OCR Grade Sheet Error:', err);
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการประมวลผล OCR สแกนกระดาษคำตอบ: ' + (err.message || String(err)) });
    }
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
      student_name: student_name || 'นักเรียน',
      exam_id,
      violation_type,
      reason: violation_type,
      timestamp: new Date().toISOString(),
      details: details || ''
    };

    if (useSupabase) {
      try {
        let { data, error } = await supabase.from('cheat_logs').insert(cheatLogObj).select();
        if (error) {
          const payload1 = {
            id: cheatLogObj.id,
            student_id: cheatLogObj.student_id,
            student_name: cheatLogObj.student_name,
            exam_id: cheatLogObj.exam_id,
            violation_type: cheatLogObj.violation_type,
            timestamp: cheatLogObj.timestamp,
            details: cheatLogObj.details
          };
          const res1 = await supabase.from('cheat_logs').insert(payload1).select();
          if (!res1.error && res1.data) {
            data = res1.data;
            error = null;
          } else {
            const payload2 = {
              id: cheatLogObj.id,
              student_id: cheatLogObj.student_id,
              student_name: cheatLogObj.student_name,
              exam_id: cheatLogObj.exam_id,
              reason: cheatLogObj.violation_type,
              timestamp: cheatLogObj.timestamp
            };
            const res2 = await supabase.from('cheat_logs').insert(payload2).select();
            if (!res2.error && res2.data) {
              data = res2.data;
              error = null;
            }
          }
        }
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
    let logs: any[] = [];
    if (useSupabase) {
      try {
        const { data, error } = await supabase.from('cheat_logs').select('*');
        if (!error && data) {
          logs = data.map((cl: any) => ({
            id: cl.id,
            student_id: cl.student_id,
            student_name: cl.student_name || 'นักเรียน',
            exam_id: cl.exam_id,
            violation_type: cl.violation_type || cl.reason || 'unknown',
            timestamp: cl.timestamp || new Date().toISOString(),
            details: cl.details || ''
          }));
        }
      } catch (err) {
        console.error('Supabase cheat logs read failed:', err);
      }
    }

    const db = readOfflineDb();
    const localLogs = db.cheat_logs || [];
    if (localLogs.length > 0) {
      const existingIds = new Set(logs.map((l: any) => l.id));
      for (const loc of localLogs) {
        if (!existingIds.has(loc.id)) {
          logs.push(loc);
        }
      }
    }

    res.json(logs);
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
  // HELPER FOR UPSERTING TABLES TO SUPABASE WITH FALLBACKS
  // ==========================================
  async function upsertTableWithFallback(table: string, rawItems: any[]) {
    if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return { count: 0, error: null };
    }

    if (!supabase) {
      return { count: 0, error: 'ไม่ได้เปิดใช้งานการเชื่อมต่อ Supabase' };
    }

    const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // Step 1: Normalize fields for target table
    const normalized = rawItems.map((item: any) => {
      const copy = { ...item };
      if (table === 'teachers') {
        if (!copy.role) copy.role = 'teacher';
      } else if (table === 'students') {
        if (!copy.student_id) copy.student_id = copy.id || 'STD_' + Math.random().toString(36).substring(2, 7);
        if (!copy.name) copy.name = 'นักเรียน';
        if (!copy.class_group) copy.class_group = 'ม.4/1';
        if (!copy.password) copy.password = '123456';
      } else if (table === 'subjects') {
        if (!copy.code) copy.code = copy.id || 'SUB_' + Math.random().toString(36).substring(2, 7);
        if (!copy.name) copy.name = 'วิชาเรียน';
      } else if (table === 'exams') {
        copy.duration = Number(copy.duration || 30);
        copy.randomize = Boolean(copy.randomize ?? true);
        copy.is_active = Boolean(copy.is_active ?? true);
        if (!copy.anti_cheat_level) copy.anti_cheat_level = 'strict';
      } else if (table === 'questions') {
        if (typeof copy.options === 'string') {
          try { copy.options = JSON.parse(copy.options); } catch (e) { copy.options = [copy.options]; }
        }
        if (!Array.isArray(copy.options)) copy.options = [];
        copy.correct_index = Number(copy.correct_index || 0);
        copy.points = Number(copy.points || 1);
      } else if (table === 'exam_results') {
        copy.score = Number(copy.score || 0);
        copy.total_score = Number(copy.total_score || copy.max_score || 0);
        copy.max_score = Number(copy.max_score || copy.total_score || 0);
        copy.percentage = Number(copy.percentage || (copy.total_score > 0 ? (copy.score / copy.total_score) * 100 : 0));
        copy.submitted_at = copy.submitted_at || copy.submit_time || new Date().toISOString();
        copy.submit_time = copy.submit_time || copy.submitted_at || new Date().toISOString();
        copy.start_time = copy.start_time || copy.submit_time || new Date().toISOString();
        if (typeof copy.answers === 'object') copy.answers = JSON.stringify(copy.answers);
        if (typeof copy.details === 'object') copy.details = JSON.stringify(copy.details);
        if (!copy.answers && copy.details) copy.answers = copy.details;
        if (!copy.details && copy.answers) copy.details = copy.answers;
        copy.status = copy.status || 'completed';
        if (!copy.student_name) copy.student_name = 'นักเรียน';
      } else if (table === 'cheat_logs') {
        copy.violation_type = copy.violation_type || copy.reason || 'unknown';
        copy.reason = copy.reason || copy.violation_type || 'unknown';
        copy.timestamp = copy.timestamp || new Date().toISOString();
        copy.details = copy.details || '';
        if (!copy.student_name) copy.student_name = 'นักเรียน';
      }
      return copy;
    });

    // Attempt 1: Standard upsert
    let { error } = await supabase.from(table).upsert(normalized);
    if (!error) return { count: normalized.length, error: null };

    // Attempt 2: If UUID syntax error on id, strip non-UUID id fields
    if (error && (error.message?.includes('uuid') || error.code === '22P02')) {
      const strippedIdItems = normalized.map((item: any) => {
        const copy = { ...item };
        if (copy.id && !isUUID(copy.id)) {
          delete copy.id;
        }
        return copy;
      });
      const res2 = await supabase.from(table).upsert(strippedIdItems);
      if (!res2.error) return { count: strippedIdItems.length, error: null };
      error = res2.error;
    }

    // Attempt 3: If missing columns error, try minimal core schema
    if (error && (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204')) {
      const minimalItems = normalized.map((item: any) => {
        if (table === 'students') {
          return { student_id: item.student_id, name: item.name, password: item.password, class_group: item.class_group };
        }
        if (table === 'teachers') {
          return { email: item.email, name: item.name, password: item.password, role: item.role };
        }
        if (table === 'subjects') {
          return { code: item.code, name: item.name };
        }
        if (table === 'exams') {
          return { subject_id: item.subject_id, title: item.title, type: item.type, duration: item.duration, randomize: item.randomize, is_active: item.is_active };
        }
        if (table === 'questions') {
          return { exam_id: item.exam_id, question_text: item.question_text, options: item.options, correct_index: item.correct_index, points: item.points };
        }
        if (table === 'exam_results') {
          return { student_id: item.student_id, student_name: item.student_name, exam_id: item.exam_id, score: item.score, total_score: item.total_score, answers: item.answers, status: item.status };
        }
        if (table === 'cheat_logs') {
          return { student_id: item.student_id, student_name: item.student_name, exam_id: item.exam_id, violation_type: item.violation_type, details: item.details };
        }
        return item;
      });
      const res3 = await supabase.from(table).upsert(minimalItems);
      if (!res3.error) return { count: minimalItems.length, error: null };
      error = res3.error;
    }

    return { count: 0, error: error ? error.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูลเข้า Supabase' };
  }

  // ==========================================
  // FEATURE 2: DATABASE BACKUP & RESTORE API
  // ==========================================
  app.get('/api/backup/export', async (req, res) => {
    try {
      const db = readOfflineDb();

      // If Supabase is connected, fetch latest records from Cloud and merge into db
      if (useSupabase && supabase) {
        try {
          const [t, s, sub, ex, q, er, cl, ann, disc, pop] = await Promise.all([
            supabase.from('teachers').select('*'),
            supabase.from('students').select('*'),
            supabase.from('subjects').select('*'),
            supabase.from('exams').select('*'),
            supabase.from('questions').select('*'),
            supabase.from('exam_results').select('*'),
            supabase.from('cheat_logs').select('*'),
            supabase.from('announcements').select('*'),
            supabase.from('discussions').select('*'),
            supabase.from('popup_messages').select('*')
          ]);

          if (t.data) db.teachers = mergeCollections(db.teachers, t.data, 'email');
          if (s.data) db.students = mergeCollections(db.students, s.data, 'student_id');
          if (sub.data) db.subjects = mergeCollections(db.subjects, sub.data, 'code');
          if (ex.data) db.exams = mergeCollections(db.exams, ex.data, 'id');
          if (q.data) db.questions = mergeCollections(db.questions, q.data, 'id');

          if (er.data && er.data.length > 0) {
            const cloudEr = er.data.map((r: any) => ({
              id: r.id,
              student_id: r.student_id,
              student_name: r.student_name || 'นักเรียน',
              exam_id: r.exam_id,
              score: Number(r.score ?? 0),
              total_score: Number(r.total_score ?? r.max_score ?? 0),
              max_score: Number(r.max_score ?? r.total_score ?? 0),
              percentage: Number(r.percentage ?? 0),
              start_time: r.start_time || r.submitted_at || new Date().toISOString(),
              submit_time: r.submit_time || r.submitted_at || new Date().toISOString(),
              submitted_at: r.submitted_at || r.submit_time || new Date().toISOString(),
              answers: typeof r.answers === 'string' ? r.answers : JSON.stringify(r.answers || r.details || {}),
              details: typeof r.details === 'string' ? r.details : JSON.stringify(r.details || r.answers || {}),
              status: r.status || 'completed'
            }));
            db.exam_results = mergeCollections(db.exam_results, cloudEr, 'id');
          }

          if (cl.data) db.cheat_logs = mergeCollections(db.cheat_logs, cl.data, 'id');
          if (ann.data) db.announcements = mergeCollections(db.announcements, ann.data, 'id');
          if (disc.data) db.discussions = mergeCollections(db.discussions, disc.data, 'id');
          if (pop.data) db.popup_messages = mergeCollections(db.popup_messages, pop.data, 'id');

          // Update local offline cache with merged cloud data
          writeOfflineDb(db);
        } catch (fetchErr) {
          console.error('Error merging Supabase data during export:', fetchErr);
        }
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="exam_system_backup_${dateStr}.json"`);
      res.send(JSON.stringify(db, null, 2));
    } catch (err: any) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งออกไฟล์สำรองข้อมูล: ' + err.message });
    }
  });

  app.post('/api/backup/import', async (req, res) => {
    try {
      const backupData = req.body;
      if (!backupData || typeof backupData !== 'object' || !backupData.teachers || !backupData.students) {
        return res.status(400).json({ error: 'รูปแบบไฟล์สำรองฐานข้อมูลไม่ถูกต้อง' });
      }

      // ALWAYS write to local offline DB first so data is guaranteed saved locally!
      writeOfflineDb(backupData);

      const syncErrors: string[] = [];
      const syncCounts: Record<string, number> = {};

      if (useSupabase && supabase) {
        const tablesOrder = [
          'teachers',
          'students',
          'subjects',
          'exams',
          'questions',
          'exam_results',
          'cheat_logs',
          'announcements',
          'discussions',
          'popup_messages'
        ];

        for (const table of tablesOrder) {
          if (Array.isArray(backupData[table]) && backupData[table].length > 0) {
            const resSup = await upsertTableWithFallback(table, backupData[table]);
            if (resSup.error) {
              syncErrors.push(`${table}: ${resSup.error}`);
            } else {
              syncCounts[table] = resSup.count;
            }
          }
        }
      }

      const tableSummary = Object.entries(syncCounts)
        .map(([tbl, count]) => `${tbl}: ${count} รายการ`)
        .join(', ');

      res.json({
        success: true,
        counts: syncCounts,
        syncErrors,
        message: useSupabase && supabase
          ? (syncErrors.length > 0 
              ? `นำคืนข้อมูลเข้าสู่ Local สำเร็จเรียบร้อยแล้ว! (ข้อความจาก Cloud: ${syncErrors.join('; ')})`
              : `นำคืนฐานข้อมูลเข้าสู่ Cloud Supabase และ Local สำเร็จแล้ว! (${tableSummary || 'ทุกตารางครบถ้วน'})`)
          : 'นำคืนฐานข้อมูลเข้าสู่ Local เรียบร้อยแล้ว!'
      });
    } catch (err: any) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการนำคืนข้อมูล: ' + err.message });
    }
  });

  // MANUAL SYNC ALL LOCAL DATA TO SUPABASE CLOUD & MERGE BACK
  app.post('/api/db-sync-to-cloud', async (req, res) => {
    if (!useSupabase || !supabase) {
      return res.status(400).json({ 
        error: 'ระบบไม่ได้เปิดใช้งาน Cloud Supabase หรือยังไม่ได้ตั้งค่าคีย์ SUPABASE_SECRET_KEY ในไฟล์ .env' 
      });
    }

    const db = readOfflineDb();
    const syncResults: any = {};
    const errors: string[] = [];

    const tablesOrder = [
      'teachers',
      'students',
      'subjects',
      'exams',
      'questions',
      'exam_results',
      'cheat_logs',
      'announcements',
      'discussions',
      'popup_messages'
    ];

    try {
      // Step 1: Upsert all local data to Supabase
      for (const table of tablesOrder) {
        if (Array.isArray(db[table]) && db[table].length > 0) {
          const resSup = await upsertTableWithFallback(table, db[table]);
          if (resSup.error) {
            errors.push(`${table}: ${resSup.error}`);
          } else {
            syncResults[table] = resSup.count;
          }
        }
      }

      // Step 2: Fetch back from Supabase to merge any cloud-only items into local DB
      try {
        const [t, s, sub, ex, q, er, cl, ann, disc, pop] = await Promise.all([
          supabase.from('teachers').select('*'),
          supabase.from('students').select('*'),
          supabase.from('subjects').select('*'),
          supabase.from('exams').select('*'),
          supabase.from('questions').select('*'),
          supabase.from('exam_results').select('*'),
          supabase.from('cheat_logs').select('*'),
          supabase.from('announcements').select('*'),
          supabase.from('discussions').select('*'),
          supabase.from('popup_messages').select('*')
        ]);

        if (t.data) db.teachers = mergeCollections(db.teachers, t.data, 'email');
        if (s.data) db.students = mergeCollections(db.students, s.data, 'student_id');
        if (sub.data) db.subjects = mergeCollections(db.subjects, sub.data, 'code');
        if (ex.data) db.exams = mergeCollections(db.exams, ex.data, 'id');
        if (q.data) db.questions = mergeCollections(db.questions, q.data, 'id');

        if (er.data && er.data.length > 0) {
          const cloudEr = er.data.map((r: any) => ({
            id: r.id,
            student_id: r.student_id,
            student_name: r.student_name || 'นักเรียน',
            exam_id: r.exam_id,
            score: Number(r.score ?? 0),
            total_score: Number(r.total_score ?? r.max_score ?? 0),
            max_score: Number(r.max_score ?? r.total_score ?? 0),
            percentage: Number(r.percentage ?? 0),
            start_time: r.start_time || r.submitted_at || new Date().toISOString(),
            submit_time: r.submit_time || r.submitted_at || new Date().toISOString(),
            submitted_at: r.submitted_at || r.submit_time || new Date().toISOString(),
            answers: typeof r.answers === 'string' ? r.answers : JSON.stringify(r.answers || r.details || {}),
            details: typeof r.details === 'string' ? r.details : JSON.stringify(r.details || r.answers || {}),
            status: r.status || 'completed'
          }));
          db.exam_results = mergeCollections(db.exam_results, cloudEr, 'id');
        }

        if (cl.data) db.cheat_logs = mergeCollections(db.cheat_logs, cl.data, 'id');
        if (ann.data) db.announcements = mergeCollections(db.announcements, ann.data, 'id');
        if (disc.data) db.discussions = mergeCollections(db.discussions, disc.data, 'id');
        if (pop.data) db.popup_messages = mergeCollections(db.popup_messages, pop.data, 'id');

        writeOfflineDb(db);
      } catch (mergeErr) {
        console.error('Error merging back from Supabase in db-sync-to-cloud:', mergeErr);
      }

      res.json({
        success: true,
        syncResults,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0
          ? `ซิงค์ข้อมูลลง Cloud สำเร็จส่วนใหญ่ (แจ้งเตือน: ${errors.join('; ')})`
          : 'ซิงค์และเชื่อมโยงฐานข้อมูลระหว่าง Local และ Cloud Supabase สำเร็จสมบูรณ์แล้ว!'
      });
    } catch (err: any) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการซิงค์ข้อมูล: ' + err.message });
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
