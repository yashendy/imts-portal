/* =======================================================================
   Admin Dashboard (Final) — معهد الدراسات الإدارية والفنية
   - ثنائي اللغة داخليًا لكن الواجهة RTL عربية
   - متوافق مع هيكل Firestore المعتمد عندك (subjects قد تكون track-specific)
   - يحل خطأ ReferenceError: linkTeacherHandler
   - يفلتر المواد حسب gradeId + توافق trackId مع الفصل (أو مواد عامة)
   - يتضمن توليد StaffCode + Invite للمعلمين
   - إدارة الطلاب (فردي + CSV) مع gender/religion
   - جدول حصص كامل مع تضارب، استيراد/تصدير CSV
======================================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
  collection, getDocs, query, where, orderBy, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { runSeed } from "./seed.js";

/* ------------ Firebase Config ------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrkmrX8SWy4rFbpWnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.firebasestorage.app",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGWJ9V"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ------------ Helpers ------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const msg = $("#globalMsg");
function ok(t){ if(msg) msg.innerHTML = `<div class="success">${escapeHtml(t)}</div>`; }
function err(t){ if(msg) msg.innerHTML = `<div class="error">${escapeHtml(t)}</div>`; }
function clearMsg(){ if(msg) msg.innerHTML = ""; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function rid(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
const DAYS = ["Sat","Sun","Mon","Tue","Wed","Thu"];
const DAY_AR = {Sat:"السبت", Sun:"الأحد", Mon:"الاثنين", Tue:"الثلاثاء", Wed:"الأربعاء", Thu:"الخميس"};
let currentUser=null, currentRole="admin", activeYearId="";
const nowYear = new Date().getFullYear();

/* ------------ Tabs ------------- */
$$(".nav").forEach(b=>{
  b.addEventListener("click", ()=>{
    $$(".nav").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.dataset.tab;
    $$(".tab").forEach(x=>x.classList.remove("active"));
    const target = $(`#tab-${tab}`); if(target) target.classList.add("active");
    clearMsg();
    if(tab==="invites") loadInvites();
  });
});

/* ------------ Auth gate ------------- */
onAuthStateChanged(auth, async (u)=>{
  if(!u){ window.location.href="index.html"; return; }
  currentUser = u;

  const uref = doc(db,"users",u.uid);
  const us   = await getDoc(uref);
  if(!us.exists()){ err("لا توجد وثيقة مستخدم، برجاء إعادة التفعيل."); return; }
  currentRole = us.data().role || "admin";
  const roleChip = $("#roleChip"); if(roleChip) roleChip.textContent = currentRole.toUpperCase();
  if(currentRole === "owner"){ $$(".owner-only").forEach(el=> el.style.display = ""); }

  await loadSettings();

  await Promise.all([
    reloadOverview(),
    loadGradesSelects(),
    reloadTeachers(),
    reloadClasses(),
    fillTTClasses(),
    reloadSubjects()
  ]);

  // Header actions
  const signBtn = $("#btnSignOut");
  if(signBtn) signBtn.addEventListener("click", async ()=>{ await signOut(auth); window.location.href = "index.html"; });

  // Teachers tab
  const btnLink = $("#btnLink");
  if(btnLink) btnLink.addEventListener("click", linkTeacherHandler);
  const btnReloadTeachers = $("#btnReloadTeachers");
  if(btnReloadTeachers) btnReloadTeachers.addEventListener("click", reloadTeachers);

  // Classes tab
  const btnCreateClass = $("#btnCreateClass");
  if(btnCreateClass) btnCreateClass.addEventListener("click", createClassHandler);

  // Roster dialog
  const btnDownloadTemplate = $("#btnDownloadTemplate");
  if(btnDownloadTemplate) btnDownloadTemplate.addEventListener("click", downloadTemplate);
  const btnImportCsv = $("#btnImportCsv");
  if(btnImportCsv) btnImportCsv.addEventListener("click", importCsvHandler);
  const btnAddStudent = $("#btnAddStudent");
  if(btnAddStudent) btnAddStudent.addEventListener("click", addOneStudent);
  const filterGender = $("#filterGender");
  if(filterGender) filterGender.addEventListener("change", reloadRoster);
  const filterReligion = $("#filterReligion");
  if(filterReligion) filterReligion.addEventListener("change", reloadRoster);

  // Students tab
  const btnReloadStudents = $("#btnReloadStudents");
  if(btnReloadStudents) btnReloadStudents.addEventListener("click", reloadStudents);
  const btnOpenStudentForm = $("#btnOpenStudentForm");
  if(btnOpenStudentForm) btnOpenStudentForm.addEventListener("click", async ()=>{
    await fillStudentFormClasses();
    $("#studentFormDialog").showModal();
  });
  const btnSaveStudent = $("#btnSaveStudent");
  if(btnSaveStudent) btnSaveStudent.addEventListener("click", ()=> saveStudentForm(false));
  const btnSaveStudentNext = $("#btnSaveStudentNext");
  if(btnSaveStudentNext) btnSaveStudentNext.addEventListener("click", ()=> saveStudentForm(true));

  // Subjects tab
  const btnCreateSubject = $("#btnCreateSubject");
  if(btnCreateSubject) btnCreateSubject.addEventListener("click", createSubjectHandler);
  const btnReloadSubjects = $("#btnReloadSubjects");
  if(btnReloadSubjects) btnReloadSubjects.addEventListener("click", reloadSubjects);

  // Invites (owner)
  const btnCreateInvite = $("#btnCreateInvite");
  if(btnCreateInvite) btnCreateInvite.addEventListener("click", createInviteHandler);

  // Settings (owner)
  const btnSaveSettings = $("#btnSaveSettings");
  if(btnSaveSettings) btnSaveSettings.addEventListener("click", saveSettingsHandler);
  const btnRunSeed = $("#btnRunSeed");
  if(btnRunSeed) btnRunSeed.addEventListener("click", ()=> runSeed({db, activeYearId}).then(()=>ok("تمت التهيئة بنجاح")).catch(e=>err(e.message||e)));

  const yearSel = $("#yearSelect");
  if(yearSel) yearSel.addEventListener("change", async (e)=>{
    activeYearId = e.target.value;
    await Promise.all([reloadOverview(), reloadClasses(), reloadSubjects(), fillTTClasses()]);
  });

  // Timetable UI
  await initTimetableUI();
});

