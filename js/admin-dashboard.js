import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
  collection, getDocs, query, where, orderBy, serverTimestamp,
  deleteDoc
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
function ok(t){ msg.innerHTML = `<div class="success">${escapeHtml(t)}</div>`; }
function err(t){ msg.innerHTML = `<div class="error">${escapeHtml(t)}</div>`; }
function clearMsg(){ msg.innerHTML = ""; }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function id(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

let currentUser=null, currentRole="admin", activeYearId="";

/* ------------ Tabs ------------- */
$$(".nav").forEach(b=>{
  b.addEventListener("click", ()=>{
    $$(".nav").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const tab = b.dataset.tab;
    $$(".tab").forEach(x=>x.classList.remove("active"));
    $(`#tab-${tab}`).classList.add("active");
    clearMsg();
  });
});

/* ------------ Auth gate ------------- */
onAuthStateChanged(auth, async (u)=>{
  if(!u){ window.location.href="index.html"; return; }
  currentUser = u;

  // fetch user doc
  const uref = doc(db,"users",u.uid);
  const us   = await getDoc(uref);
  if(!us.exists()){ err("لا توجد وثيقة مستخدم، برجاء إعادة التفعيل."); return; }
  currentRole = us.data().role || "admin";
  $("#roleChip").textContent = currentRole.toUpperCase();

  // Owner-only visibility
  if(currentRole === "owner"){
    $$(".owner-only").forEach(el=> el.style.display = "");
  }

  // Settings & year select
  await loadSettings();

  // Load initial data
  await Promise.all([
    reloadOverview(),
    loadGradesSelects(),
    reloadTeachers(),
    reloadClasses(),
    reloadSubjects()
  ]);

  // Events
  $("#btnSignOut").addEventListener("click", async ()=>{
    await signOut(auth);
    window.location.href = "index.html";
  });

  // Teachers link action
  $("#btnLink").addEventListener("click", linkTeacherHandler);
  $("#btnReloadTeachers").addEventListener("click", reloadTeachers);

  // Classes actions
  $("#btnCreateClass").addEventListener("click", createClassHandler);

  // Roster import
  $("#btnDownloadTemplate").addEventListener("click", downloadTemplate);
  $("#btnImportCsv").addEventListener("click", importCsvHandler);
  $("#btnAddStudent").addEventListener("click", addOneStudent);

  // Students search
  $("#btnReloadStudents").addEventListener("click", reloadStudents);

  // Subjects
  $("#btnReloadSubjects").addEventListener("click", reloadSubjects);

  // Invites (owner)
  const btnCreateInvite = $("#btnCreateInvite");
  if(btnCreateInvite) btnCreateInvite.addEventListener("click", createInviteHandler);

  // Settings (owner)
  const btnSaveSettings = $("#btnSaveSettings");
  if(btnSaveSettings) btnSaveSettings.addEventListener("click", saveSettingsHandler);
  const btnRunSeed = $("#btnRunSeed");
  if(btnRunSeed) btnRunSeed.addEventListener("click", ()=> runSeed({db, activeYearId}).then(()=>ok("تمت التهيئة بنجاح")).catch(e=>err(e.message||e)));

  $("#yearSelect").addEventListener("change", async (e)=>{
    activeYearId = e.target.value;
    await Promise.all([reloadOverview(), reloadClasses(), reloadSubjects()]);
  });
});

/* ------------ Settings/Year ------------ */
async function loadSettings(){
  try{
    const gsnap = await getDoc(doc(db,"settings","global"));
    const name = gsnap.exists() ? (gsnap.data().instituteName || "المعهد") : "المعهد";
    $("#instName").textContent = name;

    const years = new Set();
    // احضر السنوات من collection academicYears إن وجدت
    const ySnap = await getDocs(collection(db,"academicYears"));
    ySnap.forEach(d=> years.add(d.id));
    // activeYearId
    activeYearId = gsnap.exists() ? (gsnap.data().activeYearId || [...years][0]) : ([...years][0] || "2025-2026");

    // populate selects
    const yearSel = $("#yearSelect"); yearSel.innerHTML="";
    [...years].sort().forEach(y=>{
      const opt = document.createElement("option");
      opt.value=opt.textContent=y;
      if(y===activeYearId) opt.selected=true;
      yearSel.appendChild(opt);
    });

    // settings tab
    const setYear = $("#setYear"); if(setYear){
      setYear.innerHTML="";
      [...years].sort().forEach(y=>{
        const o=document.createElement("option"); o.value=o.textContent=y; setYear.appendChild(o);
      });
      $("#setName").value = name;
      setYear.value = activeYearId;
    }
  }catch(e){ err("تعذّر تحميل الإعدادات"); console.error(e); }
}

/* ------------ Overview ------------ */
async function reloadOverview(){
  try{
    // Teachers count
    const tSnap = await getDocs(query(collection(db,"users"), where("role","==","teacher")));
    $("#kTeachers").textContent = tSnap.size;

    // Classes count (current year)
    const cSnap = await getDocs(query(collection(db,"classes"), where("yearId","==",activeYearId)));
    $("#kClasses").textContent = cSnap.size;

    // Students count quick (قد يكون كبيرًا)
    const sSnap = await getDocs(collection(db,"students"));
    $("#kStudents").textContent = sSnap.size;

    const subjSnap = await getDocs(collection(db,"subjects"));
    $("#kSubjects").textContent = subjSnap.size;

    if(currentRole==="owner"){
      // invites active
      let active=0;
      const invSnap = await getDocs(collection(db,"invites"));
      const now = Date.now();
      invSnap.forEach(d=>{
        const x = d.data(); 
        const exp = x.expiresAt && x.expiresAt.toMillis ? x.expiresAt.toMillis() : null;
        if(x.active && (!exp || exp > now)) active++;
      });
      $("#kInvites").textContent = active;
    }
    $("#recentLog").textContent = "جاهز ✨";
  }catch(e){ err("فشل تحميل النظرة العامة"); console.error(e); }
}

/* ------------ Load dropdowns ------------ */
async function loadGradesSelects(){
  // grades
  const grades = [];
  (await getDocs(collection(db,"grades"))).forEach(d=> grades.push({id:d.id, ...d.data()}));

  // sections from settings.global.sections أو افتراضي
  let sections = ["A","B","C","D"];
  const gsnap = await getDoc(doc(db,"settings","global"));
  if(gsnap.exists() && Array.isArray(gsnap.data().sections)) sections = gsnap.data().sections;

  // Fill controls
  function fill(sel, options){ sel.innerHTML=""; options.forEach(o=> sel.insertAdjacentHTML("beforeend", `<option value="${o.value}">${o.label}</option>`)); }

  // Teachers link selects
  fill($("#linkGrade"), grades.map(g=>({value:g.id,label:g.name||g.id})));
  fill($("#cGrade"), grades.map(g=>({value:g.id,label:g.name||g.id})));
  fill($("#subjGrade"), grades.map(g=>({value:g.id,label:g.name||g.id})));

  const sectionsOpts = sections.map(s=>({value:s,label:s}));
  fill($("#cSection"), sectionsOpts);

  // Teachers list for link
  const teachers = [];
  (await getDocs(query(collection(db,"users"), where("role","==","teacher")))).forEach(d=> teachers.push({id:d.id,...d.data()}));
  $("#linkTeacher").innerHTML = teachers.map(t=> `<option value="${t.id}">${escapeHtml(t.displayName||t.email)} (${t.email})</option>`).join("");

  // subjects for selected grade
  $("#linkGrade").addEventListener("change", ()=> reloadClassAndSubjectSelects());
  await reloadClassAndSubjectSelects();
}

async function reloadClassAndSubjectSelects(){
  const g = $("#linkGrade").value;
  // classes by year & grade
  const clsSel = $("#linkClass");
  clsSel.innerHTML = "";
  const cSnap = await getDocs(query(collection(db,"classes"),
               where("yearId","==",activeYearId), where("gradeId","==",g)));
  cSnap.forEach(d=> clsSel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${d.id}</option>`));

  // subjects by grade
  const sSel = $("#linkSubject");
  sSel.innerHTML="";
  const sSnap = await getDocs(query(collection(db,"subjects"), where("gradeId","==",g)));
  sSnap.forEach(d=> sSel.insertAdjacentHTML("beforeend", `<option value="${d.id}">${d.data().name||d.id}</option>`));
}

/* ------------ Teachers listing ------------ */
async function reloadTeachers(){
  try{
    const term = $("#teacherSearch").value?.trim()?.toLowerCase() || "";
    const tbody = $("#teachersTable tbody"); tbody.innerHTML="";

    const snap = await getDocs(query(collection(db,"users"), where("role","==","teacher")));
    for (const d of snap.docs){
      const u = d.data();
      const name = (u.displayName||"").toLowerCase();
      const email= (u.email||"").toLowerCase();
      if(term && !(name.includes(term) || email.includes(term))) continue;

      // count links
      let count=0;
      const links = await getDocs(query(collection(db,"classTeachers"), where("teacherId","==",d.id)));
      count = links.size;

      tbody.insertAdjacentHTML("beforeend",
        `<tr><td>${escapeHtml(u.displayName||"")}</td>
            <td>${escapeHtml(u.email||"")}</td>
            <td>${escapeHtml(u.status||"-")}</td>
            <td>${count}</td></tr>`);
    }
  }catch(e){ err("تعذّر تحميل المعلّمين"); console.error(e); }
}

/* ------------ Link Teacher handler ------------ */
async function linkTeacherHandler(){
  clearMsg();
  const teacherId = $("#linkTeacher").value;
  const gradeId   = $("#linkGrade").value;
  const classId   = $("#linkClass").value;
  const subjectId = $("#linkSubject").value;
  if(!teacherId || !gradeId || !classId || !subjectId) return err("يرجى اختيار كل الحقول.");

  try{
    // 1) classTeachers (علوي)
    const linkId = `${classId}_${teacherId}_${subjectId}_${activeYearId}`;
    await setDoc(doc(db,"classTeachers", linkId), {
      classId, teacherId, subjectId, yearId: activeYearId, active:true, createdAt: serverTimestamp()
    }, { merge:true });

    // 2) classes/{classId}/teachers/{teacherId}
    await setDoc(doc(db,"classes",classId,"teachers",teacherId), {
      teacherId, subjects: [subjectId], yearId: activeYearId, active: true, createdAt: serverTimestamp()
    }, { merge: true });

    ok("تم الربط بنجاح.");
    await reloadTeachers();
  }catch(e){ err("فشل ربط المعلّم بالفصل"); console.error(e); }
}

/* ------------ Classes ------------ */
async function reloadClasses(){
  const tbody = $("#classesTable tbody"); tbody.innerHTML="";
  try{
    const cSnap = await getDocs(query(collection(db,"classes"), where("yearId","==",activeYearId)));
    for(const d of cSnap.docs){
      const c = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.id}</td><td>${escapeHtml(c.gradeId)}</td>
        <td>${escapeHtml(c.section||"-")}</td><td>${c.capacity||"-"}</td>
        <td>${c.active? "✓" : "✗"}</td>
        <td><button class="btn muted" data-class="${d.id}">الطلاب</button></td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=> openRoster(b.dataset.class));
    });
  }catch(e){ err("تعذّر تحميل الفصول"); console.error(e); }
}

async function createClassHandler(){
  clearMsg();
  const gradeId = $("#cGrade").value;
  const section = $("#cSection").value;
  const capacity= Number($("#cCapacity").value||35);
  if(!gradeId || !section) return err("اختر الصف والشعبة.");

  const classId = `${gradeId}-${section}`;
  try{
    await setDoc(doc(db,"classes", classId), {
      gradeId, section, capacity, yearId: activeYearId, active:true
    }, { merge:true });
    ok("تم إنشاء/تحديث الفصل.");
    await reloadClasses();
  }catch(e){ err("فشل إنشاء الفصل"); console.error(e); }
}

/* ------------ Roster dialog ------------ */
let currentClassId = "";
async function openRoster(classId){
  currentClassId = classId;
  $("#rosterClassId").textContent = classId;
  await reloadRoster();
  $("#rosterDialog").showModal();
}

async function reloadRoster(){
  const tb = $("#rosterTable tbody"); tb.innerHTML="";
  try{
    const snap = await getDocs(collection(db,"classes", currentClassId, "students"));
    for(const d of snap.docs){
      const s = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(s.fullName||"")}</td>
                      <td>${escapeHtml(s.code||"-")}</td>
                      <td>${escapeHtml(s.parentPhone||"-")}</td>
                      <td><button class="btn muted" data-id="${d.id}">حذف</button></td>`;
      tb.appendChild(tr);
    }
    tb.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=> removeStudent(b.dataset.id));
    });
  }catch(e){ err("تعذّر تحميل طلاب الفصل"); console.error(e); }
}

