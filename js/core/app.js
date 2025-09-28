// js/core/app.js
// Common app utilities (built on top of js/core/firebase.js)
// Works with your current Firestore structure (settings/global, users/*, etc.)

import { auth, db, serverTimestamp } from "./firebase.js";
import {
  doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";

/* ===============================
   Config & Keys
=================================*/
const STORAGE_KEYS = Object.freeze({
  SESSION: "app.session",            // { uid, role, displayName, email }
  CURRENT_YEAR: "app.currentYear",   // { value, exp }
  INSTITUTE: "app.institute",        // { value, exp }
});
const CACHE_TTL_MINUTES = 30;
const REDIRECTS = Object.freeze({
  LOGIN: "index.html",
});
const DAYS_AR = Object.freeze({
  sun: "الأحد",
  mon: "الإثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
});

/* ===============================
   Small Utilities
=================================*/
const now = () => Date.now();
const minutes = (m) => m * 60 * 1000;

function setCache(key, value, ttlMin = CACHE_TTL_MINUTES) {
  const payload = { value, exp: now() + minutes(ttlMin) };
  sessionStorage.setItem(key, JSON.stringify(payload));
}

function getCache(key) {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const { value, exp } = JSON.parse(raw);
    if (exp && now() < exp) return value;
  } catch (_) {}
  sessionStorage.removeItem(key);
  return null;
}