/* ------------ Settings ------------ */
async function loadSettings(){
  try{
    const gsnap = await getDoc(doc(db,"settings","global"));
    const name = gsnap.exists() ? (gsnap.data().instituteName || "المعهد") : "المعهد";
    const title = $("#instName"); if(title) title.textContent = name;

    const years = new Set();
    (await getDocs(collection(db,"academicYears"))).forEach(d=> years.add(d.id));
    activeYearId = gsnap.exists() ? (gsnap.data().activeYearId || [...years][0]) : ([...years][0] || "2025-2026");

    const yearSel = $("#yearSelect"); if(yearSel){ yearSel.innerHTML="";
      [...years].sort().forEach(y=>{
        const opt = document.createElement("option");
        opt.value=opt.textContent=y;
        if(y===activeYearId) opt.selected=true;
        yearSel.appendChild(opt);
      });
    }

    const setYear = $("#setYear"); if(setYear){
      setYear.innerHTML="";
      [...years].sort().forEach(y=>{
        const o=document.createElement("option"); o.value=o.textContent=y; setYear.appendChild(o);
      });
      const setName = $("#setName"); if(setName) setName.value = name;
      setYear.value = activeYearId;
    }
  }catch(e){ err("تعذّر تحميل الإعدادات"); console.error(e); }
}

/* ------------ Overview ------------ */
async function reloadOverview(){
  try{
    const tSnap = await getDocs(query(collection(db,"users"), where("role","==","teacher")));
    const kTeachers = $("#kTeachers"); if(kTeachers) kTeachers.textContent = tSnap.size;

    const cSnap = await getDocs(query(collection(db,"classes"), where("yearId","==",activeYearId)));
    const kClasses = $("#kClasses"); if(kClasses) kClasses.textContent = cSnap.size;

    const sSnap = await getDocs(collection(db,"students"));
    const kStudents = $("#kStudents"); if(kStudents) kStudents.textContent = sSnap.size;

    const subjSnap = await getDocs(collection(db,"subjects"));
    const kSubjects = $("#kSubjects"); if(kSubjects) kSubjects.textContent = subjSnap.size;

    if(currentRole==="owner"){
      try{
        let active=0;
        const invSnap = await getDocs(collection(db,"invites"));
        const now = Date.now();
        invSnap.forEach(d=>{
          const x = d.data(); 
          const exp = x.expiresAt && x.expiresAt.toMillis ? x.expiresAt.toMillis() : null;
          if(x.active && (!exp || exp > now)) active++;
        });
        const kInvites = $("#kInvites"); if(kInvites) kInvites.textContent = active;
      }catch(e){
        console.warn("invites list blocked by rules", e);
        const kInvites = $("#kInvites"); if(kInvites) kInvites.textContent = "—";
      }
    }
    const recent = $("#recentLog"); if(recent) recent.textContent = "جاهز ✨";
  }catch(e){ err("فشل تحميل النظرة العامة"); console.error(e); }
}

/* ------------ Dropdowns ------------ */
async function loadGradesSelects(){
  const grades = []; (await getDocs(collection(db,"grades"))).forEach(d=> grades.push({id:d.id, ...d.data()}));
  let sections = ["A","B","C","D"];
  try{
    const gsnap = await getDoc(doc(db,"settings","global"));
    if(gsnap.exists() && Array.isArray(gsnap.data().sections)) sections = gsnap.data().sections;
  }catch{}

  const fill = (sel, options)=>{ if(!sel) return; sel.innerHTML=""; options.forEach(o=> sel.insertAdjacentHTML("beforeend", `<option value="${o.value}">${o.label}</option>`)); };
  fill($("#linkGrade"), grades.map(g=>({value:g.id,label:g.name||g.id})));
  fill($("#cGrade"), grades.map(g=>({value:g.id,label:g.name||g.id})));
  fill($("#subjGrade"), grades.map(g=>({value:g.id,label:g.name||g.id})));
  fill($("#subjGradeSel"), grades.map(g=>({value:g.id,label:g.name||g.id})));

  const sectionsOpts = sections.map(s=>({value:s,label:s}));
  fill($("#cSection"), sectionsOpts);

  const teachers = [];
  (await getDocs(query(collection(db,"users"), where("role","==","teacher")))).forEach(d=> teachers.push({id:d.id,...d.data()}));
  const linkTeacher = $("#linkTeacher");
  if(linkTeacher) linkTeacher.innerHTML = teachers.map(t=> `<option value="${t.id}">${escapeHtml(t.displayName||t.email)} (${t.email})</option>`).join("");

  const linkGrade = $("#linkGrade");
  if(linkGrade){
    linkGrade.addEventListener("change", ()=> reloadClassAndSubjectSelects());
    await reloadClassAndSubjectSelects();
  }
  await fillTTClasses();
}

/* ------------ Track-aware subjects + classes for Teacher linking ------------ */
async function reloadClassAndSubjectSelects(){
  const gradeSel = $("#linkGrade"); const clsSel = $("#linkClass"); const sSel = $("#linkSubject");
  if(!gradeSel || !clsSel || !sSel) return;

  const g = gradeSel.value;
  clsSel.innerHTML = ""; sSel.innerHTML = "";

  // classes of grade + year
  const cSnap = await getDocs(query(
    collection(db,"classes"),
    where("yearId","==",activeYearId),
    where("gradeId","==",g)
  ));
  const classes = [];
  cSnap.forEach(d=>{
    const c = d.data(); classes.push({id:d.id, ...c});
    const label = c.displayNameAr ? `${c.displayNameAr} (${d.id})` : d.id;
    clsSel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${escapeHtml(label)}</option>`);
  });
  if(classes.length===0) return;

  // determine selected class + its trackId (e.g., "g10-ar")
  const classId = clsSel.value;
  const C = classes.find(x=> x.id===classId);
  const classTrackId = C?.trackId || null;

  // fetch subjects by grade; filter by track compatibility:
  //   OK if subject.trackId == classTrackId OR subject.trackId is missing (general)
  const subjSnap = await getDocs(query(collection(db,"subjects"), where("gradeId","==",g)));
  sSel.innerHTML = "";
  subjSnap.forEach(d=>{
    const s = d.data();
    const okByTrack = !s.trackId || !classTrackId || s.trackId === classTrackId;
    if(okByTrack){
      const label = s.nameAr || s.name || d.id;
      sSel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${escapeHtml(label)}</option>`);
    }
  });

  // reload subjects when class changes (to reflect track)
  clsSel.addEventListener("change", reloadClassAndSubjectSelects, { once:true });
}

