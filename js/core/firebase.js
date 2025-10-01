// /js/core/firebase.js
// Firebase bootstrap (ESM) — SDK v12.2.0

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-app.js";
import {
  getAuth, setPersistence, browserSessionPersistence, GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";
import {
  getFirestore, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-functions.js";

// مشروعك: imts-4b827
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrkmrX8SWy4rFbpWnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.firebasestorage.app",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGWJ9V"
};

// تهيئة آمنة
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

export { serverTimestamp, httpsCallable, onAuthStateChanged };

// جلسة على مستوى التبويب
setPersistence(auth, browserSessionPersistence).catch(() => {});

// (اختياري) كشف الخدمات لسكريبتات غير module
if (typeof window !== "undefined") {
  window.firebaseServices = Object.freeze({ app, auth, db, functions, googleProvider, serverTimestamp, httpsCallable, onAuthStateChanged });
}
