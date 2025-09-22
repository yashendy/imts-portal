// js/admin-dashboard.js
// Firebase Init
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, collectionGroup, query, where, orderBy,
  getDocs, getCountFromServer, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ------- Config -------
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrkmrX8SWy4rFbpWnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.firebasestorage.app",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGWJ9V"
};

// ------- Helpers -------
const $  = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const ok  = t => $("#globalMsg").innerHTML = `<div class="success">${t}</div>`;
const err = t => $("#globalMsg").innerHTML = `<div class="error">${t}</div>`;
function clearMsg(){ $("#globalMsg").innerHTML = ""; }

function showTab(name){
  $$(".nav").forEach(b => b.classList.toggle("active", b.dataset.tab===name));
  $$(".tab").forEach(s => s.classList.toggle("active", s.id === `tab-${name}`));
}

// ------- App -------
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// حالات تحميل التبويبات (Lazy)
const loaded = {
  overview:false, classes:false, teachers:false,
  link:false, subjects:false, students:false,
  timetable:false, invites:false, settings:false
};

// حالة عامة
let currentUser = null;
let userDoc = null;
let activeYearId = null;

// --------- Auth ---------
onAuthStateChanged(auth, async (u)=>{
  if(!u){ window.location.href="index.html"; return; }
  currentUser = u;

  try{
    // جلب المستخدم
    const us = await getDoc(doc(db,"users", u.uid));
    if(!us.exists()) { err("حسابك غير مهيأ. فعّل الحساب أولاً."); return; }
    userDoc = us.data();
    window.__userRole = userDoc.role || "";
    $("#roleChip").textContent = (window.__userRole || "").toUpperCase();

    // الإعدادات العامة
    await loadSettings();

    // تبويبات الـ Owner فقط
    $$(".owner-only").forEach(el => el.style.display = (window.__userRole==="owner" ? "" : "none"));

    // ربط أزرار التبويب (تحميل عند الطلب)
    $$(".nav").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const tab = btn.dataset.tab;
        showTab(tab);
        if(!loaded[tab]){
          try{
            if(tab==="overview") { await reloadOverview(); }
            if(tab==="classes")  { await loadGradesSelects(); await reloadClasses(); bindClassesActions(); }
            if(tab==="teachers") { await reloadTeachers(); bindTeacherActions(); }
            if(tab==="link")     { await loadGradesSelects(); await reloadLinkSelectors(); bindLinkActions(); }
            if(tab==="subjects") { await loadGradesSelects(); await reloadSubjects(); bindSubjectsActions(); }
            if(tab==="students") { await reloadStudents(); bindStudentsActions(); }
            if(tab==="timetable"){ await fillTTClasses(); await fillTemplates(); bindTTActions(); }
            if(tab==="invites")  { if(window.__userRole==="owner"){ await reloadInvites(); bindInvitesActions(); } }
            if(tab==="settings") { await reloadSettingsTab(); bindSettingsActions(); }
          }catch(e){ console.error(e); }
          loaded[tab] = true;
        }
      });
    });

    // تبويب البداية
    showTab("overview");

    // أزرار عامة
    $("#btnSignOut").addEventListener("click", ()=> signOut(auth));

  }catch(e){
    console.error(e);
    err("فشل تهيئة لوحة الإدارة");
  }
});

// ------- Settings / Years -------
async function loadSettings(){
  const s = await getDoc(doc(db,"settings","global"));
  if(s.exists()){
    const g = s.data();
    $("#instName").textContent = g.instituteName || $("#instName").textContent;
    activeYearId = g.activeYearId || "2025-2026";
    // yearSelect (قائمة بسيطة بسنة واحدة الآن)
    $("#yearSelect").innerHTML = `<option value="${activeYearId}">${activeYearId}</option>`;
  } else {
    activeYearId = "2025-2026";
    $("#yearSelect").innerHTML = `<option value="${activeYearId}">${activeYearId}</option>`;
  }
}

