// js/firebase.js
// Unified Firebase bootstrap (project: imts-4b827) — SDK v12 modular

// NOTE: include this file with: <script type="module" src="js/firebase.js"></script>
// Other (non-module) scripts can access services via: window.firebaseServices

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-app.js";
import { getAuth, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-storage.js";

// ---- Project config (imts-4b827)
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrkmrX8SWy4rFbpWnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.firebasestorage.app",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGWJ9V"
};

// ---- Safe (re)initialization
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ---- Core services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Persist auth in the current tab only (matches our sessionStorage strategy)
setPersistence(auth, browserSessionPersistence).catch(() => { /* no-op */ });

// ---- Exports (ESM + global for non-module scripts)
export { app, auth, db, storage, serverTimestamp };

// Also expose on window for regular <script> consumers
// (allows legacy files like index.js / admin-dashboard.js to use window.firebaseServices.*)
window.firebaseServices = Object.freeze({ app, auth, db, storage, serverTimestamp });
