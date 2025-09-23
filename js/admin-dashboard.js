// js/admin-dashboard.js
// ES Module - Firebase v10+ from CDN

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, getDocs, query, orderBy, limit,
  where, getCountFromServer, collectionGroup
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ========== Firebase Config (من لقطة الشاشة) ========== */
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrk...WnuYtSSM", // اختصرته للقراءة - استخدم القيم الكاملة عندك
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.appspot.com",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGVJ9V"
};
/* ======================================================= */

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// DOM helpers
const $ = (id) => document.getElementById(id);
const roleBadge   = $("roleBadge");
const yearSelect  = $("yearSelect");
const kpiStudents = $("kpiStudents");
const kpiTeachers = $("kpiTeachers");
const kpiClasses  = $("kpiClasses");
const kpiAlerts   = $("kpiAlerts");
const alertsList  = $("alertsList");
const activityList= $("activityList");
const aiSummary   = $("aiSummary");
const aiCmdInput  = $("aiCmdInput");
const aiCmdRun    = $("aiCmdRun");
const btnSignOut  = $("btnSignOut");
const toast       = $("globalMsg");

// أدوار بالعربي
const roleArabicMap = { owner: "مالك", admin: "أدمن", teacher: "معلّم" };

// توست
function showToast(msg, type="ok"){
  const colors = { ok:"#065f46", err:"#7f1d1d", warn:"#92400e" };
  toast.textContent = msg;
  toast.style.background = colors[type] || colors.ok;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

/* ====================== بيانات الهيدر ====================== */

// تحميل الأعوام الأكاديمية (اختياري: group "academicYears" بحقل "name")
async function loadAcademicYears() {
  try {
    const qy = query(collection(db, "academicYears"), orderBy("name","desc"));
    const snap = await getDocs(qy);
    const current = "2025-2026";
    if (!snap.empty) {
      yearSelect.innerHTML = "";
      snap.forEach(d => {
        const name = d.data().name || d.id;
        const opt = document.createElement("option");
        opt.value = name; opt.textContent = name;
        if (name === current) opt.selected = true;
        yearSelect.appendChild(opt);
      });
    }
  } catch(e) {
    console.warn("loadAcademicYears:", e);
  }
}

// جلب دور المستخدم من users/{uid}
async function loadRoleBadge(user){
  try {
    if (!user) { roleBadge.textContent = "—"; return; }
    const d = await getDoc(doc(db, "users", user.uid));
    const role = d.exists() ? (d.data().role || "teacher") : "teacher";
    roleBadge.textContent = roleArabicMap[role] || role;
    // إظهار أدوات الأدمن/المالك فقط
    document.querySelectorAll(".only-admin").forEach(el=>{
      el.style.display = (role === "admin" || role === "owner") ? "inline-flex" : "none";
    });
  } catch(e){
    roleBadge.textContent = "—";
  }
}

/* ====================== KPIs سريعة ====================== */

async function loadKPIs(){
  try {
    // counts سريعة — لو ما كانش عندك بيانات كثيرة هيبقى كفاية
    const [cS, cT, cC] = await Promise.all([
      getCountFromServer(collection(db,"students")),
      getCountFromServer(collection(db,"teachers")),
      getCountFromServer(collection(db,"classes")),
    ]);
    kpiStudents.textContent = cS.data().count ?? "—";
    kpiTeachers.textContent = cT.data().count ?? "—";
    kpiClasses.textContent  = cC.data().count ?? "—";

    const alertsCount = await estimateAlerts();
    kpiAlerts.textContent = String(alertsCount);
  } catch(e){
    console.warn("loadKPIs:", e);
    kpiStudents.textContent = kpiTeachers.textContent = kpiClasses.textContent = "—";
  }
}

/* ====================== تنبيهات ====================== */

// 1) دعوات تنتهي خلال أسبوع
async function alertsInvitesExpiring(limitN=5){
  const now = new Date();
  const soon= new Date(now.getTime()+7*24*3600*1000);
  try {
    const qy = query(
      collection(db,"invites"),
      where("active","==",true),
      where("expiresAt","<=", soon),
      orderBy("expiresAt","asc"),
      limit(limitN)
    );
    const snap = await getDocs(qy);
    return snap.docs.map(docu => {
      const data = docu.data();
      const ex = data.expiresAt?.toDate?.() || new Date();
      return {
        text: `دعوات تنتهي قريبًا: الكود ${docu.id} — ${ex.toLocaleDateString("ar-EG")}`,
        href: "invites.html", severity: "warn"
      };
    });
  } catch(e){ return []; }
}

// 2) فصول فوق السعة — يعتمد على وجود `capacity` و`enrolled` داخل وثيقة الفصل
async function alertsClassesOverCapacity(limitN=5){
  try{
    const qy = query(collection(db,"classes"), limit(100));
    const snap = await getDocs(qy);
    const over = [];
    snap.forEach(d=>{
      const c = d.data();
      const cap = Number(c.capacity ?? 0);
      const enr = Number(c.enrolled ?? -1); // إن لم يوجد، سيُتجاهل
      if (cap>0 && enr>=0 && enr>cap) {
        over.push({ id:d.id, name:c.name||d.id, cap, enr });
      }
    });
    return over.slice(0,limitN).map(c=>({
      text: `فصل "${c.name}" فوق السعة (${c.enr}/${c.cap})`,
      href:"classes.html", severity:"warn"
    }));
  }catch(e){ return []; }
}

// 3) تعارضات الجدول — بسيط: نقرأ 100 إدخال ونبحث تضارب teacherId/classId في نفس اليوم/التوقيت
async function alertsTimetableConflicts(limitN=5){
  try{
    const qy = query(collection(db,"timetableEntries"), orderBy("day","asc"), limit(100));
    const snap = await getDocs(qy);
    const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));
    const conflicts = [];

    const key = (x) => `${x.day}|${x.start}-${x.end}`;
    const bySlot = new Map();
    for(const r of rows){
      const k = key(r);
      if(!bySlot.has(k)) bySlot.set(k, []);
      bySlot.get(k).push(r);
    }
    for(const [slot, arr] of bySlot){
      // تضارب لو نفس المعلّم مكرر في نفس الـslot أو نفس الفصل
      const seenTeach = new Map(); const seenClass = new Map();
      for(const r of arr){
        if(r.teacherId){
          if(seenTeach.has(r.teacherId)) conflicts.push({type:"teacher", slot, a:seenTeach.get(r.teacherId), b:r});
          else seenTeach.set(r.teacherId, r);
        }
        if(r.classId){
          if(seenClass.has(r.classId)) conflicts.push({type:"class", slot, a:seenClass.get(r.classId), b:r});
          else seenClass.set(r.classId, r);
        }
      }
    }
    return conflicts.slice(0,limitN).map(c=>({
      text: c.type==="teacher"
        ? `تعارض: المعلّم ${c.a.teacherId} لديه حصتين في نفس الوقت (${c.slot})`
        : `تعارض: الفصل ${c.a.classId} لديه حصتين في نفس الوقت (${c.slot})`,
      href:"timetable.html", severity:"warn"
    }));
  }catch(e){ return []; }
}

