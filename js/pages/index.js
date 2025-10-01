// /js/pages/index.js
import { auth, db, googleProvider } from "../core/firebase.js";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* عناصر الواجهة */
const els = {
  formLogin: document.getElementById("formLogin"),
  inputEmail: document.getElementById("email"),
  inputPassword: document.getElementById("password"),
  btnLoginGoogle: document.getElementById("btnLoginGoogle"),
  linkForgot: document.getElementById("linkForgot"),
  alertBox: document.getElementById("alertBox"),
};

const ROLE_ROUTES = {
  admin: "admin-dashboard.html",
  teacher: "teacher-dashboard.html",
};

/* أدوات واجهة */
function showMsg(msg, type = "error") {
  if (!els.alertBox) return;
  els.alertBox.textContent = msg || (type === "ok" ? "تم." : "حدث خطأ غير متوقع.");
  els.alertBox.style.display = "block";
  els.alertBox.style.background = type === "ok" ? "#ecfdf5" : "#fee2e2";
  els.alertBox.style.color = type === "ok" ? "#065f46" : "#7f1d1d";
}
function hideMsg() { if (els.alertBox) els.alertBox.style.display = "none"; }
function mapAuthError(code = "") {
  const c = (code || "").toLowerCase();
  if (c.includes("invalid-credential") || c.includes("user-not-found") || c.includes("wrong-password")) return "بيانات الدخول غير صحيحة.";
  if (c.includes("email-already-in-use")) return "هذا البريد مسجّل مسبقًا.";
  if (c.includes("weak-password")) return "كلمة المرور ضعيفة.";
  if (c.includes("popup-closed-by-user")) return "أغلقت نافذة جوجل قبل إتمام العملية.";
  if (c.includes("network-request-failed")) return "تعذّر الاتصال بالشبكة.";
  if (c.includes("unauthorized-domain")) return "الدومين غير مُصرّح به في Firebase (Authorized domains).";
  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

/* إنشاء وثيقة المستخدم في الجذر إن لم تكن موجودة (بدون role) */
async function ensureUserDocExists(uid, email, displayName) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: email || null,
      displayName: displayName || null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await updateDoc(ref, { updatedAt: new Date() }).catch(() => {});
  }
}

/* قراءة الدور */
async function fetchUserRole(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().role || null) : null;
}

/* توجيه حسب الدور */
function routeByRole(role) {
  if (!role) return (window.location.href = "activate.html");
  window.location.href = ROLE_ROUTES[role] || "admin-dashboard.html";
}

/* تسجيل بالإيميل/باسورد */
els.formLogin?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();
  try {
    const email = els.inputEmail.value.trim();
    const password = els.inputPassword.value;
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDocExists(user.uid, user.email, user.displayName);
    const role = await fetchUserRole(user.uid);
    routeByRole(role);
  } catch (err) {
    showMsg(mapAuthError(err.code || err.message));
  }
});

/* تسجيل بجوجل */
els.btnLoginGoogle?.addEventListener("click", async () => {
  hideMsg();
  try {
    const { user } = await signInWithPopup(auth, googleProvider);
    await ensureUserDocExists(user.uid, user.email, user.displayName);
    const role = await fetchUserRole(user.uid);
    routeByRole(role);
  } catch (err) {
    showMsg(mapAuthError(err.code || err.message));
  }
});

/* إعادة تعيين كلمة مرور */
els.linkForgot?.addEventListener("click", async (e) => {
  e.preventDefault();
  hideMsg();
  try {
    const email = els.inputEmail.value.trim();
    if (!email) return showMsg("اكتب بريدك الإلكتروني أولًا.");
    await sendPasswordResetEmail(auth, email);
    showMsg("تم إرسال رابط إعادة التعيين لبريدك.", "ok");
  } catch (err) {
    showMsg(mapAuthError(err.code || err.message));
  }
});

/* مراقبة حالة الجلسة */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    await ensureUserDocExists(user.uid, user.email, user.displayName);
    const role = await fetchUserRole(user.uid);
    routeByRole(role);
  } catch (err) {
    console.warn(err);
  }
});
