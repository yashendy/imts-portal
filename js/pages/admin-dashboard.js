// /js/pages/admin-dashboard.js
import { auth, db, serverTimestamp, onAuthStateChanged } from "../core/firebase.js";
import {
  collection, getDocs, getDoc, setDoc, doc, query, where, orderBy, updateDoc, deleteDoc, limit
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import { qs, qsa, toast, showLoader, hideLoader, getCurrentYearId, requireRole, displayClassName } from "../core/app.js";

/* عناصر الواجهة (غيّر IDs لو مختلفة) */
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
  roleHint: qs("#roleHint"),

  // Users
  usersBody: qs("#usersBody"),

  // Classes
  classesBody: qs("#classesBody"),
};

/* ===== تحقّق الدور وتهيئة أولية ===== */
let CURRENT_ROLE = null;
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }

  showLoader();
  const guard = await requireRole(["owner", "admin"]);
  hideLoader();

  if (!guard.allowed) { location.href = "index.html"; return; }
  CURRENT_ROLE = guard.role;

  // تخصيص الدعوات حسب الدور
  if (CURRENT_ROLE === "owner") {
    await loadInvites();
    els.roleHint && (els.roleHint.style.display = "none");
  } else {
    // admin: لا يرى القائمة
    if (els.invitesListCard) els.invitesListCard.style.display = "none";
    if (els.roleHint) { els.roleHint.style.display = "block"; els.roleHint.textContent = "عرض قائمة الدعوات متاح للمالك فقط."; }
  }

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
    const yearId = await getCurrentYearId();

    // users count
    const usersSnap = await getDocs(collection(db, "users"));
    let total = 0, teachers = 0;
    usersSnap.forEach(d => {
      total += 1;
      if ((d.data().role || "") === "teacher") teachers += 1;
    });

    // classes (current year)
    const qClasses = query(collection(db, "classes"), where("yearId", "==", yearId));
    const classesSnap = await getDocs(qClasses);
    let classesCount = classesSnap.size;

    els.statTotalUsers && (els.statTotalUsers.textContent = total);
    els.statTeachers && (els.statTeachers.textContent = teachers);
    els.statClasses && (els.statClasses.textContent = classesCount);
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
els.inviteCode && (els.inviteCode.value = randCode());

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
    els.inviteCode && (els.inviteCode.value = randCode());
    if (CURRENT_ROLE === "owner") await loadInvites();
  } catch (e) {
    console.error(e);
    toast("تعذّر إنشاء الدعوة. تأكّد من الصلاحيات وقواعد Firestore.", "err");
  }
});

async function loadInvites() {
  try {
    const snap = await getDocs(query(collection(db, "invites")));
    if (els.invitesBody) {
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

      // أزرار داخل الجدول
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
    }
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل قائمة الدعوات (مالك فقط).", "err");
  }
}

/* ===== المستخدمون ===== */
async function loadUsers() {
  try {
    const snap = await getDocs(query(collection(db, "users"), limit(500)));
    if (els.usersBody) {
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
    }
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل المستخدمين.", "err");
  }
}

/* ===== الصفوف ===== */
async function loadClasses() {
  try {
    const yearId = await getCurrentYearId();
    const q = query(collection(db, "classes"), where("yearId", "==", yearId));
    const snap = await getDocs(q);
    if (els.classesBody) {
      els.classesBody.innerHTML = "";
      snap.forEach(d => {
        const c = d.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${displayClassName(c)}</td>
          <td>${c.periodTemplateId || "-"}</td>
          <td>${c.homeroomTeacherId || "-"}</td>
          <td>${c.capacity ?? "-"}</td>
        `;
        els.classesBody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error(e);
    toast("تعذّر تحميل الصفوف.", "err");
  }
}