/* ------------ Teachers listing + codes ------------ */
async function reloadTeachers(){
  try{
    const term = ($("#teacherSearch")?.value || "").trim().toLowerCase();
    const tbody = $("#teachersTable tbody"); if(!tbody) return; tbody.innerHTML="";

    const snap = await getDocs(query(collection(db,"users"), where("role","==","teacher")));
    for (const d of snap.docs){
      const u = d.data();
      const name = (u.displayName||"").toLowerCase();
      const email= (u.email||"").toLowerCase();
      if(term && !(name.includes(term) || email.includes(term))) continue;

      const links = await getDocs(query(collection(db,"classTeachers"), where("teacherId","==",d.id)));
      const staffCode = u.staffCode || "-";

      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${escapeHtml(u.displayName||"")}</td>
         <td>${escapeHtml(u.email||"")}</td>
         <td>${escapeHtml(u.status||"-")}</td>
         <td>${links.size}</td>
         <td>${escapeHtml(staffCode)}</td>
         <td>
           <button class="btn secondary" data-act="staff" data-uid="${d.id}">${staffCode==="-"?"توليد StaffCode":"إعادة توليد"}</button>
           <button class="btn muted" data-act="invite" data-uid="${d.id}">توليد دعوة Teacher</button>
         </td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("button").forEach(b=>{
      const uid = b.dataset.uid;
      if(b.dataset.act==="staff") b.addEventListener("click", ()=> generateStaffCode(uid));
      if(b.dataset.act==="invite") b.addEventListener("click", ()=> generateTeacherInvite(uid));
    });
  }catch(e){ err("تعذّر تحميل المعلّمين"); console.error(e); }
}

async function generateStaffCode(uid){
  clearMsg();
  try{
    // توليد فريد على staffCodes/{code}
    let code="", tries=0;
    while(true){
      code = `TCH-${nowYear}-${Math.floor(1000+Math.random()*9000)}`;
      const cRef = doc(db,"staffCodes", code);
      const snap = await getDoc(cRef);
      if(!snap.exists()) { await setDoc(cRef, { uid, createdAt: serverTimestamp() }); break; }
      if(++tries>10) throw new Error("تعذّر توليد كود فريد، حاول مجددًا.");
    }
    await updateDoc(doc(db,"users", uid), { staffCode: code, updatedAt: serverTimestamp() });
    ok(`تم توليد StaffCode: ${code}`);
    await reloadTeachers();
  }catch(e){ err(e.message||"فشل توليد StaffCode"); console.error(e); }
}

async function generateTeacherInvite(uid){
  clearMsg();
  try{
    const u = await getDoc(doc(db,"users", uid));
    if(!u.exists()) return err("مستخدم غير موجود.");
    const email = u.data().email || "teacher";
    const code = `TCH-${rid()}-${rid()}`;
    await setDoc(doc(db,"invites", code), {
      role: "teacher", active:true, usageLimit:1, createdAt: serverTimestamp(),
      createdBy: currentUser.uid, note: `Invite for ${email}`
    });
    ok(`تم إنشاء دعوة: ${code}`);
  }catch(e){ err("فشل إنشاء الدعوة"); console.error(e); }
}

/* ------------ Teacher ↔ Class ↔ Subject (FIXED) ------------ */
async function linkTeacherHandler(){
  try{
    const teacherId = $("#linkTeacher")?.value;
    const gradeId   = $("#linkGrade")?.value;
    const classId   = $("#linkClass")?.value;
    const subjectId = $("#linkSubject")?.value;
    if(!teacherId || !gradeId || !classId || !subjectId){
      return err("اختَر المعلّم والصف والفصل والمادّة.");
    }
    const yearId = activeYearId;

    const linkId = `ct-${yearId}-${classId}-${teacherId}-${subjectId}`;
    await setDoc(doc(db,"classTeachers", linkId), {
      yearId, classId, teacherId, subjectId, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }, { merge:true });

    await setDoc(doc(db,"classes", classId, "teachers", teacherId), {
      teacherId, yearId, active: true
    }, { merge:true });

    ok("تم ربط المعلّم بالفصل/المادة.");
  }catch(e){ err("فشل الربط"); console.error(e); }
}

/* ------------ Classes ------------ */
async function reloadClasses(){
  const tbody = $("#classesTable tbody"); if(!tbody) return; tbody.innerHTML="";
  try{
    const snap = await getDocs(query(collection(db,"classes"), where("yearId","==",activeYearId)));
    for(const d of snap.docs){
      const c = d.data();
      const nameAr = c.displayNameAr || "";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.id}</td><td>${escapeHtml(nameAr)}</td><td>${escapeHtml(c.gradeId)}</td>
        <td>${escapeHtml(c.sectionNameAr || c.section || "-")}</td><td>${c.capacity||"-"}</td>
        <td>${c.active? "✓" : "✗"}</td>
        <td>
          <button class="btn muted" data-class="${d.id}" data-act="roster">الطلاب</button>
          <button class="btn danger" data-class="${d.id}" data-act="delete">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("button").forEach(b=>{
      const cid = b.dataset.class, act = b.dataset.act;
      if(act==="roster") b.addEventListener("click", ()=> openRoster(cid));
      if(act==="delete") b.addEventListener("click", ()=> deleteClass(cid));
    });
  }catch(e){ err("تعذّر تحميل الفصول"); console.error(e); }
}

async function createClassHandler(){
  clearMsg();
  const gradeId = $("#cGrade")?.value;
  const trackCodeSel = $("#cTrack")?.value || ""; // "ar|lang" أو ""
  const section = $("#cSection")?.value;
  const sectionAr = $("#cSectionAr")?.value.trim();
  const nameAr = $("#cNameAr")?.value.trim();
  const capacity= Number($("#cCapacity")?.value||40);
  if(!gradeId || !section) return err("اختر الصف والشعبة.");

  // نشتق classId
  const classId = trackCodeSel ? `${gradeId}-${trackCodeSel}-${section}` : `${gradeId}-${section}`;

  // trackId في DB عندك يكون مثل "g10-ar" (document id في tracks) إن أردت ربطه
  const trackId = trackCodeSel ? `${gradeId}-${trackCodeSel}` : null;

  try{
    await setDoc(doc(db,"classes", classId), {
      gradeId, section, trackId, sectionNameAr: sectionAr || null,
      displayNameAr: nameAr || null, capacity, yearId: activeYearId, active:true,
      updatedAt: serverTimestamp(), createdAt: serverTimestamp()
    }, { merge:true });
    ok("تم حفظ/إضافة الفصل.");
    const nameInput = $("#cNameAr"); if(nameInput) nameInput.value = "";
    await reloadClasses(); await fillTTClasses(); await reloadClassAndSubjectSelects();
  }catch(e){ err("فشل حفظ الفصل"); console.error(e); }
}

async function deleteClass(classId){
  clearMsg();
  if(!confirm(`حذف الفصل ${classId}؟ لن يُسمح بالحذف إن وجدت تبعيات.`)) return;
  try{
    const stSnap = await getDocs(collection(db,"classes", classId, "students"));
    const ctSnap = await getDocs(query(collection(db,"classTeachers"), where("classId","==",classId)));
    const ttSnap = await getDocs(query(collection(db,"timetableEntries"), where("classId","==",classId)));
    if(stSnap.size || ctSnap.size || ttSnap.size){
      return err(`لا يمكن الحذف: طلاب=${stSnap.size}, روابط معلّمين=${ctSnap.size}, حصص=${ttSnap.size}. أفرغها أولًا.`);
    }
    await deleteDoc(doc(db,"classes", classId));
    ok("تم حذف الفصل.");
    await reloadClasses(); await fillTTClasses();
  }catch(e){ err("فشل حذف الفصل"); console.error(e); }
}

/* ------------ Roster dialog ------------ */
let currentClassId = "";
async function openRoster(classId){
  currentClassId = classId;
  const rosterClassId = $("#rosterClassId"); if(rosterClassId) rosterClassId.textContent = classId;
  const gSel = $("#filterGender"); if(gSel) gSel.value = "";
  const rSel = $("#filterReligion"); if(rSel) rSel.value = "";
  await reloadRoster();
  $("#rosterDialog").showModal();
}

async function reloadRoster(){
  const tb = $("#rosterTable tbody"); if(!tb) return; tb.innerHTML="";
  try{
    const gFilter = $("#filterGender")?.value || "";
    const rFilter = $("#filterReligion")?.value || "";
    const snap = await getDocs(collection(db,"classes", currentClassId, "students"));
    for(const d of snap.docs){
      const s = d.data();
      if(gFilter && s.gender !== gFilter) continue;
      if(rFilter && s.religion !== rFilter) continue;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(s.fullName||"")}</td>
                      <td>${s.gender==="male"?"ذكر":"أنثى"}</td>
                      <td>${s.religion==="islam"?"مسلم": s.religion==="christian"?"مسيحي":"أخرى"}</td>
                      <td>${escapeHtml(s.code||"-")}</td>
                      <td>${escapeHtml(s.parentPhone||"-")}</td>
                      <td><button class="btn danger" data-id="${d.id}">حذف</button></td>`;
      tb.appendChild(tr);
    }
    tb.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=> removeStudent(b.dataset.id));
    });
  }catch(e){ err("تعذّر تحميل طلاب الفصل"); console.error(e); }
}

async function addOneStudent(){
  clearMsg();
  const fullName = $("#sFullName")?.value.trim();
  const code  = $("#sCode")?.value.trim() || null;
  const phone = $("#sParent")?.value.trim() || null;
  const gender= $("#sGender")?.value;
  const religion = $("#sReligion")?.value;

  if(!fullName) return err("اسم الطالب مطلوب.");
  if(!gender) return err("اختر النوع.");
  if(!religion) return err("اختر الديانة.");

  try{
    const sid = (window.crypto?.randomUUID?.() || `S-${Date.now()}-${rid()}`);
    await setDoc(doc(db,"students", sid), {
      fullName, code, parentPhone: phone, yearId: activeYearId,
      classId: currentClassId, gradeId: currentClassId.split("-")[0], active:true,
      gender, religion, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await setDoc(doc(db,"classes", currentClassId, "students", sid), {
      fullName, studentId: sid, code, parentPhone: phone, gender, religion
    });
    ok("تمت إضافة الطالب.");
    if($("#sFullName")) $("#sFullName").value = "";
    if($("#sCode")) $("#sCode").value = "";
    if($("#sParent")) $("#sParent").value = "";
    if($("#sGender")) $("#sGender").value = "";
    if($("#sReligion")) $("#sReligion").value = "";
    await reloadRoster(); await reloadOverview();
  }catch(e){ err("فشل إضافة الطالب"); console.error(e); }
}

async function removeStudent(sid){
  if(!confirm("حذف هذا الطالب من الفصل؟ سيبقى في قاعدة الطلاب.")) return;
  try{
    await deleteDoc(doc(db,"classes", currentClassId, "students", sid));
    ok("تم الحذف من الفصل.");
    await reloadRoster(); await reloadOverview();
  }catch(e){ err("فشل الحذف"); console.error(e); }
}

/* ------------ Student Form (global) ------------ */
async function fillStudentFormClasses(){
  const sel = $("#sfClass"); if(!sel) return; sel.innerHTML="";
  const cSnap = await getDocs(query(collection(db,"classes"), where("yearId","==",activeYearId)));
  cSnap.forEach(d=>{
    const c = d.data();
    const label = c.displayNameAr ? `${c.displayNameAr} (${d.id})` : d.id;
    sel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${escapeHtml(label)}</option>`);
  });
}
async function saveStudentForm(keepOpen){
  clearMsg();
  const fullName = $("#sfFullName")?.value.trim();
  const code  = $("#sfCode")?.value.trim() || null;
  const phone = $("#sfPhone")?.value.trim() || null;
  const gender= $("#sfGender")?.value;
  const religion = $("#sfReligion")?.value;
  const classId = $("#sfClass")?.value;
  if(!fullName || !gender || !religion || !classId) return err("أكمل الحقول المطلوبة.");
  const gradeId = classId.split("-")[0];

  try{
    const sid = (window.crypto?.randomUUID?.() || `S-${Date.now()}-${rid()}`);
    await setDoc(doc(db,"students", sid), {
      fullName, code, parentPhone: phone, yearId: activeYearId, gradeId, classId, active:true,
      gender, religion, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await setDoc(doc(db,"classes", classId, "students", sid), {
      studentId: sid, fullName, code, parentPhone: phone, gender, religion
    });
    ok("تم حفظ الطالب.");
    await reloadStudents();
    if(keepOpen){
      if($("#sfFullName")) $("#sfFullName").value="";
      if($("#sfCode")) $("#sfCode").value="";
      if($("#sfPhone")) $("#sfPhone").value="";
      if($("#sfGender")) $("#sfGender").value="";
      if($("#sfReligion")) $("#sfReligion").value="";
    }else{
      $("#studentFormDialog")?.close();
    }
  }catch(e){ err("فشل حفظ الطالب"); console.error(e); }
}

/* ------------ CSV Utils ------------ */
function downloadTemplate(){
  const header = "fullName,gender,religion,code,parentPhone,yearId,gradeId,classId,active\n";
  const example = `أحمد علي,male,islam,STU-0001,01000000000,${activeYearId},g4,g4-A,true\n`;
  const blob = new Blob([header + example], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "students_template.csv";
  a.click();
}
function parseCsv(text){
  const lines = text.replace(/\r/g,"").split("\n").filter(x=>x.trim().length);
  const out = []; let headers = [];
  lines.forEach((line, idx)=>{
    const cells = []; let cur="", inQ=false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"' ){
        if(inQ && line[i+1] === '"'){ cur+='"'; i++; } else { inQ = !inQ; }
      } else if(ch === "," && !inQ){ cells.push(cur); cur=""; }
      else cur += ch;
    }
    cells.push(cur);
    if(idx===0){ headers = cells.map(h=>h.trim()); }
    else{
      const obj = {}; headers.forEach((h,i)=> obj[h]= (cells[i]??"").trim()); out.push(obj);
    }
  });
  return out;
}
function mapGender(v){
  const s = (v||"").toString().trim().toLowerCase();
  if(["male","m","ذكر","بنين","ولد"].includes(s)) return "male";
  if(["female","f","أنثى","بنات","بنت"].includes(s)) return "female";
  return "";
}
function mapReligion(v){
  const s = (v||"").toString().trim().toLowerCase();
  if(["islam","مسلم","إسلام","اسلام"].includes(s)) return "islam";
  if(["christian","مسيحي","مسيحية","قبطي","قبطية"].includes(s)) return "christian";
  if(!s) return "";
  return "other";
}
async function importCsvHandler(){
  clearMsg();
  const f = $("#csvFile")?.files?.[0];
  if(!f) return err("اختر ملف CSV أولًا.");
  if(!currentClassId) return err("افتح نافذة فصل أولًا.");

  const text = await f.text();
  const rows = parseCsv(text);
  if(!rows.length) return err("الملف فارغ.");

  let okCount=0, bad=0;
  for(const r of rows){
    const fullName = (r.fullName||"").trim();
    if(!fullName){ bad++; continue; }
    const classId  = (r.classId||currentClassId).trim() || currentClassId;
    const gradeId  = (r.gradeId || classId.split("-")[0] || "").trim();
    const yearId   = (r.yearId || activeYearId).trim();
    const code     = (r.code||"").trim() || null;
    const phone    = (r.parentPhone||"").trim() || null;
    const active   = String(r.active||"true").toLowerCase() !== "false";
    const gender   = mapGender(r.gender);
    const religion = mapReligion(r.religion);
    if(!gender || !religion){ bad++; continue; }

    try{
      const sid = (window.crypto?.randomUUID?.() || `S-${Date.now()}-${rid()}`);
      await setDoc(doc(db,"students", sid), {
        fullName, code, parentPhone: phone, yearId, gradeId, classId, active, gender, religion,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      await setDoc(doc(db,"classes", classId, "students", sid), {
        studentId: sid, fullName, code, parentPhone: phone, gender, religion
      });
      okCount++;
    }catch(e){ console.error(e); bad++; }
  }
  if(okCount){ await reloadRoster(); await reloadOverview(); }
  if(bad===0) ok(`تم استيراد ${okCount} طالبًا بنجاح.`);
  else err(`تم استيراد ${okCount} وفشل ${bad}. تأكد من الأعمدة والقيم (gender/religion).`);
}

/* ------------ Students list (global) ------------ */
async function reloadStudents(){
  const term = ($("#stSearch")?.value || "").trim().toLowerCase();
  const tb = $("#studentsTable tbody"); if(!tb) return; tb.innerHTML="";
  const snap = await getDocs(collection(db,"students"));
  snap.forEach(d=>{
    const s = d.data();
    const needle = (s.fullName||"").toLowerCase() + " " + (s.code||"").toLowerCase();
    if(term && !needle.includes(term)) return;
    tb.insertAdjacentHTML("beforeend",
      `<tr><td>${escapeHtml(s.fullName||"")}</td>
           <td>${s.gender==="female"?"أنثى":"ذكر"}</td>
           <td>${s.religion==="islam"?"مسلم": s.religion==="christian"?"مسيحي":"أخرى"}</td>
           <td>${escapeHtml(s.code||"-")}</td>
           <td>${escapeHtml(s.classId||"-")}</td>
           <td>${escapeHtml(s.yearId||"-")}</td></tr>`);
  });
}

/* ------------ Subjects (add/delete) ------------ */
async function createSubjectHandler(){
  clearMsg();
  const idStr = $("#subjId")?.value.trim();
  const nameAr= $("#subjNameAr")?.value.trim();
  const code  = $("#subjCode")?.value.trim();
  const grade = $("#subjGradeSel")?.value;
  if(!idStr || !nameAr || !code || !grade) return err("أكمل الحقول.");
  if(!idStr.endsWith(`-${grade}`) && !/-g\d+-(ar|lang)$/.test(idStr)) {
    return err("تأكّد من تطابق subjectId مع الصف/المسار (مثال: arabic-g10 أو arabic-g10-ar).");
  }

  try{
    await setDoc(doc(db,"subjects", idStr), {
      nameAr, code, gradeId: grade, compulsory: true, active: true,
      updatedAt: serverTimestamp(), createdAt: serverTimestamp()
    }, { merge:true });
    ok("تم حفظ/إضافة المادة.");
    if($("#subjId")) $("#subjId").value = "";
    if($("#subjNameAr")) $("#subjNameAr").value = "";
    if($("#subjCode")) $("#subjCode").value = "";
    await reloadSubjects();
  }catch(e){ err("فشل حفظ المادة"); console.error(e); }
}

async function deleteSubject(subjectId){
  clearMsg();
  if(!confirm(`حذف المادة ${subjectId}؟`)) return;
  try{
    const links = await getDocs(query(collection(db,"classTeachers"), where("subjectId","==",subjectId)));
    const ttes = await getDocs(query(collection(db,"timetableEntries"), where("subjectId","==",subjectId)));
    if(links.size || ttes.size){
      return err(`لا يمكن الحذف: روابط معلّمين=${links.size}, حصص=${ttes.size}. أزل التبعيات أولًا.`);
    }
    await deleteDoc(doc(db,"subjects", subjectId));
    ok("تم حذف المادة."); await reloadSubjects();
  }catch(e){ err("فشل حذف المادة"); console.error(e); }
}

async function reloadSubjects(){
  const g = $("#subjGrade")?.value || null;
  const tb = $("#subjectsTable tbody"); if(!tb) return; tb.innerHTML="";
  let qs = collection(db,"subjects");
  if(g){ qs = query(qs, where("gradeId","==",g)); }
  const snap = await getDocs(qs);
  snap.forEach(d=>{
    const s = d.data();
    tb.insertAdjacentHTML("beforeend",
      `<tr>
        <td>${d.id}</td>
        <td>${escapeHtml(s.nameAr || s.name || "")}</td>
        <td>${escapeHtml(s.gradeId||"")}</td>
        <td><button class="btn danger" data-id="${d.id}">حذف</button></td>
      </tr>`);
  });
  tb.querySelectorAll("button").forEach(b=> b.addEventListener("click", ()=> deleteSubject(b.dataset.id)));
}

/* ------------ Invites (owner only page) ------------ */
async function createInviteHandler(){
  clearMsg();
  if(currentRole!=="owner") return err("هذه العملية للمدير فقط.");
  const role = $("#invRole")?.value;
  let code   = $("#invCode")?.value.trim();
  const expInput = $("#invExpires")?.value || null;
  const exp  = expInput ? new Date(expInput) : null;

  try{
    if(!code) code = `${role.toUpperCase()}-${rid()}-${rid()}`;
    await setDoc(doc(db,"invites", code), {
      role, active:true, usageLimit:1, createdAt: serverTimestamp(),
      expiresAt: exp ? {seconds: Math.floor(exp.getTime()/1000)} : null,
      createdBy: currentUser.uid
    });
    ok("تم إنشاء الدعوة."); await loadInvites();
  }catch(e){ err("فشل إنشاء الدعوة"); console.error(e); }
}
async function loadInvites(){
  const tb = $("#invTable tbody"); if(!tb) return; tb.innerHTML="";
  try{
    const snap = await getDocs(collection(db,"invites"));
    snap.forEach(d=>{
      const x = d.data();
      const exp = x.expiresAt && x.expiresAt.toDate ? x.expiresAt.toDate().toLocaleString() : "-";
      tb.insertAdjacentHTML("beforeend",
        `<tr><td>${d.id}</td><td>${x.role}</td><td>${exp}</td><td>${x.active? "✓":"✗"}</td>
             <td>${currentRole==="owner" ? `<button class="btn muted" data-c="${d.id}">${x.active? "تعطيل":"تفعيل"}</button>` : "-"}</td></tr>`);
    });
    if(currentRole==="owner"){
      tb.querySelectorAll("button").forEach(b=>{
        b.addEventListener("click", async ()=>{
          const code = b.dataset.c;
          const ref = doc(db,"invites", code);
          const snap = await getDoc(ref);
          if(!snap.exists()) return;
          await updateDoc(ref, { active: !snap.data().active });
          await loadInvites();
        });
      });
    }
  }catch(e){
    console.warn("cannot list invites (rules)", e);
    tb.innerHTML = `<tr><td colspan="5">لا توجد صلاحية لعرض قائمة الدعوات. يمكنك تمكين list للـ Owner في القواعد.</td></tr>`;
  }
}

/* ------------ Settings save ------------ */
async function saveSettingsHandler(){
  clearMsg();
  if(currentRole!=="owner") return err("الإعدادات للمدير فقط.");
  try{
    await setDoc(doc(db,"settings","global"), {
      instituteName: $("#setName")?.value.trim() || "المعهد",
      activeYearId: $("#setYear")?.value
    }, { merge:true });
    ok("تم الحفظ."); await loadSettings();
  }catch(e){ err("فشل حفظ الإعدادات"); console.error(e); }
}

/* ===================================================================== */
/* ============================ TIMETABLE =============================== */
/* ===================================================================== */

let PERIOD_TEMPLATE = null;
async function initTimetableUI(){
  const btnTTLoad = $("#btnTTLoad");
  if(btnTTLoad) btnTTLoad.addEventListener("click", buildTTGrid);
  const btnTTExport = $("#btnTTExport");
  if(btnTTExport) btnTTExport.addEventListener("click", exportTT);
  const btnTTImport = $("#btnTTImport");
  if(btnTTImport) btnTTImport.addEventListener("click", importTT);
  const btnPdSave = $("#btnPdSave");
  if(btnPdSave) btnPdSave.addEventListener("click", savePeriod);
  const btnPdClear = $("#btnPdClear");
  if(btnPdClear) btnPdClear.addEventListener("click", clearPeriod);
  const pdType = $("#pdType");
  if(pdType) pdType.addEventListener("change", onPdTypeChange);

  await fillTTClasses(); await fillTemplates();
}
async function fillTTClasses(){
  const sel = $("#ttClass"); if(!sel) return;
  sel.innerHTML = "";
  const cSnap = await getDocs(query(collection(db,"classes"), where("yearId","==",activeYearId)));
  cSnap.forEach(d=>{
    const c = d.data();
    const label = c.displayNameAr ? `${c.displayNameAr} (${d.id})` : d.id;
    sel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${escapeHtml(label)}</option>`);
  });
}
async function fillTemplates(){
  const sel = $("#ttTemplate"); if(!sel) return;
  sel.innerHTML="";
  const snap = await getDocs(collection(db,"periodTemplates"));
  if(snap.size===0){
    sel.insertAdjacentHTML("beforeend", `<option value="__default__">افتراضي (7 حصص)</option>`);
  }else{
    snap.forEach(d=> sel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${escapeHtml(d.data().name||d.id)}</option>`));
  }
}
function onPdTypeChange(){
  const v = $("#pdType")?.value;
  const n = $("#pdNormal"), r = $("#pdReligion");
  if(n) n.style.display = v==="normal"?"":"none";
  if(r) r.style.display = v==="religion"?"":"none";
}
async function loadTemplateObject(){
  PERIOD_TEMPLATE = null;
  const tId = $("#ttTemplate")?.value;
  if(tId === "__default__" || !tId){
    PERIOD_TEMPLATE = { periods:[
      {i:1,start:"08:00",end:"08:45"},
      {i:2,start:"08:55",end:"09:40"},
      {i:3,start:"09:50",end:"10:35"},
      {i:4,start:"10:45",end:"11:30"},
      {i:5,start:"11:40",end:"12:25"},
      {i:6,start:"12:35",end:"13:20"},
      {i:7,start:"13:30",end:"14:15"},
    ]};
  }else{
    const tSnap = await getDoc(doc(db,"periodTemplates", tId));
    PERIOD_TEMPLATE = tSnap.exists() ? tSnap.data() : {periods:[]};
  }
}
function timeToMin(hhmm){ const [h,m] = (hhmm||"").split(":").map(Number); return (h*60 + m)|0; }

async function buildTTGrid(){
  clearMsg();
  await loadTemplateObject();
  if(!PERIOD_TEMPLATE || !PERIOD_TEMPLATE.periods?.length) return err("لا يوجد قالب فترات.");

  const classId = $("#ttClass")?.value;
  if(!classId) return err("اختر فصلًا.");
  const gradeId = classId.split("-")[0];

  // subjects for this grade (track-aware)
  // نحتاج class.trackId لمطابقة subject.trackId أو قبول المواد العامة
  const classDoc = await getDoc(doc(db,"classes", classId));
  const classTrackId = classDoc.exists() ? (classDoc.data().trackId || null) : null;

  const subj = [];
  (await getDocs(query(collection(db,"subjects"), where("gradeId","==",gradeId)))).forEach(d=>{
    const s = d.data(); const okByTrack = !s.trackId || !classTrackId || s.trackId === classTrackId;
    if(okByTrack) subj.push({id:d.id, ...s});
  });

  // class teachers
  const links = [];
  (await getDocs(query(collection(db,"classTeachers"), where("yearId","==",activeYearId), where("classId","==",classId)))).forEach(d=> links.push(d.data()));
  const teacherIds = new Set(links.map(l=> l.teacherId));
  const teachers = [];
  for(const tid of teacherIds){
    const u = await getDoc(doc(db,"users",tid));
    if(u.exists()) teachers.push({id:tid, ...u.data()});
  }

  // render grid
  const grid = $("#ttGrid"); if(!grid) return; grid.innerHTML="";
  const table = document.createElement("table"); table.className = "tt-table";
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  trh.innerHTML = `<th>الحصة \\ اليوم</th>${DAYS.map(d=> `<th>${DAY_AR[d]}</th>`).join("")}`;
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = document.createElement("tbody");

  for(const p of PERIOD_TEMPLATE.periods){
    const tr = document.createElement("tr");
    tr.innerHTML = `<th>حصة ${p.i}<br><span class="subtle small">${p.start}–${p.end}</span></th>`;
    for(const d of DAYS){
      const td = document.createElement("td");
      td.className = "tt-cell"; td.dataset.day = d; td.dataset.period = p.i;
      const actions = document.createElement("div");
      actions.className = "tt-actions";
      const btn = document.createElement("button"); btn.className="btn muted"; btn.textContent="إدارة";
      btn.addEventListener("click", ()=> openPeriodDialog(classId, gradeId, d, p.i, subj, teachers));
      actions.appendChild(btn);
      td.appendChild(actions);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody); grid.appendChild(table);

  // populate existing entries
  const itemsByKey = {};
  const snap = await getDocs(query(collection(db,"timetableEntries"),
                where("yearId","==",activeYearId), where("classId","==",classId)));
  snap.forEach(d=>{
    const x = d.data();
    const key = `${x.day}-${x.periodIndex}`;
    if(!itemsByKey[key]) itemsByKey[key]=[];
    itemsByKey[key].push({...x, id:d.id});
  });

  $$(".tt-cell").forEach(cell=>{
    const key = `${cell.dataset.day}-${cell.dataset.period}`;
    const items = itemsByKey[key]||[];
    for(const it of items){
      const div = document.createElement("div");
      div.className = "tt-item";
      let subjName = it.subjectId; let tchName = it.teacherId;
      const s = subj.find(z=> z.id===it.subjectId); if(s) subjName = s.nameAr || s.name || s.id;
      const t = teachers.find(z=> z.id===it.teacherId); if(t) tchName = t.displayName || t.email || it.teacherId;
      const split = it.groupKey==="religion" ? (it.groupValue==="islam"?"(دين إسلامي)":"(دين مسيحي)") : "";
      div.innerHTML = `<div><b>${escapeHtml(subjName)}</b> ${split}</div>
                       <div class="meta">${escapeHtml(tchName)} ${it.roomId? "— قاعة "+escapeHtml(it.roomId):""}</div>`;
      cell.appendChild(div);
    }
  });
}

/* ---------- Period Dialog ---------- */
let PD_CTX = null;
async function openPeriodDialog(classId, gradeId, day, periodIndex, subjList, teachersList){
  PD_CTX = {classId, gradeId, day, periodIndex, subjList, teachersList};

  const pdDay = $("#pdDay"), pdPeriod=$("#pdPeriod"), pdType=$("#pdType");
  if(pdDay) pdDay.value = `${DAY_AR[day]} (${day})`;
  if(pdPeriod) pdPeriod.value = `حصة ${periodIndex}`;
  if(pdType) pdType.value = "normal"; onPdTypeChange();

  const fillSel = (sel, items)=>{ if(!sel) return; sel.innerHTML=""; items.forEach(x=> sel.insertAdjacentHTML("beforeend", `<option value="${x.id}">${escapeHtml(x.nameAr||x.name||x.id)}</option>`)); };
  fillSel($("#pdSubject"), subjList);
  fillSel($("#pdSubjIslam"), subjList.filter(x=> (x.code||"").includes("religion") || (x.id||"").includes("religion")));
  fillSel($("#pdSubjChris"), subjList.filter(x=> (x.code||"").includes("religion") || (x.id||"").includes("religion")));
  const fillTeach = (sel)=>{ if(!sel) return; sel.innerHTML=""; teachersList.forEach(t=> sel.insertAdjacentHTML("beforeend", `<option value="${t.id}">${escapeHtml(t.displayName||t.email||t.id)}</option>`)); };
  fillTeach($("#pdTeacher")); fillTeach($("#pdTeachIslam")); fillTeach($("#pdTeachChris"));

  // populate existing
  const existed = await getDocs(query(collection(db,"timetableEntries"),
    where("yearId","==",activeYearId), where("classId","==",classId), where("day","==",day), where("periodIndex","==",periodIndex)));
  const items = []; existed.forEach(d=> items.push({...d.data(), id:d.id}));

  if(items.length===0){
    if($("#pdRoom")) $("#pdRoom").value = "";
    if($("#pdRoomIslam")) $("#pdRoomIslam").value = "";
    if($("#pdRoomChris")) $("#pdRoomChris").value = "";
  }else if(items.length===1 && items[0].groupKey!=="religion"){
    $("#pdType").value="normal"; onPdTypeChange();
    $("#pdSubject").value = items[0].subjectId;
    $("#pdTeacher").value = items[0].teacherId;
    $("#pdRoom").value    = items[0].roomId || "";
  }else{
    $("#pdType").value="religion"; onPdTypeChange();
    const isl = items.find(x=> x.groupValue==="islam") || {};
    const chr = items.find(x=> x.groupValue==="christian") || {};
    if(isl.subjectId) $("#pdSubjIslam").value = isl.subjectId;
    if(isl.teacherId) $("#pdTeachIslam").value = isl.teacherId;
    $("#pdRoomIslam").value = isl.roomId || "";
    if(chr.subjectId) $("#pdSubjChris").value = chr.subjectId;
    if(chr.teacherId) $("#pdTeachChris").value = chr.teacherId;
    $("#pdRoomChris").value = chr.roomId || "";
  }

  $("#periodDialog").showModal();
}

function getPeriodTime(periodIndex){
  const p = PERIOD_TEMPLATE.periods.find(z=> z.i==periodIndex);
  const startMin = timeToMin(p.start), endMin = timeToMin(p.end);
  return {startMin, endMin};
}

async function checkConflicts({classId, day, startMin, endMin, teacherId, roomId}){
  const c1 = []; (await getDocs(query(collection(db,"timetableEntries"),
      where("yearId","==",activeYearId), where("classId","==",classId), where("day","==",day)))).forEach(d=> c1.push(d.data()));
  const c2 = []; if(teacherId){
    (await getDocs(query(collection(db,"timetableEntries"),
      where("yearId","==",activeYearId), where("teacherId","==",teacherId), where("day","==",day)))).forEach(d=> c2.push(d.data()));
  }
  const c3 = []; if(roomId){
    (await getDocs(query(collection(db,"timetableEntries"),
      where("yearId","==",activeYearId), where("roomId","==",roomId), where("day","==",day)))).forEach(d=> c3.push(d.data()));
  }
  const list = [...c1,...c2,...c3];
  for(const e of list){
    if(!(endMin <= e.startMin || startMin >= e.endMin)){
      return `تضارب مع: الفصل أو المعلم/القاعة في ${DAY_AR[day]} حصة ${e.periodIndex}`;
    }
  }
  return null;
}

async function savePeriod(){
  clearMsg();
  const type = $("#pdType")?.value;
  const {classId, day, periodIndex} = PD_CTX;
  const {startMin, endMin} = getPeriodTime(periodIndex);

  try{
    if(type==="normal"){
      const subjectId = $("#pdSubject")?.value;
      const teacherId = $("#pdTeacher")?.value;
      const roomId    = $("#pdRoom")?.value.trim() || null;
      if(!subjectId || !teacherId) return err("اختر المادة والمعلّم.");

      const conflict = await checkConflicts({classId, day, startMin, endMin, teacherId, roomId});
      if(conflict) return err(conflict);

      const id = `tt-${activeYearId}-${classId}-${day}-${periodIndex}`;
      await setDoc(doc(db,"timetableEntries", id), {
        yearId: activeYearId, classId, day, dayIndex: DAYS.indexOf(day), periodIndex,
        startMin, endMin, subjectId, teacherId, roomId, active: true,
        groupKey: null, groupValue: null, updatedAt: serverTimestamp(), createdAt: serverTimestamp()
      }, { merge:true });
      ok("تم حفظ الحصة.");
    }else{
      const isl = { subjectId: $("#pdSubjIslam")?.value, teacherId: $("#pdTeachIslam")?.value, roomId: $("#pdRoomIslam")?.value.trim()||null };
      const chr = { subjectId: $("#pdSubjChris")?.value, teacherId: $("#pdTeachChris")?.value, roomId: $("#pdRoomChris")?.value.trim()||null };
      if(!isl.subjectId || !isl.teacherId || !chr.subjectId || !chr.teacherId) return err("أكمل اختيارات شعبتي الدين.");
      for(const row of [isl, chr]){
        const conflict = await checkConflicts({classId, day, startMin, endMin, teacherId: row.teacherId, roomId: row.roomId});
        if(conflict) return err(conflict);
      }
      const base = `tt-${activeYearId}-${classId}-${day}-${periodIndex}`;
      await setDoc(doc(db,"timetableEntries", `${base}-ISL`), {
        yearId: activeYearId, classId, day, dayIndex: DAYS.indexOf(day), periodIndex,
        startMin, endMin, subjectId: isl.subjectId, teacherId: isl.teacherId, roomId: isl.roomId,
        groupKey:"religion", groupValue:"islam", active:true, updatedAt: serverTimestamp(), createdAt: serverTimestamp()
      }, { merge:true });
      await setDoc(doc(db,"timetableEntries", `${base}-CHR`), {
        yearId: activeYearId, classId, day, dayIndex: DAYS.indexOf(day), periodIndex,
        startMin, endMin, subjectId: chr.subjectId, teacherId: chr.teacherId, roomId: chr.roomId,
        groupKey:"religion", groupValue:"christian", active:true, updatedAt: serverTimestamp(), createdAt: serverTimestamp()
      }, { merge:true });
      ok("تم حفظ حصتي التربية الدينية.");
    }
    $("#periodDialog")?.close(); await buildTTGrid();
  }catch(e){ err("فشل حفظ الحصة"); console.error(e); }
}
async function clearPeriod(){
  const {classId, day, periodIndex} = PD_CTX;
  if(!confirm("تفريغ هذه الحصة (يشمل حصص الدين إن وُجدت)؟")) return;
  try{
    const ids = [
      `tt-${activeYearId}-${classId}-${day}-${periodIndex}`,
      `tt-${activeYearId}-${classId}-${day}-${periodIndex}-ISL`,
      `tt-${activeYearId}-${classId}-${day}-${periodIndex}-CHR`,
    ];
    for(const x of ids){
      const ref = doc(db,"timetableEntries", x);
      const s = await getDoc(ref);
      if(s.exists()) await deleteDoc(ref);
    }
    ok("تم التفريغ."); $("#periodDialog")?.close(); await buildTTGrid();
  }catch(e){ err("فشل التفريغ"); console.error(e); }
}
async function exportTT(){
  clearMsg();
  const classId = $("#ttClass")?.value;
  if(!classId) return err("اختر فصلًا.");
  const rows = ["yearId,classId,day,periodIndex,start,end,subjectId,teacherId,roomId,groupKey,groupValue"];
  const snap = await getDocs(query(collection(db,"timetableEntries"),
      where("yearId","==",activeYearId), where("classId","==",classId)));
  await loadTemplateObject();
  snap.forEach(d=>{
    const x = d.data();
    const start = PERIOD_TEMPLATE.periods.find(p=> p.i==x.periodIndex)?.start || "00:00";
    const end   = PERIOD_TEMPLATE.periods.find(p=> p.i==x.periodIndex)?.end   || "00:00";
    rows.push([x.yearId,x.classId,x.day,x.periodIndex,start,end,x.subjectId,x.teacherId,(x.roomId||""),(x.groupKey||""),(x.groupValue||"")].join(","));
  });
  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `timetable_${classId}.csv`; a.click();
}
async function importTT(){
  clearMsg();
  const f = $("#ttCsv")?.files?.[0];
  if(!f) return err("اختر ملف CSV للجدول.");
  await loadTemplateObject();
  const text = await f.text();
  const rows = parseCsv(text);
  if(!rows.length) return err("الملف فارغ.");

  let okCount=0, bad=0;
  for(const r of rows){
    const yearId = (r.yearId||activeYearId).trim();
    const classId= r.classId?.trim(); if(!classId) { bad++; continue; }
    const day    = r.day?.trim(); const periodIndex = Number(r.periodIndex||0);
    if(!DAYS.includes(day) || !periodIndex){ bad++; continue; }
    const startMin = timeToMin(r.start|| (PERIOD_TEMPLATE.periods.find(p=> p.i==periodIndex)?.start) );
    const endMin   = timeToMin(r.end  || (PERIOD_TEMPLATE.periods.find(p=> p.i==periodIndex)?.end) );
    const subjectId= (r.subjectId||"").trim(); const teacherId=(r.teacherId||"").trim();
    const roomId   = (r.roomId||"").trim() || null;
    const groupKey = (r.groupKey||"").trim() || null;
    const groupValue = (r.groupValue||"").trim() || null;
    if(!subjectId || !teacherId){ bad++; continue; }

    try{
      const conflict = await checkConflicts({classId, day, startMin, endMin, teacherId, roomId});
      if(conflict){ bad++; continue; }

      let idStr = `tt-${yearId}-${classId}-${day}-${periodIndex}`;
      if(groupKey==="religion"){
        if(groupValue==="islam") idStr += "-ISL";
        else if(groupValue==="christian") idStr += "-CHR";
      }
      await setDoc(doc(db,"timetableEntries", idStr), {
        yearId, classId, day, dayIndex: DAYS.indexOf(day), periodIndex, startMin, endMin,
        subjectId, teacherId, roomId, active:true, groupKey, groupValue, updatedAt: serverTimestamp(), createdAt: serverTimestamp()
      }, { merge:true });
      okCount++;
    }catch(e){ console.error(e); bad++; }
  }
  if(okCount) await buildTTGrid();
  if(bad===0) ok(`تم استيراد ${okCount} عنصر جدول بنجاح.`);
  else err(`تم استيراد ${okCount} وفشل ${bad}. راجع القيم/التضارب.`);
}

/* ------------ Utility ------------ */
window.addEventListener("load", ()=> loadInvites());
