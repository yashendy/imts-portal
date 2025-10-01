// /js/pages/admin-dashboard.js
import { auth, db } from "../core/firebase.js";
import {
  onAuthStateChanged, signOut, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, query, orderBy, limit, where,
  serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ===== عناصر أساسية ===== */
const els = {
  // رأس الصفحة
  btnSignOut: document.getElementById("btnSignOut"),
  currentUserName: document.getElementById("currentUserName"),

  // نظرة عامة
  overviewUsers: document.getElementById("overviewUsers"),
  overviewTeachers: document.getElementById("overviewTeachers"),
  overviewClasses: document.getElementById("overviewClasses"),

  // إنشاء دعوة
  inviteForm: document.getElementById("formInvite"),
  inviteCode: document.getElementById("inviteCode"),
  inviteRole: document.getElementById("inviteRole"),
  inviteActive: document.getElementById("inviteActive"),
  usageLimit: document.getElementById("usageLimit"),
  expiresAt: document.getElementById("expiresAt"),
  btnGenCode: document.getElementById("btnGenCode"),
  roleHint: document.getElementById("roleHint"),
  inviteAlert: document.getElementById("inviteAlert"),

  // الجداول
  usersBody: document.querySelector("#tblUsers tbody"),
  invitesBody: document.querySelector("#tblInvites tbody"),

  // الصفوف (section موجود عندك – IDs افتراضية شائعة)
  classesBody: document.querySelector("#tblClasses tbody"),
};

/* ===== أدوات بسيطة ===== */
function toast(type, text) {
  console[type === "error" ? "error" : "log"](text);
  // يمكنك لاحقًا ربطها بتوست UI
}
function fmt(ts) {
  try {
    if (!ts) return "-";
    if (ts.toDate) return ts.toDate().toLocaleString();
    const d = new Date(ts);
    return isNaN(d) ? "-" : d.toLocaleString();
  } catch { return "-"; }
}

/* ===== حارس صلاحيات ===== */
async function getRoleFromDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref).catch(() => null);
  if (snap?.exists()) {
    const r = (snap.data() || {}).role;
    if (r) return r;
  }
  return null;
}
async function getRoleFromClaims() {
  const token = await getIdTokenResult(auth.currentUser);
  return token?.claims?.role || null;
}
async function requireRole(roles = ["owner"]) {
  const user = auth.currentUser;
  if (!user) return false;
  let role = await getRoleFromDoc(user.uid);
  if (!role) role = await getRoleFromClaims();
  if (!role) return false;
  return roles.includes(role);
}
window.requireRole = requireRole; // قد نحتاجها في HTML أخرى

/* ===== تدفق الدخول ===== */
let CURRENT_ROLE = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }

  els.currentUserName && (els.currentUserName.textContent = user.displayName || user.email || user.uid);

  // فقط owner/admin يدخلوا
  const ok = await requireRole(["owner","admin"]);
  if (!ok) { toast("error","صلاحيات غير كافية"); location.href = "index.html"; return; }

  CURRENT_ROLE = (await getRoleFromDoc(user.uid)) || (await getRoleFromClaims());

  // Overview دائماً
  hydrateOverview();

  // الدعوات: عرض القائمة للمالك فقط (القواعد تمنع list لغيره)
  if (CURRENT_ROLE === "owner") {
    await loadInvites();
  } else {
    if (els.invitesBody) els.invitesBody.innerHTML = `<tr><td colspan="7">عرض الدعوات متاح للمالك فقط.</td></tr>`;
    if (els.roleHint) els.roleHint.style.display = "block"; // تنبيه أن admin لا ينشئ admin
  }

  // المستخدمون
  await loadUsers();

  // الصفوف (قراءة عامة)
  await loadClasses();
});

/* ===== خروج ===== */
els.btnSignOut?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

/* ===== توليد كود ===== */
function generateCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "INV-";
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
els.btnGenCode?.addEventListener("click", () => {
  els.inviteCode.value = generateCode();
});

/* ===== إنشاء دعوة ===== */
els.inviteForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth.currentUser) return;

  try {
    const role = (els.inviteRole.value || "teacher").toLowerCase();

    // لو أدمن: ممنوع إنشاء دعوة admin
    if (CURRENT_ROLE === "admin" && role !== "teacher") {
      toast("error","إنشاء دعوة 'أدمن' مسموح للمالك فقط.");
      return;
    }

    let code = (els.inviteCode.value || "").trim().toUpperCase();
    if (!/^INV-[A-Z0-9]{4,}$/.test(code)) code = generateCode();

    const active = !!els.inviteActive.checked;
    const usageLimit = Math.max(1, parseInt(els.usageLimit.value || "1", 10));

    let expiresAt = null;
    const exVal = els.expiresAt.value;
    if (exVal) {
      const d = new Date(exVal);
      if (!isNaN(d.getTime())) expiresAt = Timestamp.fromDate(d);
    }

    const ref = doc(db, "invites", code);
    await setDoc(ref, {
      code, role, active, usageLimit,
      usedCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(expiresAt ? { expiresAt } : {})
    });

    toast("log", `تم إنشاء الدعوة: ${code}`);
    els.inviteCode.value = code;

    if (CURRENT_ROLE === "owner") await loadInvites();
  } catch (err) {
    console.error(err);
    toast("error","تعذّر إنشاء الدعوة. تأكد من الصلاحيات وقواعد Firestore.");
  }
});