// ------- Overview -------
async function reloadOverview(){
  clearMsg();
  try{
    // Teachers
    const tQ = query(collection(db,"users"), where("role","==","teacher"));
    const tC = await getCountFromServer(tQ);
    $("#kTeachers").textContent = tC.data().count;

    // Classes (سنة فعالة)
    const cQ = query(collection(db,"classes"), where("yearId","==", activeYearId));
    const cC = await getCountFromServer(cQ);
    $("#kClasses").textContent = cC.data().count;

    // Students (collectionGroup)
    try{
      const sQ = query(collectionGroup(db,"students"), where("yearId","==", activeYearId));
      const sC = await getCountFromServer(sQ);
      $("#kStudents").textContent = sC.data().count;
    }catch(_){
      // لو القواعد لا تسمح collectionGroup للمعلم مثلاً
      $("#kStudents").textContent = "—";
    }

    // Subjects
    const subC = await getCountFromServer(collection(db,"subjects"));
    $("#kSubjects").textContent = subC.data().count;

    // Invites (للـ owner فقط) — داخل try/catch ولن تُسقط النظرة العامة
    const invEl = $("#kInvites");
    const isOwner = (window.__userRole === "owner");
    if(invEl){
      if(!isOwner){ invEl.textContent = "—"; }
      else{
        try{
          const iQ = query(collection(db,"invites"), where("active","==", true));
          const iC = await getCountFromServer(iQ);
          invEl.textContent = iC.data().count;
        }catch(e){
          console.warn("invites blocked by rules", e);
          invEl.textContent = "—";
        }
      }
    }

    $("#recentLog").textContent = "—";
  }catch(e){
    err("فشل تحميل النظرة العامة");
    console.error(e);
  }
}

// ------- Classes -------
async function loadGradesSelects(){
  // ملء قوائم الدرجات والشُعب
  const gSnap = await getDocs(query(collection(db,"grades"), orderBy("order","asc")));
  const grades = gSnap.docs.map(d=>({id:d.id, ...d.data()}));

  const gradeOpts = grades.map(g=>`<option value="${g.id}">${g.name}</option>`).join("");
  $("#cGrade").innerHTML       = gradeOpts;
  $("#subjGradeSel").innerHTML = gradeOpts;
  $("#subjGrade").innerHTML    = `<option value="">كل الصفوف</option>${gradeOpts}`;
  $("#linkGrade").innerHTML    = `<option value="">اختر الصف</option>${gradeOpts}`;

  // الشُعب من الإعدادات
  const s = await getDoc(doc(db,"settings","global"));
  let sections = ["A","B","C","D"];
  if(s.exists() && Array.isArray(s.data().sections)) sections = s.data().sections;
  $("#cSection").innerHTML = sections.map(x=>`<option value="${x}">${x}</option>`).join("");
}

function buildClassId({gradeId, trackCode, section}){
  return `${gradeId}${trackCode?`-${trackCode}`:""}-${section}`;
}

