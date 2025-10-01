// /js/pages/activate.js
import { auth, db, functions, httpsCallable } from "../core/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const els = {
  alertBox: document.getElementById("alertBox"),
  form: document.getElementById("formActivate"),
  input: document.getElementById("inviteCode"),
};

function msg(text, type = "error") {
  els.alertBox.textContent = text || (type === "ok" ? "تم." : "حدث خطأ.");
  els.alertBox.style.display = "block";
  els.alertBox.style.background = type === "ok" ? "#ecfdf5" : "#fee2e2";
  els.alertBox.style.color = type === "ok" ? "#065f46" : "#7f1d1d";
}
function clearMsg() { els.alertBox.style.display = "none"; }

// املأ الكود من الـ URL إن وجد
const urlCode = new URLSearchParams(location.search).get("code");
if (urlCode) els.input.value = urlCode;

let currentUser = null;
onAuthStateChanged(auth, (u) => {
  if (!u) { location.href = "index.html"; return; }
  currentUser = u;
});

els.form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();
  try {
    const code = (els.input.value || "").trim();
    if (!code) return msg("من فضلك أدخل كود الدعوة.");

    const acceptInvite = httpsCallable(functions, "acceptInvite");
    await acceptInvite({ code });

    // ريفريش للتوكن ثم اقرأ الدور
    await currentUser.getIdToken(true);
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    const role = snap.exists() ? (snap.data().role || null) : null;

    if (role) {
      msg("تم تفعيل حسابك! سيتم توجيهك…", "ok");
      setTimeout(() => {
        if (role === "admin") location.href = "admin-dashboard.html";
        else if (role === "teacher") location.href = "teacher-dashboard.html";
        else location.href = "admin-dashboard.html";
      }, 900);
    } else {
      msg("تمت العملية لكن لم يُحدّث الدور. أعد تحميل الصفحة.");
    }
  } catch (err) {
    const code = (err.code || "").toLowerCase();
    if (code.includes("failed-precondition")) return msg("يرجى تسجيل الدخول أولًا.");
    if (code.includes("permission-denied")) return msg("غير مسموح باستخدام هذا الكود.");
    const m = String(err?.message || "");
    if (m.includes("INVALID_CODE")) return msg("كود الدعوة غير صحيح.");
    if (m.includes("EXPIRED_CODE")) return msg("انتهت صلاحية الكود.");
    if (m.includes("ALREADY_USED")) return msg("تم استخدام الكود من قبل.");
    msg("تعذر التفعيل. حاول مرة أخرى.");
    console.warn(err);
  }
});
