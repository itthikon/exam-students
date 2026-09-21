import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForDevelopment123456',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'exam-77ad9.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'exam-77ad9',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'exam-77ad9.appspot.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: env.VITE_FIREBASE_APP_ID || '1:123456:web:abcdef'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;

