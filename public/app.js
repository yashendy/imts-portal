// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// إعدادات مشروعك
const firebaseConfig = {
  apiKey: "AIzaSyAk3r0OSq3NwvBjHpsNlGYb-dJWUmA9Azc",
  authDomain: "imts-portal.firebaseapp.com",
  projectId: "imts-portal",
  storageBucket: "imts-portal.firebasestorage.app",
  messagingSenderId: "819773792022",
  appId: "1:819773792022:web:58d92078d752959b5dba37",
  measurementId: "G-P9JK5KMDWL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

console.log("✅ Firebase تم تهيئته بنجاح", app);
