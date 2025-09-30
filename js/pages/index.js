// js/index.js
import { auth, db } from "js/core/firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";

/* -------------------- عناصر الواجهة -------------------- */
const els = {
  form: document.getElementById("authForm"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  btnSubmit: document.getElementById("btnSubmit"),
  btnGoogle: document.getElementById("btnGoogle"),
  lnkForgot: document.getElementById("lnkForgot"),
  lnkInvite: document.getElementById("lnkInvite"),
  msg: document.getElementById("msg"),
  toggleText: document.getElementById("toggleText"),
  btnToggleMode: document.getElementById("btnToggleMode"),
};

let mode = "login"; // or "signup"
setMode(mode);

/* -------------------- أدوات صغيرة -------------------- */
function showMsg(text, type="ok"){
  if(!els.msg) return;
  els.msg.textContent = text;
  els.msg.className = `msg show ${type}`;
}
function clearMsg(){ els.msg.className = "msg"; els.msg.textContent = ""; }

function getInviteCodeFromUrl(){
  const code = new URLSearchParams(location.search).get("code");
  if (code) sessionStorage.setItem("pendingInviteCode", code);
  return code || sessionStorage.getItem("pendingInviteCode") || "";
}
function goActivate(withCode){
  const code = withCode || getInviteCodeFromUrl();
  sessionStorage.removeItem("pendingInviteCode");
  location.href = `activate.html${code ? `?code=${encodeURIComponent(code)}` : ""}`;
}
function routeByRole(role){
  if (!role) { goActivate(); return; }
  const r = String(role).toLowerCase();
  if (r === "owner" || r === "admin") {
    location.href = "admin-dashboard.html";
  } else if (r === "teacher") {
    // لاحقًا: teacher-dashboard.html
    showMsg("تم تسجيل الدخول كمعلّم. إذا لم تُسند لك فصول بعد، تواصل مع الإدارة.", "ok");
  } else {
    goActivate();
  }
}
async function fetchUserRole(uid){
  try{
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data().role || null) : null;
  }catch{
    return null;
  }
}
function setMode(next){
  mode = next;
  if (mode === "login") {
    els.btnSubmit.textContent = "دخول";
    els.toggleText.textContent = "مستخدم جديد؟";
    els.btnToggleMode.textContent = "إنشاء حساب";
  } else {
    els.btnSubmit.textContent = "إنشاء حساب";
    els.toggleText.textContent = "لديك حساب؟";
    els.btnToggleMode.textContent = "تسجيل الدخول";
  }
}

/* -------------------- سلوك الصفحة -------------------- */
onAuthStateChanged(auth, async (user) => {
  // لو المستخدم دخل بالفعل
  if (user) {
    const code = getInviteCodeFromUrl();
    if (code) { goActivate(code); return; }
    const role = await fetchUserRole(user.uid);
    routeByRole(role);
  }
});

els.btnToggleMode?.addEventListener("click", () => {
  clearMsg();
  setMode(mode === "login" ? "signup" : "login");
});

els.form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const email = (els.email.value || "").trim();
  const password = els.password.value || "";

  if (!email || !password) { showMsg("من فضلك أدخل البريد وكلمة المرور.", "warn"); return; }

  try{
    if (mode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged سيتكفّل بالتحويل بعد الدخول
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      showMsg("تم إنشاء الحساب وتسجيل الدخول بنجاح.", "ok");
      // سيحوّل حسب الدور أو لصفحة التفعيل
    }
  }catch(err){
    const m = mapAuthError(err?.code);
    showMsg(m, "err");
  }
});

els.btnGoogle?.addEventListener("click", async ()=>{
  clearMsg();
  try{
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    // onAuthStateChanged سيتكفّل بالتحويل
  }catch(err){
    const m = mapAuthError(err?.code);
    showMsg(m, "err");
  }
});

els.lnkForgot?.addEventListener("click", async (e)=>{
  e.preventDefault();
  clearMsg();
  const email = (els.email.value || "").trim();
  if (!email) { showMsg("اكتب بريدك أولاً ثم اضغط استعادة.", "warn"); return; }
  try{
    await sendPasswordResetEmail(auth, email);
    showMsg("تم إرسال رابط استعادة كلمة المرور إلى بريدك.", "ok");
  }catch(err){
    showMsg(mapAuthError(err?.code), "err");
  }
});

/* -------------------- تحويل أخطاء Firebase لرسائل عربية -------------------- */
function mapAuthError(code=""){
  const c = String(code||"").toLowerCase();
  if (c.includes("invalid-credential") || c.includes("user-not-found") || c.includes("wrong-password"))
    return "بيانات الدخول غير صحيحة. جرّب الدخول بجوجل أو أنشئ حسابًا جديدًا.";
  if (c.includes("email-already-in-use"))
    return "هذا البريد مسجّل مسبقًا. استخدم تسجيل الدخول أو استعادة كلمة المرور.";
  if (c.includes("weak-password"))
    return "كلمة المرور ضعيفة. اختر كلمة مرور لا تقل عن 6 رموز.";
  if (c.includes("popup-closed-by-user"))
    return "تم إغلاق نافذة جوجل قبل إتمام الدخول.";
  if (c.includes("network-request-failed"))
    return "تعذّر الاتصال بالشبكة. تحقّق من الإنترنت وحاول مجددًا.";
  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}
