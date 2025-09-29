// js/pages/admin-dashboard.js
import { auth, db, serverTimestamp } from "../core/firebase.js";
import {
  requireRole,
  toast,
  showLoader,
  hideLoader,
  signOutSafe,
  getInstituteInfo,
  getCurrentYearId,
} from "../core/app.js";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";

const els = {
  tabs: document.querySelectorAll(".tab"),
  contents: document.querySelectorAll(".tab-content"),
  btnLogout: document.getElementById("btnLogout"),
  countClasses: document.getElementById("countClasses"),
  countTeachers: document.getElementById("countTeachers"),
  countInvites: document.getElementById("countInvites"),
  currentYear: document.getElementById("currentYear"),
  inviteForm: document.getElementById("inviteForm"),
  inviteList: document.getElementById("inviteList"),
};

// ===== تبويبات =====
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    els.contents.forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// ===== حماية الدور =====
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  const ok = await requireRole(["owner", "admin"]);
  if (!ok) {
    toast("error", "صلاحيات غير كافية");
    location.href = "index.html";
  } else {
    hydrateOverview();
    loadInvites();
    hydrateInstitute();
  }
});

els.btnLogout?.addEventListener("click", () => signOutSafe(true));

// ===== Overview =====
async function hydrateOverview() {
  try {
    showLoader();
    // classes count
    const cSnap = await getDocs(collection(db, "classes"));
    els.countClasses.textContent = cSnap.size;

    // teachers count
    const qT = query(
      collection(db, "users"),
      where("role", "==", "teacher"),
      where("status", "==", "active")
    );
    const tSnap = await getDocs(qT);
    els.countTeachers.textContent = tSnap.size;

    // invites count
    const qI = query(collection(db, "invites"), where("active", "==", true));
    const iSnap = await getDocs(qI);
    els.countInvites.textContent = iSnap.size;

    // current year (من settings/global)
    const yearId = await getCurrentYearId();
    els.currentYear.textContent = yearId || "—";
  } catch (err) {
    console.error(err);
    toast("error", "تعذّر تحميل البيانات");
  } finally {
    hideLoader();
  }
}

// ===== Utilities =====
function genCode(prefix = "INV") {
  // كود قصير ثابت الشكل
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function fmtDateMaybe(ts) {
  if (!ts) return "—";
  try {
    // Firestore Timestamp
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString("ar-EG");
    // JS Date or ISO
    const d = typeof ts === "string" ? new Date(ts) : ts;
    if (!isNaN(d)) return d.toLocaleDateString("ar-EG");
  } catch {}
  return "—";
}

// ===== Invites: Create =====
els.inviteForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const role = (document.getElementById("role").value || "teacher").trim().toLowerCase();
  const usageLimit = Number(document.getElementById("usageLimit").value || 1);
  const expiresAtRaw = document.getElementById("expiresAt").value;
  const allowedEmail = (document.getElementById("allowedEmail").value || "").trim();

  if (!role) return toast("warning", "من فضلك حدِّد الدور.");
  if (usageLimit < 1 || !Number.isFinite(usageLimit)) {
    return toast("warning", "عدد الاستخدامات يجب أن يكون رقمًا موجبًا.");
  }

  try {
    showLoader();
    // ⚠️ مهم: نخلي docId = code عشان صفحة activate تلاقي الدعوة بالـ ID
    const code = genCode("INV");
    const ref = doc(db, "invites", code);

    const payload = {
      code,                 // نخزّنه أيضًا كحقل داخلي لعرضه بسهولة
      role,                 // teacher | admin (للداخلية فقط)
      active: true,
      usageLimit,
      usedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (expiresAtRaw) payload.expiresAt = new Date(expiresAtRaw);
    if (allowedEmail) payload.allowedEmail = allowedEmail.toLowerCase();

    await setDoc(ref, payload);
    toast("success", "تم إنشاء الدعوة");
    els.inviteForm.reset();
    await loadInvites();
  } catch (err) {
    console.error(err);
    toast("error", "فشل إنشاء الدعوة");
  } finally {
    hideLoader();
  }
});

// ===== Invites: List & actions =====
async function loadInvites() {
  try {
    els.inviteList.innerHTML = "<tr><td colspan='7'>تحميل...</td></tr>";
    const snap = await getDocs(collection(db, "invites"));
    if (snap.empty) {
      els.inviteList.innerHTML = "<tr><td colspan='7'>لا توجد دعوات</td></tr>";
      return;
    }
    els.inviteList.innerHTML = "";
    snap.forEach((docu) => {
      const inv = docu.data();
      const id = docu.id; // يساوي code في إنشائنا الجديد
      const stateTxt = inv.active ? "نشط" : "مغلق";
      const usedVsLimit = `${inv.usedCount || 0}/${inv.usageLimit || 1}`;
      const expiresTxt = fmtDateMaybe(inv.expiresAt);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${inv.code || id}</td>
        <td>${inv.role || "—"}</td>
        <td>${stateTxt}</td>
        <td>${usedVsLimit}</td>
        <td>${expiresTxt}</td>
        <td>
          <button class="btn-action" data-id="${id}" data-action="copy">نسخ</button>
          <button class="btn-action" data-id="${id}" data-action="toggle">${inv.active ? "تعطيل" : "تفعيل"}</button>
          <button class="btn-action danger" data-id="${id}" data-action="delete">حذف</button>
        </td>
      `;
      els.inviteList.appendChild(tr);
    });

    els.inviteList.querySelectorAll("button.btn-action").forEach((btn) => {
      btn.addEventListener("click", () =>
        inviteAction(btn.dataset.id, btn.dataset.action)
      );
    });
  } catch (err) {
    console.error(err);
    toast("error", "فشل تحميل الدعوات");
  }
}

async function inviteAction(id, action) {
  try {
    const ref = doc(db, "invites", id);

    if (action === "copy") {
      await navigator.clipboard.writeText(id);
      toast("success", "تم نسخ الكود للحافظة");
      return;
    }

    if (action === "delete") {
      if (!confirm("متأكد من حذف الدعوة؟")) return;
      await deleteDoc(ref);
      toast("success", "تم الحذف");
      loadInvites();
      return;
    }

    if (action === "toggle") {
      const snap = await getDoc(ref);
      if (!snap.exists()) return toast("error", "الدعوة غير موجودة");
      const current = !!snap.data().active;
      await updateDoc(ref, {
        active: !current,
        updatedAt: serverTimestamp(),
      });
      toast("success", current ? "تم التعطيل" : "تم التفعيل");
      loadInvites();
      return;
    }
  } catch (err) {
    console.error(err);
    toast("error", "خطأ في العملية");
  }
}

// ===== Institute Info in header =====
async function hydrateInstitute() {
  const inst = await getInstituteInfo();
  document
    .querySelectorAll(".institute-name")
    .forEach((n) => (n.textContent = inst?.name || "اسم المعهد"));
  if (inst?.logoUrl) document.querySelector(".logo").src = inst.logoUrl;
}
