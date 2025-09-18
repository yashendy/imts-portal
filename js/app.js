// ----- Firebase (Modular via CDN) -----
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// === Config (من لقطة الشاشة) ===
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrkmrX8SWy4rFbpWnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.firebasestorage.app",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGWJ9V"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ----- Helpers -----
const $ = sel => document.querySelector(sel);
const showMsg = (txt, timeout = 5000) => {
  const m = $("#message");
  m.textContent = txt;
  m.classList.add("show");
  if (timeout) setTimeout(()=> m.classList.remove("show"), timeout);
};

const goByRole = (role) => {
  if (role === "owner" || role === "admin") window.location.href = "./admin.html";
  else if (role === "teacher") window.location.href = "./teacher.html";
  else window.location.href = "./";
};

// ----- Tabs -----
const tabLogin    = $("#tab-login");
const tabRegister = $("#tab-register");
const panelLogin  = $("#panel-login");
const panelReg    = $("#panel-register");

const activate = (which) => {
  const isLogin = which === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
  panelLogin.hidden = !isLogin;
  panelReg.hidden   = isLogin;
  panelLogin.classList.toggle("active", isLogin);
  panelReg.classList.toggle("active", !isLogin);
};

tabLogin.addEventListener("click",   ()=> activate("login"));
tabRegister.addEventListener("click",()=> activate("register"));

// ----- Login -----
$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");

  if (!email || !password) return showMsg("برجاء إدخال البريد وكلمة المرور.");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return showMsg("حسابك موجود لكن لم يُستكمل ملف المستخدم. تواصل مع المدير.");
    const data = userSnap.data();
    if (data.status && data.status !== "active") return showMsg("الحساب غير مفعّل. تواصل مع الإدارة.");
    goByRole(data.role || "teacher");
  } catch (err) {
    console.error(err);
    showMsg("فشل تسجيل الدخول: " + (err?.message || ""));
  }
});

// ----- Register (Invite Code) -----
$("#form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const code        = String(form.get("code") || "").trim();
  const displayName = String(form.get("displayName") || "").trim();
  const email       = String(form.get("email") || "").trim();
  const password    = String(form.get("password") || "");

  if (!code || !displayName || !email || !password) return showMsg("أكمل جميع الحقول.");

  try {
    // نقرأ الدعوة من invites/{code} (الـ code هو Document ID)
    const inviteRef = doc(db, "invites", code);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) return showMsg("كود الدعوة غير صحيح.");
    const invite = inviteSnap.data();

    // تحقق الصلاحية
    if (invite.active === false)        return showMsg("كود الدعوة غير فعّال.");
    if (invite.expiresAt?.toMillis && invite.expiresAt.toMillis() < Date.now())
      return showMsg("انتهت صلاحية كود الدعوة.");
    if (typeof invite.maxUses === "number" && typeof invite.usedCount === "number" && invite.usedCount >= invite.maxUses)
      return showMsg("تم استخدام كود الدعوة للحد الأقصى.");
    if (invite.allowedEmail && invite.allowedEmail !== email)
      return showMsg("هذا الكود مقيّد ببريد محدد. استخدم البريد الموافق للدعوة.");

    // إنشاء حساب
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    const uid = cred.user.uid;
    // كتابة users/{uid}
    await setDoc(doc(db, "users", uid), {
      displayName,
      email,
      role: invite.role || "teacher", // افتراضي teacher
      status: "active",
      createdAt: serverTimestamp()
    });

    // تحديث العدّاد وتعطيل الكود إذا وصل الحد
    await runTransaction(db, async (trx) => {
      const snap = await trx.get(inviteRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const current = Number(data.usedCount || 0) + 1;
      const payload = { usedCount: increment(1) };
      if (typeof data.maxUses === "number" && current >= data.maxUses) payload.active = false;
      trx.update(inviteRef, payload);
    });

    showMsg("تم إنشاء الحساب بنجاح. سيتم تحويلك…", 2500);
    // توجيه حسب الدور
    goByRole(invite.role || "teacher");
  } catch (err) {
    console.error(err);
    if (String(err?.message || "").includes("auth/email-already-in-use"))
      return showMsg("هذا البريد مستخدم بالفعل.");
    showMsg("تعذر إكمال التسجيل: " + (err?.message || ""));
  }
});

// Log ready
console.log("IMTS Auth Portal ready ✨");