async function reloadClasses(){
  const tbody = $("#classesTable tbody");
  tbody.innerHTML = "";
  const qy = query(collection(db,"classes"), where("yearId","==", activeYearId));
  const snap = await getDocs(qy);
  snap.forEach(d=>{
    const c = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.id}</td>
      <td>${c.displayNameAr||""}</td>
      <td>${c.gradeId||""}</td>
      <td>${c.section||""}</td>
      <td>${c.capacity||""}</td>
      <td>${c.active?"✓":"—"}</td>
      <td><button class="btn danger btnDelClass" data-id="${d.id}" type="button">حذف</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function bindClassesActions(){
  $("#btnCreateClass").onclick = async ()=>{
    clearMsg();
    try{
      const gradeId  = $("#cGrade").value;
      const track    = $("#cTrack").value;
      const section  = $("#cSection").value;
      const sectionAr= $("#cSectionAr").value.trim();
      const nameAr   = $("#cNameAr").value.trim();
      const capacity = parseInt($("#cCapacity").value||"40",10);
      const id = buildClassId({gradeId, trackCode:track, section});

      await setDoc(doc(db,"classes", id), {
        gradeId, trackId: track?`${gradeId}-${track}`:"", trackCode: track||"",
        section, sectionAr: sectionAr||"", displayNameAr: nameAr||id,
        capacity: capacity||40, yearId: activeYearId, active: true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge:true });

      ok("تم حفظ الفصل");
      await reloadClasses();
    }catch(e){ console.error(e); err("فشل حفظ الفصل"); }
  };

  // حذف فصل
  $("#classesTable").addEventListener("click", async (e)=>{
    const btn = e.target.closest(".btnDelClass");
    if(!btn) return;
    if(!confirm("تأكيد حذف الفصل؟")) return;
    try{
      await deleteDoc(doc(db,"classes", btn.dataset.id));
      ok("تم حذف الفصل"); await reloadClasses();
    }catch(er){ console.error(er); err("فشل الحذف"); }
  });
}

// ------- Teachers -------
async function reloadTeachers(){
  const tbody = $("#teachersTable tbody");
  tbody.innerHTML = "";
  const qy = query(collection(db,"users"), where("role","==","teacher"));
  const snap = await getDocs(qy);
  snap.forEach(d=>{
    const u = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${u.displayName||""}</td><td>${u.email||""}</td><td>${u.status||""}</td><td>${u.role||""}</td>`;
    tbody.appendChild(tr);
  });
}
function bindTeacherActions(){
  $("#btnReloadTeachers").onclick = reloadTeachers;
}

// ------- Link (Teacher <-> Class <-> Subject) -------
// مبدئيًا تعبئة القوائم فقط (الربط الفعلي يمكنك تكملته لاحقًا)
async function reloadLinkSelectors(){
  // معلّمين
  const tSel = $("#linkTeacher"); tSel.innerHTML = "";
  const tSnap = await getDocs(query(collection(db,"users"), where("role","==","teacher")));
  tSel.innerHTML = `<option value="">اختر معلّم</option>` + tSnap.docs.map(d=>`<option value="${d.id}">${d.data().displayName||d.data().email}</option>`).join("");

  // الصفوف
  const gSel = $("#linkGrade");
  // تم ملؤها في loadGradesSelects()
  await fillClassesForGrade();

  // مواد
  await fillSubjectsForGrade();
}
async function fillClassesForGrade(){
  const gradeId = $("#linkGrade").value;
  const cSel = $("#linkClass");
  cSel.innerHTML = `<option value="">اختر فصل</option>`;
  if(!gradeId) return;
  const snap = await getDocs(query(collection(db,"classes"),
                    where("gradeId","==", gradeId),
                    where("yearId","==", activeYearId)));
  cSel.innerHTML += snap.docs.map(d=>`<option value="${d.id}">${d.data().displayNameAr||d.id}</option>`).join("");
}
async function fillSubjectsForGrade(){
  const gradeId = $("#linkGrade").value;
  const sSel = $("#linkSubject");
  sSel.innerHTML = `<option value="">اختر مادة</option>`;
  if(!gradeId) return;
  const snap = await getDocs(query(collection(db,"subjects"), where("gradeId","==", gradeId)));
  sSel.innerHTML += snap.docs.map(d=>`<option value="${d.id}">${d.data().nameAr||d.id}</option>`).join("");
}
function bindLinkActions(){
  $("#linkGrade").onchange = async ()=>{ await fillClassesForGrade(); await fillSubjectsForGrade(); };
  $("#btnLink").onclick = ()=> alert("ميزة الربط التفصيلية يمكن تفعيلها لاحقًا (تم تجهيز القوائم)");
}

// ------- Subjects -------
async function reloadSubjects(){
  const tbody = $("#subjectsTable tbody"); tbody.innerHTML="";
  const gradeId = $("#subjGrade").value;
  const base = collection(db,"subjects");
  const qy = gradeId? query(base, where("gradeId","==",gradeId)) : base;
  const snap = await getDocs(qy);
  snap.forEach(d=>{
    const s = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${d.id}</td><td>${s.nameAr||""}</td><td>${s.gradeId||""}</td>
      <td><button class="btn danger btnDelSubject" data-id="${d.id}" type="button">حذف</button></td>`;
    tbody.appendChild(tr);
  });
}
function bindSubjectsActions(){
  $("#btnReloadSubjects").onclick = reloadSubjects;
  $("#btnCreateSubject").onclick = async ()=>{
    clearMsg();
    try{
      const id   = $("#subjId").value.trim();
      const name = $("#subjNameAr").value.trim();
      const code = $("#subjCode").value.trim();
      const gId  = $("#subjGradeSel").value;
      if(!id || !name || !code || !gId) return err("أكمل بيانات المادة");

      await setDoc(doc(db,"subjects", id), {
        nameAr:name, code, gradeId:gId, compulsory:true, active:true,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }, { merge:true });

      ok("تم حفظ المادة"); await reloadSubjects();
    }catch(e){ console.error(e); err("فشل حفظ المادة"); }
  };
  $("#subjectsTable").addEventListener("click", async (e)=>{
    const btn = e.target.closest(".btnDelSubject");
    if(!btn) return;
    if(!confirm("تأكيد حذف المادة؟")) return;
    try{ await deleteDoc(doc(db,"subjects", btn.dataset.id)); ok("حُذفت المادة"); await reloadSubjects(); }
    catch(er){ console.error(er); err("فشل الحذف"); }
  });
}

// ------- Students -------
async function reloadStudents(){
  const tbody = $("#studentsTable tbody"); tbody.innerHTML="";
  try{
    const sQ = query(collectionGroup(db,"students"), where("yearId","==", activeYearId));
    const snap = await getDocs(sQ);
    snap.forEach(d=>{
      const s = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${s.fullName||""}</td><td>${s.gender||""}</td><td>${s.religion||""}</td>
                      <td>${s.code||""}</td><td>${s.classId||""}</td><td>${s.yearId||""}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){
    console.warn("students listing blocked by rules", e);
    tbody.innerHTML = `<tr><td colspan="6">—</td></tr>`;
  }
}
function bindStudentsActions(){
  $("#btnReloadStudents").onclick = reloadStudents;
}

// ------- Timetable (Placeholder مبسّط) -------
async function fillTTClasses(){
  const cSel = $("#ttClass"); cSel.innerHTML="";
  const snap = await getDocs(query(collection(db,"classes"), where("yearId","==", activeYearId)));
  cSel.innerHTML = snap.docs.map(d=>`<option value="${d.id}">${d.data().displayNameAr||d.id}</option>`).join("");
}
async function fillTemplates(){
  const tSel = $("#ttTemplate"); tSel.innerHTML="";
  const snap = await getDocs(collection(db,"periodTemplates"));
  tSel.innerHTML = snap.docs.map(d=>`<option value="${d.id}">${d.data().name||d.id}</option>`).join("");
}
function bindTTActions(){
  $("#btnTTLoad").onclick = ()=>{
    const c = $("#ttClass").value; const t = $("#ttTemplate").value;
    $("#ttGrid").innerHTML = c && t ? `<div class="hint">تم تحميل الشبكة (عرض مبسّط)</div>` : `<div class="error">اختر فصلًا وقالب فترات</div>`;
  };
}

// ------- Invites (للـ Owner فقط) -------
async function reloadInvites(){
  const tbody = $("#invTable tbody"); tbody.innerHTML="";
  try{
    const snap = await getDocs(query(collection(db,"invites"), where("active","==", true)));
    snap.forEach(d=>{
      const v = d.data();
      const tr = document.createElement("tr");
      const exp = v.expiresAt?.toDate?.() ? v.expiresAt.toDate().toLocaleDateString('ar-EG') : "—";
      tr.innerHTML = `<td>${d.id}</td><td>${v.role}</td><td>${exp}</td><td>${v.active?"✓":"—"}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){ console.warn("invites list blocked by rules", e); }
}
function bindInvitesActions(){
  $("#btnCreateInvite").onclick = ()=> alert("إنشاء الدعوات مفعّل في نسختك عند تفعيل القواعد. (تبسيط)");
}

// ------- Settings Tab -------
async function reloadSettingsTab(){
  $("#setYear").innerHTML = `<option value="${activeYearId}">${activeYearId}</option>`;
  $("#setName").value = $("#instName").textContent || "";
}
function bindSettingsActions(){
  $("#btnSaveSettings").onclick = async ()=>{
    try{
      await updateDoc(doc(db,"settings","global"), {
        instituteName: $("#setName").value.trim() || "معهد الدراسات الإدارية والفنية",
        activeYearId, updatedAt: serverTimestamp()
      });
      $("#instName").textContent = $("#setName").value.trim() || "معهد الدراسات الإدارية والفنية";
      ok("تم حفظ الإعدادات");
    }catch(e){ console.error(e); err("فشل حفظ الإعدادات"); }
  };
  $("#btnRunSeed").onclick = async ()=>{
    try{
      const { runSeed } = await import("./seed.js");
      const res = await runSeed({ db, activeYearId });
      ok(res==="already-seeded" ? "سبق تهيئة هذه السنة" : "تمت التهيئة بنجاح");
    }catch(e){ console.error(e); err("فشل التهيئة"); }
  };
}
