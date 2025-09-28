// js/pages/activate.js
// يعتمد على js/core/firebase.js + js/core/app.js
import { auth, db, serverTimestamp } from "../core/firebase.js";
import { getInstituteInfo, toast, showLoader, hideLoader } from "../core/app.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";

const els = {
  logo: document.querySelector("img.logo"),
  names: document.querySelectorAll(".institute-name"),
  contactEmail: document.getElementById("contactEmail"),
  contactWhats: document.getElementById("contactWhats"),
  inviteCode: document.getElementById("inviteCode"),
  form: document.getElementById("activateForm"),
  btnActivate: document.getElementById("btnActivate"),
  yearNow: document.getElementById("yearNow"),
};

function setYear() {
  if (els.yearNow) els.yearNow.textContent = new Date().getFullYear();
}

async function hydrateInstitute() {
  try {
    const institute = await getInstituteInfo();
    els.names?.forEach(n => n.textContent = institute?.name || "اسم المعهد");
    if (els.logo && institute?.logoUrl) {
      els.logo.src = institute.logoUrl;
      els.logo.alt = institute?.name || "شعار المعهد";
    }
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
  } catch {
    toast("warning", "تعذّر تحميل بيانات المعهد.");
  }
}

function getQueryCode() {
  const params = new URLSearchParams(location.search);
  const c = params.get("code");
  return c ? String(c).trim() : "";
}

function normCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

async function ensureSignedIn() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast("warning", "الرجاء تسجيل الدخول أولًا.");
        location.href = "index.html";
        return;
      }
      resolve(user);
    });
  });
}

async function activateInvite(user, code) {
  const inviteRef = doc(db, "invites", code);
  const userRef = doc(db, "users", user.uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(inviteRef);
    if (!snap.exists()) throw new Error("inv_not_found");

    const inv = snap.data();
    if (inv.active === false) throw new Error("inv_inactive");

    // قيود الاستخدام
    const limit = Number(inv.usageLimit ?? 1);
    const used = Number(inv.usedCount ?? 0);
    if (limit > 0 && used >= limit) throw new Error("inv_exhausted");

    // انتهاء الصلاحية
    if (inv.expiresAt?.toMillis) {
      const now = Date.now();
      if (now > inv.expiresAt.toMillis()) throw new Error("inv_expired");
    }

    // (اختياري) ربط بريد محدد
    if (inv.allowedEmail) {
      const allowed = String(inv.allowedEmail).trim().toLowerCase();
      if ((user.email || "").toLowerCase() !== allowed) {
        throw new Error("inv_email_mismatch");
      }
    }

    // إعدادات الدور/الحقول
    const role = String(inv.role || "teacher").toLowerCase();
    const payload = {
      role,
      status: "active",
      // حقول اختيارية يمكن أن تحملها الدعوة:
      subjects: inv.subjects || null,
      trackCodes: inv.trackCodes || null,
      homeroomClassId: inv.homeroomClassId || null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(), // إذا كانت الوثيقة جديدة
    };

    // إنشاء/تحديث المستخدم
    const userSnap = await tx.get(userRef);
    if (userSnap.exists()) {
      tx.update(userRef, payload);
    } else {
      tx.set(userRef, {
        uid: user.uid,
        email: user.email || "",
        nameAr: user.displayName || "",
        ...payload,
      });
    }

    // تحديث الدعوة
    const nextUsed = used + 1;
    const deactivate =
      (limit > 0 && nextUsed >= limit) || inv.deactivateOnUse === true;

    tx.update(inviteRef, {
      usedCount: nextUsed,
      active: deactivate ? false : true,
      lastUsedAt: serverTimestamp(),
      lastUsedBy: user.uid,
    });
  });
}

async function handleActivate(e) {
  e?.preventDefault?.();
  const codeRaw = els.inviteCode?.value || "";
  const code = normCode(codeRaw);
  if (!code) {
    toast("warning", "من فضلك أدخل كود الدعوة.");
    return;
  }
  const user = await ensureSignedIn();
  try {
    showLoader();
    els.btnActivate.disabled = true;

    await activateInvite(user, code);
    toast("success", "تم تفعيل حسابك بنجاح!");
    setTimeout(() => (location.href = "index.html"), 1600);
  } catch (err) {
    console.error(err);
    const map = {
      inv_not_found: "الرمز غير موجود.",
      inv_inactive: "الرمز غير نشِط.",
      inv_exhausted: "تم استهلاك الرمز.",
      inv_expired: "انتهت صلاحية الرمز.",
      inv_email_mismatch: "هذا الرمز غير مخصّص لهذا البريد.",
    };
    const msg = map[err.message] || "تعذّر تفعيل الرمز. حاول مرة أخرى.";
    toast("error", msg);
  } finally {
    hideLoader();
    els.btnActivate.disabled = false;
  }
}

function boot() {
  setYear();
  hydrateInstitute();

  // تعبئة الكود من العنوان إذا وُجد
  const qCode = getQueryCode();
  if (qCode && els.inviteCode) els.inviteCode.value = qCode;

  els.form?.addEventListener("submit", handleActivate);
}

boot();
