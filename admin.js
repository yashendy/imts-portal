import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

// حماية الصفحة: التأكد من تسجيل الدخول
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // لو مفيش مستخدم، ارجع فوراً لصفحة اللوجين
        window.location.href = "login.html";
    }
});

// إضافة وظيفة تسجيل الخروج (اختياري لزرار الخروج)
window.logout = () => signOut(auth);
