// /js/pages/admin-dashboard.js
import { auth, db, serverTimestamp, onAuthStateChanged } from "../core/firebase.js";
import {
  collection, getDocs, getDoc, setDoc, doc, query, where, orderBy, updateDoc, deleteDoc, limit
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import {
  qs, qsa, toast, showLoader, hideLoader, getCurrentYearId, requireRole, displayClassName
} from "../core/app.js";

/* عناصر الواجهة */
const els = {
  // عامة
  btnSignOut: qs("#btnSignOut"),
  // Overview
  statTotalUsers: qs("#statTotalUsers"),
  statTeachers: qs("#statTeachers"),
  statClasses: qs("#statClasses"),
  // Invites
  invitesListCard: qs("#invitesListCard"),
  invitesBody: qs("#invitesBody"),
  inviteRole: qs("#inviteRole"),
  inviteUsageLimit: qs("#inviteUsageLimit"),
  inviteExpiresAt: qs("#inviteExpiresAt"),
  inviteCode: qs("#inviteCode"),
  inviteActive: qs("#inviteActive"),
  btnCreateInvite: qs("#btnCreateInvite"),
  btnGen: qs("#btnGen"),
  roleHint: qs("#roleHint"),
  // Users
  usersBody: qs("#usersBody"),
  // Classes (إنشاء + عرض)
  clsGrade: qs("#clsGrade"),
  clsTrack: qs("#clsTrack"),
  clsTemplate: qs("#clsTemplate"),
  clsSection: qs("#clsSection"),
  clsCapacity: qs("#clsCapacity"),
  clsHomeroom: qs("#clsHomeroom"),
  btnCreateClass: qs("#btnCreateClass"),
  classesBody: qs("#classesBody"),
};

let CURRENT_ROLE = null;
let CURRENT_YEAR = null;

/* ===== تحقّق الدور وتهيئة ===== */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }

  showLoader();
  const guard = await requireRole(["owner", "admin"]);
  hideLoader();

  if (!guard.allowed) { location.href = "index.html"; return; }
  CURRENT_ROLE = guard.role;
  CURRENT_YEAR = await getCurrentYearId();

  // دعوات حسب الدور
  if (CURRENT_ROLE === "owner") {
    await loadInvites();
    els.roleHint && (els.roleHint.style.display = "none");
  } else {
    if (els.invitesListCard) els.invitesListCard.style.display = "none";
    if (els.roleHint) { els.roleHint.style.display = "block"; els.roleHint.textContent = "عرض قائمة الدعوات متاح للمالك فقط."; }
  }

  // مراجع للنماذج
  await loadRefsForClasses(); // grades/tracks/templates/teachers

  // تعبئة الإحصائيات + الجداول
  await Promise.all([
    loadOverview(),
    loadUsers(),
    loadClasses()
  ]);
});

/* ===== خروج ===== */
els.btnSignOut?.addEventListener("click", async () => {
  await auth.signOut();
  location.href = "index.html";
});

/* ===== نظرة عامة ===== */
async function loadOverview() {
  try {
    // users
    const usersSnap = await getDocs(collection(db, "users"));
    let total = 0, teachers = 0;
    usersSnap.forEach(d => {
      total += 1;
      if ((d.data().role || "") === "teacher") teachers += 1;
    });
    els.statTotalUsers && (els.statTotalUsers.textContent = total);
    els.statTeachers && (els.statTeachers.textContent = teachers);

    // classes (للسنة الحالية)
    const qClasses = query(collection(db, "classes"), where("yearId", "==", CURRENT_YEAR));
    const classesSnap = await getDocs(qClasses);
    els.statClasses && (els.statClasses.textContent = classesSnap.size);
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل نظرة عامة.", "err");
  }
}

/* ===== الدعوات ===== */
function randCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUWXYZ23456789";
  let s = "INV-";
  for (let i=0; i<len; i++) s += alphabet[Math.floor(Math.random()*alphabet.length)];
  return s;
}
if (els.inviteCode && !els.inviteCode.value) els.inviteCode.value = randCode();
els.btnGen?.addEventListener("click", () => { els.inviteCode.value = randCode(); });

els.btnCreateInvite?.addEventListener("click", async () => {
  try {
    const role = (els.inviteRole?.value || "teacher").toLowerCase();
    if (CURRENT_ROLE !== "owner" && role !== "teacher") {
      toast("إنشاء أكواد غير المعلّم متاح للمالك فقط.", "warn");
      return;
    }
    const usageLimit = parseInt(els.inviteUsageLimit?.value || "1", 10);
    const code = (els.inviteCode?.value || randCode()).trim().toUpperCase();
    const active = !!els.inviteActive?.checked;
    const expiresAt = els.inviteExpiresAt?.value ? new Date(els.inviteExpiresAt.value) : null;

    if (!code.startsWith("INV-")) { toast("صيغة الكود يجب أن تبدأ بـ INV-", "warn"); return; }

    const ref = doc(db, "invites", code);
    await setDoc(ref, {
      code, role, active,
      usageLimit: isNaN(usageLimit) ? 1 : usageLimit,
      usedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(expiresAt ? { expiresAt } : {})
    });

    toast("تم إنشاء الدعوة.", "ok");
    els.inviteCode.value = randCode();
    if (CURRENT_ROLE === "owner") await loadInvites();
  } catch (e) {
    console.error(e);
    toast("تعذّر إنشاء الدعوة.", "err");
  }
});