// تقدير إجمالي التنبيهات للـKPI
async function estimateAlerts(){
  const lists = await Promise.all([
    alertsInvitesExpiring(50),
    alertsClassesOverCapacity(50),
    alertsTimetableConflicts(50)
  ]);
  return lists.reduce((n, arr)=> n + arr.length, 0);
}

async function loadAlerts(){
  alertsList.innerHTML = "";
  const all = (await Promise.all([
    alertsInvitesExpiring(),
    alertsClassesOverCapacity(),
    alertsTimetableConflicts()
  ])).flat();

  if(!all.length){
    alertsList.innerHTML = `<li><span>لا توجد تنبيهات الآن ✅</span></li>`;
    return;
  }
  const frag = document.createDocumentFragment();
  all.forEach(item=>{
    const li = document.createElement("li");
    const span = document.createElement("span"); span.textContent = item.text;
    const a = document.createElement("a"); a.href=item.href; a.className="alert-cta"; a.textContent="عرض";
    li.appendChild(span); li.appendChild(a);
    frag.appendChild(li);
  });
  alertsList.appendChild(frag);
}

/* ====================== نشاطات ====================== */

async function loadActivities(){
  activityList.innerHTML = "";
  try{
    const qy = query(collection(db,"activities"), orderBy("createdAt","desc"), limit(10));
    const snap = await getDocs(qy);
    if (snap.empty) {
      activityList.innerHTML = `<li>لا توجد نشاطات بعد.</li>`;
      return;
    }
    const frag = document.createDocumentFragment();
    snap.forEach(docu=>{
      const a = docu.data();
      const when = a.createdAt?.toDate?.() || new Date();
      const li = document.createElement("li");
      li.textContent = `${a.who || "مستخدم"} — ${a.what || "عملية"} — ${when.toLocaleString("ar-EG")}`;
      frag.appendChild(li);
    });
    activityList.appendChild(frag);
  }catch(e){
    activityList.innerHTML = `<li>تعذّر تحميل النشاطات.</li>`;
  }
}

/* ====================== ملخص ذكي (AI Summary) ====================== */

