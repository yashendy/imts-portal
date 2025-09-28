// js/pages/index.js
// يعتمد على js/core/firebase.js + js/core/app.js
import { auth } from "../core/firebase.js";
import { getInstituteInfo, getUserDoc, toast, showLoader, hideLoader, signOutSafe } from "../core/app.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";

const els = {
  logo: document.querySelector("img.logo"),
  names: document.querySelectorAll(".institute-name"),
  email: document.getElementById("email"),
  password: document.getElementById("password"),
  btnLogin: document.getElementById("btnLogin"),
  form: document.getElementById("loginForm"),
  contactEmail: document.getElementById("contactEmail"),
  contactWhats: document.getElementById("contactWhats"),
  yearNow: document.getElementById("yearNow"),
  linkForgot: document.getElementById("linkForgot"),
  linkActivate: document.getElementById("linkActivate"),
};

function setYear() {
  if (els.yearNow) els.yearNow.textContent = new Date().getFullYear();
}

async function hydrateInstitute() {
  try {
    const institute = await getInstituteInfo();
    // الاسم في أماكن متعددة
    els.names?.forEach(n => n.textContent = institute?.name || "اسم المعهد");
    // الشعار
    if (els.logo && institute?.logoUrl) {
      els.logo.src = institute.logoUrl;
      els.logo.alt = institute?.name || "شعار المعهد";
    }
    // التواصل
    const email = institute?.contact?.email || "";
    const whats = institute?.contact?.whatsapp || "";
    if (els.contactEmail) {
      if (email) {
        els.contactEmail.textContent = email;
        els.contactEmail.href = `mailto:${email}`;
      } else {
        els.contactEmail.textContent = "—";
        els.contactEmail.removeAttribute("href");
      }
    }
    if (els.contactWhats) {
      if (whats) {
        const clean = String(whats).replace(/\D+/g, "");
        els.contactWhats.textContent = whats;
        els.contactWhats.href = `https://wa.me/${clean}`;
      } else {
        els.contactWhats.textContent = "—";
        els.contactWhats.removeAttribute("href");
      }
    }
  } catch (e) {
    console.error(e);
    toast("warning", "تعذّر تحميل بيانات المعهد. جرّب مجددًا.");
  }
}

function validate() {
  const email = (els.email?.value || "").trim();
  const password = els.password?.value || "";
  if (!email || !password) {
    toast("warning", "الرجاء ملء البريد الإلكتروني وكلمة المرور.");
    return null;
  }
  // تحقّق خفيف لعناوين البريد
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast("warning", "صيغة البريد الإلكتروني غير صحيحة.");
    return null;
  }
  return { email, password };
}

async function handleLogin(e) {
  e?.preventDefault?.();
  const creds = validate();
  if (!creds) return;

  try {
    els.btnLogin.disabled = true;
    showLoader();

    const { user } = await signInWithEmailAndPassword(auth, creds.email, creds.password);
    const udoc = await getUserDoc(user.uid);

    if (!udoc?.role) {
      await signOutSafe(false);
      toast("error", "الحساب غير مفعَّل بعد — تواصل مع الإدارة.");
      return;
    }
    if (udoc?.status && String(udoc.status).toLowerCase() !== "active") {
      await signOutSafe(false);
      toast("error", "الحساب غير نشِط حاليًا.");
      return;
    }

    const role = String(udoc.role).toLowerCase();
    if (role === "owner" || role === "admin") {
      window.location.href = "admin-dashboard.html";
      return;
    } else if (role === "teacher") {
      // مؤقتًا حتى نبني لوحة المعلم
      toast("success", "أهلًا بك! تم الدخول كمعلم. (لوحة المعلم قريبًا)");
      // يمكنك لاحقًا: window.location.href = "teacher-dashboard.html";
      return;
    } else {
      await signOutSafe(false);
      toast("error", "هذا الدور غير مدعوم في البوابة.");
      return;
    }

  } catch (err) {
    console.error(err);
    // رسالة عربية ودّية
    toast("error", "فشل تسجيل الدخول. تأكد من البيانات وحاول مرة أخرى.");
  } finally {
    hideLoader();
    els.btnLogin.disabled = false;
  }
}

async function handleForgot(e) {
  e?.preventDefault?.();
  const email = (els.email?.value || "").trim();
  if (!email) {
    toast("warning", "اكتب بريدك الإلكتروني أولًا.");
    els.email?.focus();
    return;
  }
  try {
    showLoader();
    await sendPasswordResetEmail(auth, email);
    toast("success", "تم إرسال رابط إعادة ضبط كلمة المرور إلى بريدك.");
  } catch (err) {
    console.error(err);
    toast("error", "تعذّر إرسال الرابط. تأكّد من البريد وحاول مرة أخرى.");
  } finally {
    hideLoader();
  }
}

function bindEvents() {
  els.form?.addEventListener("submit", handleLogin);
  els.linkForgot?.addEventListener("click", handleForgot);

  // Enter submits
  [els.email, els.password].forEach(inp => {
    inp?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") handleLogin(ev);
    });
  });
}

(function boot(){
  setYear();
  hydrateInstitute();
  bindEvents();
})();
