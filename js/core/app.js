// /js/core/app.js
import { auth, db, serverTimestamp } from "./firebase.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";

/* عناصر مساعدة صغيرة */
export const qs  = (sel, root=document) => root.querySelector(sel);
export const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];

export function toast(msg, type = "ok") {
  const el = qs("#toast");
  if (el) {
    el.textContent = msg;
    el.className = `toast show ${type}`;
    setTimeout(()=> el.className = "toast", 3500);
  } else {
    alert(msg);
  }
}

export function showLoader() { qs("#loader")?.classList.add("show"); }
export function hideLoader() { qs("#loader")?.classList.remove("show"); }

/* سنة حالية من settings/global */
let _currentYearId = null;
export async function getCurrentYearId() {
  if (_currentYearId) return _currentYearId;
  const snap = await getDoc(doc(db, "settings", "global"));
  _currentYearId = snap.exists() ? (snap.data().currentAcademicYearId || null) : null;
  return _currentYearId;
}

/* معلومات المعهد (اسم/ألوان/تواصل) */
export async function getInstituteInfo() {
  const snap = await getDoc(doc(db, "settings", "global"));
  return snap.exists() ? (snap.data().institute || {}) : {};
}

/* كتابة وثيقة مستخدم عند أول دخول (بدون role) */
export async function ensureUserDocExists(uid, data={}) {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...data,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

/* التحقق من الدور */
export async function requireRole(roles = ["owner", "admin"]) {
  const user = auth.currentUser;
  if (!user) return { allowed: false, role: null };

  const snap = await getDoc(doc(db, "users", user.uid));
  const role = snap.exists() ? (snap.data().role || null) : null;

  const allowed = Array.isArray(roles) ? roles.includes(role) : (role === roles);
  return { allowed, role };
}

/* اسم عرض للصف */
export function displayClassName(c) {
  if (!c) return "";
  if (c.nameAr) return c.nameAr;
  const g = c.gradeId?.toUpperCase() || "";
  const t = c.trackCode?.toUpperCase() || "";
  const s = c.section || "";
  return `${g}-${t}-${s}`;
}