// خوارزمية خفيفة (rule-based) تتكوّن من التنبيهات نفسها
async function renderAISummary(){
  const [exp, over, conf] = await Promise.all([
    alertsInvitesExpiring(50),
    alertsClassesOverCapacity(50),
    alertsTimetableConflicts(50)
  ]);
  const parts = [];
  if (over.length) parts.push(`${over.length} فصل فوق السعة`);
  if (conf.length) parts.push(`${conf.length} تعارض في الجدول`);
  if (exp.length)  parts.push(`${exp.length} دعوة تنتهي قريبًا`);
  const msg = parts.length ? `اليوم: ${parts.join(" — ")}.` : "لا توجد مؤشرات غير طبيعية الآن ✅";
  aiSummary.querySelector(".card-body").textContent = msg;
}

/* ====================== مساعد أوامر (AI Command) ====================== */

function parseArabicCommand(text){
  const t = (text||"").trim();

  // أمثلة مدعومة:
  // "طلاب الصف العاشر أقل من 30" → /students?q=&grade=g10&capacity<30
  // "فصول g4 أقل من 30" → /classes?grade=g4&capacity<30
  // "تعارض جدول الأربعاء" → /timetable?day=wed&conflicts=1
  // "معلمو العربي" → /teachers?subject=arabic
  // "طلاب فصل 10A" → /students?class=10A
  // ملاحظة: دي قواعد بسيطة، تقدر تطوّرها لاحقًا بنموذج LLM

  // يوم الأسبوع
  const dayMap = { "السبت":"sat","الأحد":"sun","الاتنين":"mon","الإثنين":"mon","الثلاثاء":"tue","الأربعاء":"wed","الخميس":"thu","الجمعة":"fri" };

  // الصف (g10, g11...)
  const gradeMatch = t.match(/(الصف|g)\s*([0-9]{1,2})/i);
  const gradeParam = gradeMatch ? `grade=g${gradeMatch[2]}` : "";

  // أقل من رقم (سعة/عدد)
  const ltMatch = t.match(/أقل\s+من\s+(\d{1,3})/);
  const ltParam  = ltMatch ? `lt=${ltMatch[1]}` : "";

  // اسم فصل
  const classMatch = t.match(/فصل\s+([A-Za-z0-9\-]+)/);
  const classParam = classMatch ? `class=${classMatch[1]}` : "";

  // مادة
  const subjMatch  = t.match(/العربي|الرياضيات|الإنجليزي|العلوم|English|Math|Arabic/i);
  const subjParam  = subjMatch ? `subject=${(subjMatch[0].toLowerCase().includes("arab")?"arabic":subjMatch[0].toLowerCase())}` : "";

  // تعارض جدول + يوم اختياري
  if (/تعارض/.test(t) && /جدول/.test(t)){
    const day = Object.keys(dayMap).find(d=>t.includes(d));
    const qp = new URLSearchParams({ conflicts:"1", ...(day?{day:dayMap[day]}:{}) });
    return `timetable.html?${qp.toString()}`;
  }

  // طلاب …
  if (/طلاب/.test(t)){
    const qp = new URLSearchParams();
    if (gradeParam) qp.append("grade", gradeParam.split("=")[1]);
    if (classParam) qp.append("class", classParam.split("=")[1]);
    if (ltParam)    qp.append("lt", ltParam.split("=")[1]);
    return `students.html?${qp.toString()}`;
  }

  // معلّمون …
  if (/معلم|معلّمون|المعلمين/.test(t)){
    const qp = new URLSearchParams();
    if (subjParam) qp.append("subject", subjParam.split("=")[1]);
    return `teachers.html?${qp.toString()}`;
  }

  // فصول …
  if (/فصول|فصل/.test(t)){
    const qp = new URLSearchParams();
    if (gradeParam) qp.append("grade", gradeParam.split("=")[1]);
    if (ltParam)    qp.append("lt", ltParam.split("=")[1]);
    return `classes.html?${qp.toString()}`;
  }

  return ""; // غير مفهوم
}

function setupAICommand(){
  aiCmdRun?.addEventListener("click", ()=>{
    const target = parseArabicCommand(aiCmdInput.value);
    if (target){
      location.href = target;
    } else {
      showToast("لم أفهم الأمر. جرّب: طلاب الصف العاشر أقل من 30", "warn");
    }
  });
  aiCmdInput?.addEventListener("keydown",(e)=>{
    if(e.key==="Enter") aiCmdRun.click();
  });
}

/* ====================== خروج ====================== */
btnSignOut?.addEventListener("click", async ()=>{
  try{
    await signOut(auth);
    showToast("تم تسجيل الخروج","ok");
    setTimeout(()=> location.href = "index.html", 700);
  }catch(e){ showToast("تعذّر تسجيل الخروج","err"); }
});

/* ====================== Init ====================== */

async function init(){
  await loadAcademicYears();
  onAuthStateChanged(auth, async (user)=>{
    await loadRoleBadge(user);
    await Promise.all([loadKPIs(), loadAlerts(), loadActivities(), renderAISummary()]);
  });
  setupAICommand();
}

init();
