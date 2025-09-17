// js/firebase.js
// تحميل SDKs من الـ CDN على هيئة ES Modules
import { initializeApp }   from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth }         from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore }    from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
// (اختياري) Analytics لو حبيت تستخدمه لاحقًا
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";

// إعدادات مشروعك (التي أرسلتها)
const firebaseConfig = {
  apiKey: "AIzaSyAk3r0OSq3NwvBjHpsNlGYb-dJWUmA9Azc",
  authDomain: "imts-portal.firebaseapp.com",
  projectId: "imts-portal",
  storageBucket: "imts-portal.firebasestorage.app",
  messagingSenderId: "819773792022",
  appId: "1:819773792022:web:58d92078d752959b5dba37",
  measurementId: "G-P9JK5KMDWL"
};

// تهيئة التطبيق
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
// (اختياري)
// export const analytics = getAnalytics(app);