async function addOneStudent(){
  clearMsg();
  const fullName = $("#sFullName").value.trim();
  if(!fullName) return err("اسم الطالب مطلوب.");
  const code  = $("#sCode").value.trim() || null;
  const phone = $("#sParent").value.trim() || null;

  try{
    // master
    const sid = crypto.randomUUID ? crypto.randomUUID() : `S-${Date.now()}-${id()}`;
    await setDoc(doc(db,"students", sid), {
      fullName, code, parentPhone: phone, yearId: activeYearId,
      classId: currentClassId, gradeId: currentClassId.split("-")[0], active:true, createdAt: serverTimestamp()
    });
    // roster
    await setDoc(doc(db,"classes", currentClassId, "students", sid), {
      fullName, studentId: sid, code, parentPhone: phone
    });
    ok("تمت إضافة الطالب.");
    $("#sFullName").value = $("#sCode").value = $("#sParent").value = "";
    await reloadRoster();
    await reloadOverview();
  }catch(e){ err("فشل إضافة الطالب"); console.error(e); }
}

async function removeStudent(sid){
  if(!confirm("حذف هذا الطالب من الفصل؟ سيبقى في الماستر.")) return;
  try{
    await deleteDoc(doc(db,"classes", currentClassId, "students", sid));
    ok("تم الحذف من الفصل.");
    await reloadRoster();
    await reloadOverview();
  }catch(e){ err("فشل الحذف"); console.error(e); }
}