async function loadInvites() {
  try {
    const snap = await getDocs(query(collection(db, "invites")));
    if (!els.invitesBody) return;
    els.invitesBody.innerHTML = "";
    snap.forEach(d => {
      const v = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.code || d.id}</td>
        <td>${v.role || "-"}</td>
        <td>${v.usageLimit ?? "-"}</td>
        <td>${v.usedCount ?? 0}</td>
        <td>${v.active ? "مفعّل" : "موقوف"}</td>
        <td>
          <button class="btn-sm" data-act="toggle" data-id="${d.id}">${v.active ? "إيقاف" : "تفعيل"}</button>
          <button class="btn-sm danger" data-act="del" data-id="${d.id}">حذف</button>
        </td>
      `;
      els.invitesBody.appendChild(tr);
    });

    els.invitesBody.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        const ref = doc(db, "invites", id);
        if (act === "toggle") {
          const v = (await getDoc(ref)).data();
          await updateDoc(ref, { active: !v.active, updatedAt: serverTimestamp() });
        } else if (act === "del") {
          await deleteDoc(ref);
        }
        await loadInvites();
      });
    });
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل الدعوات (مالك فقط).", "err");
  }
}

/* ===== المستخدمون ===== */
async function loadUsers() {
  try {
    const snap = await getDocs(query(collection(db, "users"), limit(500)));
    if (!els.usersBody) return;
    els.usersBody.innerHTML = "";
    snap.forEach(d => {
      const u = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.nameAr || u.displayName || "-"}</td>
        <td>${u.email || "-"}</td>
        <td>${u.role || "-"}</td>
        <td>${u.status || "-"}</td>
        <td>${u.homeroomClassId || "-"}</td>
      `;
      els.usersBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل المستخدمين.", "err");
  }
}

/* ===== مراجع إنشاء الصف ===== */
async function loadRefsForClasses() {
  try {
    // grades
    if (els.clsGrade) {
      const s = els.clsGrade;
      s.innerHTML = "";
      const snap = await getDocs(query(collection(db, "grades"), orderBy("order")));
      snap.forEach(d => {
        const v = d.data();
        const opt = document.createElement("option");
        opt.value = v.id || d.id;   // عندك id = "g1"
        opt.textContent = v.nameAr || v.nameEn || v.id || d.id;
        s.appendChild(opt);
      });
    }
    // tracks
    if (els.clsTrack) {
      const s = els.clsTrack;
      s.innerHTML = "";
      const snap = await getDocs(query(collection(db, "tracks"), orderBy("order")));
      snap.forEach(d => {
        const v = d.data();
        const opt = document.createElement("option");
        opt.value = v.id || v.code || d.id;  // عندك id/code = "ar"
        opt.textContent = v.name || v.nameAr || v.id || v.code || d.id;
        s.appendChild(opt);
      });
    }
    // period templates
    if (els.clsTemplate) {
      const s = els.clsTemplate;
      s.innerHTML = "";
      const snap = await getDocs(collection(db, "periodTemplates"));
      snap.forEach(d => {
        const v = d.data();
        const opt = document.createElement("option");
        opt.value = d.id; // مثال: default-7
        opt.textContent = v.name || d.id;
        s.appendChild(opt);
      });
    }
    // teachers (للـ homeroom)
    if (els.clsHomeroom) {
      const s = els.clsHomeroom;
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "teacher")));
      snap.forEach(d => {
        const v = d.data();
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = v.nameAr || v.displayName || v.email || d.id;
        s.appendChild(opt);
      });
    }
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل المراجع (مسارات/صفوف/قوالب).", "err");
  }
}

/* ===== إنشاء صف ===== */
els.btnCreateClass?.addEventListener("click", async () => {
  try {
    const gradeId = (els.clsGrade?.value || "").trim();       // مثال: g1
    const trackCode = (els.clsTrack?.value || "").trim();      // مثال: ar
    const periodTemplateId = (els.clsTemplate?.value || "").trim(); // default-7
    const section = (els.clsSection?.value || "A").trim();
    const capacity = parseInt(els.clsCapacity?.value || "30", 10);
    const homeroomTeacherId = (els.clsHomeroom?.value || "").trim() || null;

    if (!gradeId || !trackCode || !periodTemplateId || !section) {
      toast("يرجى تعبئة جميع الحقول المطلوبة.", "warn");
      return;
    }

    // معرّف الصف حسب نمطك: g1-ar-A
    const id = `${gradeId}-${trackCode}-${section}`;
    const ref = doc(db, "classes", id);

    // منهج الصف (طبقًا لهيكلك الحالي)
    const curriculumId = `${gradeId}-${trackCode}`;

    await setDoc(ref, {
      id,
      nameAr: null,
      nameEn: null,
      gradeId,
      trackCode,
      section,
      sectionNameAr: null,
      capacity: isNaN(capacity) ? 30 : capacity,
      periodTemplateId,
      curriculumId,
      homeroomTeacherId,
      yearId: CURRENT_YEAR,
      active: true,
      notes: null,
      order: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    toast("تم إنشاء الصف.", "ok");
    await loadClasses();
  } catch (e) {
    console.error(e);
    toast("تعذّر إنشاء الصف. تأكّد من الصلاحيات والقواعد.", "err");
  }
});

/* ===== عرض الصفوف ===== */
async function loadClasses() {
  try {
    const q = query(collection(db, "classes"), where("yearId", "==", CURRENT_YEAR));
    const snap = await getDocs(q);
    if (!els.classesBody) return;
    els.classesBody.innerHTML = "";
    snap.forEach(d => {
      const c = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.id || d.id}</td>
        <td>${displayClassName(c)}</td>
        <td>${c.periodTemplateId || "-"}</td>
        <td>${c.homeroomTeacherId || "-"}</td>
        <td>${c.capacity ?? "-"}</td>
      `;
      els.classesBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل الصفوف.", "err");
  }
}
