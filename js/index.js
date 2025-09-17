// js/index.js
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// عناصر DOM
const loginForm      = document.getElementById("loginForm");
const emailInput     = document.getElementById("loginEmail");
const passInput      = document.getElementById("loginPassword");
const loginBtn       = document.getElementById("loginBtn");
const loginMsg       = document.getElementById("loginMsg");
const goRegisterBtn  = document.getElementById("goRegisterBtn");
const goResultsBtn   = document.getElementById("goResultsBtn");
const rememberMe     = document.getElementById("rememberMe");

// تنقّل للأزرار الثابتة
goRegisterBtn?.addEventListener("click", () => {
  window.location.href = "teacher-register.html";
});

goResultsBtn?.addEventListener("click", () => {
  window.location.href = "results.html";
});

// وظائف صغيرة للمساعدة
function showMsg(type, text) {
  loginMsg.className = "msg " + (type || "info");
  loginMsg.textContent = text || "";
}

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginBtn.textContent = isLoading ? "جاري المعالجة..." : "دخول";
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg("info", "");
  const email = emailInput.value.trim();
  const pass  = passInput.value.trim();

  if (!email || !pass) {
    showMsg("err", "من فضلك أدخل البريد الإلكتروني وكلمة المرور.");
    return;
  }

  try {
    setLoading(true);

    // تسجيل الدخول
    const cred = await signInWithEmailAndPassword(auth, email, pass);

    // جلب مستند المستخدم لمعرفة الدور والحالة
    const userRef = doc(db, "users", cred.user.uid);
    const snap    = await getDoc(userRef);

    if (!snap.exists()) {
      showMsg("err", "لا توجد بيانات مرفقة بحسابك. راجع الإدارة.");
      setLoading(false);
      return;
    }

    const u = snap.data();

    // التحقق من الحالة
    if (u.status === "pending" || u.isActive === false) {
      showMsg("info", "حسابك قيد المراجعة من الإدارة. سيتم إشعارك عند التفعيل.");
      setLoading(false);
      return;
    }

    // التوجيه حسب الدور
    if (u.role === "admin") {
      showMsg("ok", "مرحبًا بك! تحويل إلى لوحة الإدارة...");
      window.location.href = "admin.html";
    } else if (u.role === "teacher") {
      showMsg("ok", "مرحبًا بك! تحويل إلى لوحة المعلم...");
      window.location.href = "teacher.html";
    } else {
      showMsg("err", "لا تملك صلاحية الدخول. راجع الإدارة.");
    }

  } catch (err) {
    // معالجة أخطاء Auth الشائعة برسائل عربية لطيفة
    let message = "تعذر تسجيل الدخول. تأكد من البيانات.";
    if (err.code === "auth/invalid-email")        message = "البريد الإلكتروني غير صالح.";
    if (err.code === "auth/user-not-found")       message = "المستخدم غير موجود.";
    if (err.code === "auth/wrong-password")       message = "كلمة المرور غير صحيحة.";
    if (err.code === "auth/too-many-requests")    message = "محاولات كثيرة. حاول لاحقًا.";
    showMsg("err", message);
  } finally {
    setLoading(false);
  }
});