/* ------------ CSV Import ------------ */
function downloadTemplate(){
  const header = "fullName,code,parentPhone,yearId,gradeId,classId,active\n";
  const blob = new Blob([header + "أحمد علي,STU-0001,01000000000,2025-2026,g10,"+(currentClassId||"g10-A")+",true\n"], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "students_template.csv";
  a.click();
}

function parseCsv(text){
  // بسيط وعملي: يفصل على الفواصل، يدعم القيم المقتبسة
  const lines = text.replace(/\r/g,"").split("\n").filter(x=>x.trim().length);
  const out = [];
  let headers = [];
  lines.forEach((line, idx)=>{
    const cells = [];
    let cur="", inQ=false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"' ){ // toggle quote
        if(inQ && line[i+1] === '"'){ cur+='"'; i++; } else { inQ = !inQ; }
      } else if(ch === "," && !inQ){ cells.push(cur); cur=""; }
      else cur += ch;
    }
    cells.push(cur);
    if(idx===0){ headers = cells.map(h=>h.trim()); }
    else{
      const obj = {};
      headers.forEach((h,i)=> obj[h]= (cells[i]??"").trim());
      out.push(obj);
    }
  });
  return out;
}

async function importCsvHandler(){
  clearMsg();
  const f = $("#csvFile").files[0];
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

    try{
      const sid = crypto.randomUUID ? crypto.randomUUID() : `S-${Date.now()}-${id()}`;
      await setDoc(doc(db,"students", sid), {
        fullName, code, parentPhone: phone, yearId, gradeId, classId, active, createdAt: serverTimestamp()
      });
      await setDoc(doc(db,"classes", classId, "students", sid), {
        studentId: sid, fullName, code, parentPhone: phone
      });
      okCount++;
    }catch(e){ console.error(e); bad++; }
  }
  if(okCount) await reloadRoster();
  if(okCount) await reloadOverview();
  if(bad===0) ok(`تم استيراد ${okCount} طالبًا بنجاح.`);
  else err(`تم استيراد ${okCount} وفشل ${bad}. راجع الأعمدة والقيم.`);
}

