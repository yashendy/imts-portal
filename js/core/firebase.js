// /js/core/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

// 👇 انسخ إعدادات مشروعك هنا
const firebaseConfig = {
  apiKey:        "YOUR_API_KEY",
  authDomain:    "YOUR_PROJECT.firebaseapp.com",
  projectId:     "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId:         "1:000000000000:web:xxxxxxxxxxxxxx"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const functions = getFunctions(app);
export { httpsCallable, serverTimestamp };

export const googleProvider = new GoogleAuthProvider();
