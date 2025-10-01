// /js/firebase.js
// Firebase bootstrap (ESM) — SDK v12.2.0
// يعمل على GitHub Pages بدون أي سكربتات إضافية

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-functions.js";

// ⬇️ إعدادات مشروعك (imts-4b827)
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrkmrX8SWy4rFbpWnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.firebasestorage.app",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGWJ9V"
};

// ✅ تهيئة آمنة (لو الملف اتحمّل مرتين ما يعيدش التهيئة)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Core services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Providers & helpers
export const googleProvider = new GoogleAuthProvider();
export { serverTimestamp, httpsCallable };

// اجعل الجلسة محفوظة على مستوى التبويب فقط (يوافق استخدام sessionStorage)
setPersistence(auth, browserSessionPersistence).catch(() => { /* no-op */ });

// (اختياري) تعريض الخدمات لـ window لاستخدام سكربتات غير module
if (typeof window !== "undefined") {
  window.firebaseServices = Object.freeze({
    app, auth, db, storage, functions,
    googleProvider, serverTimestamp, httpsCallable
  });
}