/* ------------ Students list (global) ------------ */
async function reloadStudents(){
  const term = $("#stSearch").value?.trim()?.toLowerCase() || "";
  const tb = $("#studentsTable tbody"); tb.innerHTML="";
  const snap = await getDocs(collection(db,"students"));
  snap.forEach(d=>{
    const s = d.data();
    const needle = (s.fullName||"").toLowerCase() + " " + (s.code||"").toLowerCase();
    if(term && !needle.includes(term)) return;
    tb.insertAdjacentHTML("beforeend",
      `<tr><td>${escapeHtml(s.fullName||"")}</td>
           <td>${escapeHtml(s.code||"-")}</td>
           <td>${escapeHtml(s.classId||"-")}</td>
           <td>${escapeHtml(s.yearId||"-")}</td></tr>`);
  });
}

/* ------------ Subjects ------------ */
async function reloadSubjects(){
  const g = $("#subjGrade").value || null;
  const tb = $("#subjectsTable tbody"); tb.innerHTML="";
  let qs = collection(db,"subjects");
  if(g){ qs = query(qs, where("gradeId","==",g)); }
  const snap = await getDocs(qs);
  snap.forEach(d=>{
    const s = d.data();
    tb.insertAdjacentHTML("beforeend",
      `<tr><td>${d.id}</td><td>${escapeHtml(s.name||"")}</td><td>${escapeHtml(s.gradeId||"")}</td></tr>`);
  });
}