function q(sel, root = document) { return root.querySelector(sel); }
function qa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/* ===============================
   UI: Loader & Toast
=================================*/
function ensureLoader() {
  let el = q("#app-loader");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-loader";
    el.style.cssText = `
      position:fixed;inset:0;display:none;place-items:center;
      background:rgba(0,0,0,.15);backdrop-filter:saturate(120%) blur(2px);z-index:9999;
      font-family: inherit;
    `;
    el.innerHTML = `
      <div style="
        background: var(--surface, #fff);
        color: var(--text, #111);
        padding:16px 18px;border-radius:14px;box-shadow: 0 6px 40px rgba(0,0,0,.18);
        display:flex;gap:12px;align-items:center;min-width:220px;justify-content:center">
        <span class="spinner" style="
          width:18px;height:18px;border-radius:50%;
          border:3px solid rgba(0,0,0,.12);
          border-top-color: var(--color-primary,#2962FF);
          animation:spin 1s linear infinite"></span>
        <b>جارٍ المعالجة…</b>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;
    document.body.appendChild(el);
  }
  return el;
}
function showLoader() { ensureLoader().style.display = "grid"; }
function hideLoader() { const el = ensureLoader(); el.style.display = "none"; }

function ensureToastRoot() {
  let root = q("#app-toast");
  if (!root) {
    root = document.createElement("div");
    root.id = "app-toast";
    root.style.cssText = `
      position: fixed; inset-inline-end: 16px; inset-block-end: 16px;
      display:flex; flex-direction:column; gap:10px; z-index: 10000;
      font-family: inherit;
    `;
    document.body.appendChild(root);
  }
  return root;
}
function toast(type = "info", message = "", durationMs = 3500) {
  const colors = {
    success: { bg: "var(--toast-success, #E6F6EA)", fg: "var(--success-fg,#1B5E20)", bd: "var(--success-bd,#B2DFDB)" },
    warning: { bg: "var(--toast-warning, #FFF7E0)", fg: "var(--warning-fg,#7A4F01)", bd: "var(--warning-bd,#FFE082)" },
    error:   { bg: "var(--toast-error, #FDEAEA)", fg: "var(--error-fg,#7F1D1D)", bd: "var(--error-bd,#F5C2C2)" },
    info:    { bg: "var(--toast-info, #EAF3FF)",  fg: "var(--info-fg,#0B3C7D)",  bd: "var(--info-bd,#BBDEFB)" },
  };
  const c = colors[type] || colors.info;
  const item = document.createElement("div");
  item.role = "status";
  item.style.cssText = `
    background:${c.bg}; color:${c.fg}; border:1px solid ${c.bd};
    padding:10px 12px; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.08);
    max-width: 380px; direction: rtl;
  `;
  item.textContent = message;
  const root = ensureToastRoot();
  root.appendChild(item);
  setTimeout(() => item.remove(), durationMs);
}

/* ===============================
   RTL & Theme (Colors + Fonts)
=================================*/
function applyRTL() {
  const html = document.documentElement;
  if (html.getAttribute("dir") !== "rtl") {
    html.setAttribute("dir", "rtl");
  }
}

function applyThemeFromSettings(institute = {}) {
  const colors = (institute && institute.colors) || {};
  const rs = document.documentElement.style;
  // Map Firestore colors → CSS custom properties
  if (colors.primary)   rs.setProperty("--color-primary", colors.primary);
  if (colors.secondary) rs.setProperty("--color-secondary", colors.secondary);
  if (colors.accent)    rs.setProperty("--color-accent", colors.accent);
  if (colors.warning)   rs.setProperty("--color-warning", colors.warning);
  if (colors.error)     rs.setProperty("--color-error", colors.error);
  // Derive common surfaces (simple fallbacks)
  rs.setProperty("--surface", "#fff");
  rs.setProperty("--text", "#111");
}

/* ===============================
   Settings Readers (with cache)
=================================*/
async function getCurrentYearId() {
  const cached = getCache(STORAGE_KEYS.CURRENT_YEAR);
  if (cached) return cached;
  const snap = await getDoc(doc(db, "settings", "global"));
  const data = snap.exists() ? snap.data() : {};
  const year = (data.currentAcademicYearId || "2025-2026");
  setCache(STORAGE_KEYS.CURRENT_YEAR, year);
  return year;
}

async function getInstituteInfo() {
  const cached = getCache(STORAGE_KEYS.INSTITUTE);
  if (cached) {
    applyThemeFromSettings(cached);
    return cached;
  }
  const snap = await getDoc(doc(db, "settings", "global"));
  const data = snap.exists() ? snap.data() : {};
  const institute = data.institute || {};
  // Fallback logo
  if (!institute.logoUrl) institute.logoUrl = "assets/logo.png";
  setCache(STORAGE_KEYS.INSTITUTE, institute);
  applyThemeFromSettings(institute);
  return institute;
}

/* ===============================
   Session & Roles
=================================*/
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.SESSION) || "null"); }
  catch { return null; }
}
function setSession(payload) {
  sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(payload));
  return payload;
}
function clearSession() {
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
}

async function getUserDoc(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: uid, ...snap.data() } : null;
}

const AUTH_ERRORS_AR = {
  "auth/invalid-email": "البريد الإلكتروني غير صحيح.",
  "auth/invalid-credential": "البيانات غير صحيحة.",
  "auth/user-not-found": "المستخدم غير موجود.",
  "auth/wrong-password": "كلمة المرور غير صحيحة.",
  "auth/too-many-requests": "محاولات كثيرة — جرّب لاحقًا.",
  "auth/user-disabled": "هذا الحساب موقوف.",
};

function humanAuthError(e) {
  const code = (e && e.code) || "";
  return AUTH_ERRORS_AR[code] || "حدث خطأ غير متوقع. حاول مرة أخرى.";
}

/**
 * requireRole: Guard the page by allowed roles.
 * - roles: array of strings, e.g. ["admin","owner"] or ["teacher"]
 * - returns Promise<{ user, userDoc }>
 */
function requireRole(roles = []) {
  return new Promise((resolve) => {
    applyRTL(); // ensure RTL early
    const cached = getSession();
    // Fast-path: if session exists & role allowed, resolve after verifying token state
    if (cached && roles.includes(cached.role)) {
      // Verify still signed-in
      onAuthStateChanged(auth, async (user) => {
        if (user?.uid === cached.uid) {
          resolve({ user, userDoc: await getUserDoc(user.uid) });
        } else {
          // session stale
          clearSession();
          location.href = REDIRECTS.LOGIN;
        }
      }, () => {});
      return;
    }
    // Normal path: wait for auth
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        toast("warning", "الرجاء تسجيل الدخول أولًا.");
        location.href = REDIRECTS.LOGIN;
        return;
      }
      const udoc = await getUserDoc(user.uid);
      const role = udoc?.role || "";
      if (!roles.includes(role)) {
        toast("error", "ليس لديك صلاحية للوصول إلى هذه الصفحة.");
        await signOutSafe(false);
        location.href = REDIRECTS.LOGIN;
        return;
      }
      setSession({
        uid: user.uid,
        role,
        displayName: udoc?.nameAr || udoc?.nameEn || user.email || "",
        email: user.email || "",
      });
      resolve({ user, userDoc: udoc });
    }, (err) => {
      console.error(err);
      toast("error", humanAuthError(err));
      location.href = REDIRECTS.LOGIN;
    });
  });
}

async function signOutSafe(showMsg = true) {
  try {
    await signOut(auth);
  } finally {
    clearSession();
    if (showMsg) toast("success", "تم تسجيل الخروج.");
  }
}

/* ===============================
   Helpers for timetable & display
=================================*/
function dayToAr(code) { return DAYS_AR[code] || code; }

function formatTime(hhmm = "08:00") {
  // returns "08:00" (already fine for RTL)
  return hhmm;
}

function displayClassName({ gradeId = "", trackCode = "", section = "", nameAr = "" } = {}) {
  if (nameAr) return nameAr;
  // Generate Arabic label like: "الصف الأول ابتدائي ـ عربي ـ أ"
  // NOTE: simple map for grades 1..12
  const G_MAP = {
    g1: "الصف الأول ابتدائي",
    g2: "الصف الثاني ابتدائي",
    g3: "الصف الثالث ابتدائي",
    g4: "الصف الرابع ابتدائي",
    g5: "الصف الخامس ابتدائي",
    g6: "الصف السادس ابتدائي",
    g7: "الصف الأول إعدادي",
    g8: "الصف الثاني إعدادي",
    g9: "الصف الثالث إعدادي",
    g10: "الصف الأول ثانوي",
    g11: "الصف الثاني ثانوي",
    g12: "الصف الثالث ثانوي",
  };
  const T_MAP = { ar: "عربي", lang: "لغات" };
  const secAr = sectionToAr(section);
  const g = G_MAP[gradeId] || gradeId;
  const t = T_MAP[trackCode] || trackCode;
  if (!g || !t || !secAr) return `${gradeId} ـ ${trackCode} ـ ${section}`;
  return `${g} ـ ${t} ـ ${secAr}`;
}

function sectionToAr(section = "") {
  const map = { A: "أ", B: "ب", C: "ج", D: "د", E: "هـ", F: "و" };
  return map[section] || section;
}

/* ===============================
   Public API (exports)
=================================*/
export {
  // settings
  getCurrentYearId,
  getInstituteInfo,
  // session & roles
  getUserDoc,
  requireRole,
  signOutSafe,
  // ui
  toast, showLoader, hideLoader,
  // helpers
  dayToAr, formatTime, displayClassName,
  // low-level utils
  serverTimestamp,
};

// Also expose a read-only global for non-module scripts if needed
window.App = Object.freeze({
  getCurrentYearId, getInstituteInfo,
  getUserDoc, requireRole, signOutSafe,
  toast, showLoader, hideLoader,
  dayToAr, formatTime, displayClassName,
  serverTimestamp,
});