/* ===== Overview ===== */
async function hydrateOverview() {
  try {
    const usersSnap = await getDocs(query(collection(db, "users"), limit(1_000)));
    const usersAll = usersSnap.docs.length;
    const teachers = usersSnap.docs.filter(d => (d.data().role || "") === "teacher").length;

    const classesSnap = await getDocs(query(collection(db, "classes"), limit(1_000)));
    const classesAll = classesSnap.docs.length;

    if (els.overviewUsers) els.overviewUsers.textContent = String(usersAll);
    if (els.overviewTeachers) els.overviewTeachers.textContent = String(teachers);
    if (els.overviewClasses) els.overviewClasses.textContent = String(classesAll);
  } catch (err) { console.warn(err); }
}

/* ===== المستخدمون ===== */
async function loadUsers() {
  if (!els.usersBody) return;
  els.usersBody.innerHTML = "<tr><td colspan='5'>جاري التحميل…</td></tr>";
  try {
    const q = query(collection(db, "users"), orderBy("createdAt","desc"), limit(300));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => {
      const u = d.data();
      rows.push(
        `<tr>
          <td>${u.displayName || "-"}</td>
          <td>${u.email || "-"}</td>
          <td><span class="tag">${u.role || "-"}</span></td>
          <td>${u.status || "-"}</td>
          <td>${fmt(u.createdAt)}</td>
        </tr>`
      );
    });
    els.usersBody.innerHTML = rows.join("") || "<tr><td colspan='5'>لا يوجد بيانات.</td></tr>";
  } catch (err) {
    console.warn(err);
    els.usersBody.innerHTML = "<tr><td colspan='5'>تعذّر التحميل (صلاحيات؟).</td></tr>";
  }
}

/* ===== الدعوات (Owner فقط) ===== */
async function loadInvites() {
  if (!els.invitesBody) return;
  els.invitesBody.innerHTML = "<tr><td colspan='7'>جاري التحميل…</td></tr>";
  try {
    const q = query(collection(db, "invites"), orderBy("createdAt","desc"), limit(500));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => {
      const inv = d.data(); const id = d.id;
      rows.push(
        `<tr data-id="${id}">
          <td class="mono">${inv.code || id}</td>
          <td>${inv.role}</td>
          <td>${inv.active ? "مفعّل" : "موقّف"}</td>
          <td>${inv.usedCount || 0}/${inv.usageLimit || 0}</td>
          <td>${inv.usageLimit || "-"}</td>
          <td>${fmt(inv.createdAt)}</td>
          <td class="actions">
            <button class="btn btn-xs" data-action="toggle">${inv.active ? "إيقاف" : "تفعيل"}</button>
            <button class="btn btn-xs btn-danger" data-action="delete">حذف</button>
          </td>
        </tr>`
      );
    });
    els.invitesBody.innerHTML = rows.join("") || "<tr><td colspan='7'>لا يوجد دعوات.</td></tr>";
  } catch (err) {
    console.warn(err);
    els.invitesBody.innerHTML = "<tr><td colspan='7'>تعذّر التحميل (صلاحيات؟).</td></tr>";
  }
}

els.invitesBody?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (CURRENT_ROLE !== "owner") return; // أمان واجهة؛ القواعد تمنع أصلاً

  const tr = btn.closest("tr");
  const id = tr?.dataset?.id; if (!id) return;

  const ref = doc(db, "invites", id);
  if (btn.dataset.action === "toggle") {
    try {
      const snap = await getDoc(ref);
      const active = !!snap.data().active;
      await updateDoc(ref, { active: !active, updatedAt: serverTimestamp() });
      await loadInvites();
    } catch (err) { console.warn(err); }
  }

  if (btn.dataset.action === "delete") {
    if (!confirm("تأكيد حذف الدعوة؟")) return;
    try { await deleteDoc(ref); await loadInvites(); } catch (err) { console.warn(err); }
  }
});

/* ===== الصفوف (Classes) — قراءة وعرض مبسّط ===== */
async function loadClasses() {
  if (!els.classesBody) return;
  try {
    els.classesBody.innerHTML = "<tr><td colspan='5'>جاري التحميل…</td></tr>";
  } catch {}
  try {
    const q = query(collection(db, "classes"), orderBy("nameAr","asc"), limit(500));
    const snap = await getDocs(q);
    const rows = [];
    for (const d of snap.docs) {
      const c = d.data();
      // عدد المعلمين المرتبطين
      const teachersQ = query(collection(db, "classTeachers"), where("classId","==", d.id));
      const tSnap = await getDocs(teachersQ).catch(() => ({ size: 0 }));
      rows.push(
        `<tr>
          <td>${c.nameAr || c.nameEn || "-"}</td>
          <td>${c.trackCode || "-"}</td>
          <td>${c.level || "-"}</td>
          <td>${tSnap.size || 0}</td>
          <td>${fmt(c.createdAt)}</td>
        </tr>`
      );
    }
    els.classesBody.innerHTML = rows.join("") || "<tr><td colspan='5'>لا توجد صفوف.</td></tr>";
  } catch (err) {
    console.warn(err);
    els.classesBody.innerHTML = "<tr><td colspan='5'>تعذّر التحميل.</td></tr>";
  }
}