/* ------------ Invites (owner only) ------------ */
async function createInviteHandler(){
  clearMsg();
  if(currentRole!=="owner") return err("هذه العملية للمدير فقط.");
  const role = $("#invRole").value;
  let code   = $("#invCode").value.trim();
  const exp  = $("#invExpires").value ? new Date($("#invExpires").value) : null;

  try{
    if(!code) code = `${role.toUpperCase()}-${id()}-${id()}`;
    const ref = doc(db,"invites", code);
    await setDoc(ref, {
      role, active:true,
      createdAt: serverTimestamp(),
      expiresAt: exp ? {seconds: Math.floor(exp.getTime()/1000)} : null
    });
    ok("تم إنشاء الدعوة.");
    await loadInvites();
  }catch(e){ err("فشل إنشاء الدعوة"); console.error(e); }
}

async function loadInvites(){
  const tb = $("#invTable tbody"); if(!tb) return; tb.innerHTML="";
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
}

/* ------------ Settings save ------------ */
async function saveSettingsHandler(){
  clearMsg();
  if(currentRole!=="owner") return err("الإعدادات للمدير فقط.");
  try{
    await setDoc(doc(db,"settings","global"), {
      instituteName: $("#setName").value.trim() || "المعهد",
      activeYearId: $("#setYear").value
    }, { merge:true });
    ok("تم الحفظ.");
    await loadSettings();
  }catch(e){ err("فشل حفظ الإعدادات"); console.error(e); }
}

/* ------------ Utility on load ------------ */
window.addEventListener("load", ()=>{
  // load invites & subjects selects once the DOM is ready
  loadInvites();
});
