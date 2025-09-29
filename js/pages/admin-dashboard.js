// js/pages/admin-dashboard.js
import { auth, db, serverTimestamp } from "../core/firebase.js";
import {
  requireRole, toast, showLoader, hideLoader, signOutSafe,
  getInstituteInfo, getCurrentYearId
} from "../core/app.js";
import {
  collection, getDocs, setDoc, doc, updateDoc, deleteDoc,
  query, where, getDoc, orderBy
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";

/* ---------- Helpers ---------- */
function displayClassNameLocal({ gradeId, trackCode, section, nameAr }) {
  if (nameAr && nameAr.trim()) return nameAr;
  const gradeMap = {
    g1:"الأول ابتدائي",g2:"الثاني ابتدائي",g3:"الثالث ابتدائي",
    g4:"الرابع ابتدائي",g5:"الخامس ابتدائي",g6:"السادس ابتدائي",
    g7:"الأول إعدادي",g8:"الثاني إعدادي",g9:"الثالث إعدادي",
    g10:"الأول ثانوي",g11:"الثاني ثانوي",g12:"الثالث ثانوي",
  };
  const trackMap = { ar:"عربي", lang:"لغات" };
  const secAr = {A:"أ",B:"ب",C:"ج",D:"د",E:"هـ",F:"و"}[section] || section || "";
  return `${gradeMap[gradeId] || gradeId} — ${trackMap[trackCode] || trackCode} — ${secAr}`;
}
function sectionToAr(section=""){ return ({A:"أ",B:"ب",C:"ج",D:"د",E:"هـ",F:"و"}[section]||section); }
function fmtDateMaybe(ts){ try{ if(!ts) return "—"; if(ts.seconds) return new Date(ts.seconds*1000).toLocaleDateString("ar-EG"); const d=new Date(ts); if(!isNaN(d)) return d.toLocaleDateString("ar-EG"); }catch{} return "—"; }
function genCode(prefix="INV"){ return `${prefix}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; }

/* ---------- Elements ---------- */
const els = {
  tabs: document.querySelectorAll(".tab"),
  contents: document.querySelectorAll(".tab-content"),
  btnLogout: document.getElementById("btnLogout"),
  // overview
  countClasses: document.getElementById("countClasses"),
  countTeachers: document.getElementById("countTeachers"),
  countInvites: document.getElementById("countInvites"),
  currentYear: document.getElementById("currentYear"),
  // invites
  inviteForm: document.getElementById("inviteForm"),
  inviteList: document.getElementById("inviteList"),
  // users
  usersList: document.getElementById("usersList"),
  fRole: document.getElementById("fRole"),
  fStatus: document.getElementById("fStatus"),
  fSearch: document.getElementById("fSearch"),
  userModal: document.getElementById("userModal"),
  uId: document.getElementById("uId"),
  uNameAr: document.getElementById("uNameAr"),
  uNameEn: document.getElementById("uNameEn"),
  uRole: document.getElementById("uRole"),
  uStatus: document.getElementById("uStatus"),
  uHomeroom: document.getElementById("uHomeroom"),
  uTracks: document.getElementById("uTracks"),
  btnSaveUser: document.getElementById("btnSaveUser"),
  // classes
  classesList: document.getElementById("classesList"),
  cGradeFilter: document.getElementById("cGradeFilter"),
  cTrackFilter: document.getElementById("cTrackFilter"),
  cSearch: document.getElementById("cSearch"),
  classForm: document.getElementById("classForm"),
  gradeId: document.getElementById("gradeId"),
  trackCode: document.getElementById("trackCode"),
  section: document.getElementById("section"),
  periodTemplateId: document.getElementById("periodTemplateId"),
  capacity: document.getElementById("capacity"),
  homeroomTeacherId: document.getElementById("homeroomTeacherId"),
  nameAr: document.getElementById("nameAr"),
  active: document.getElementById("active"),
  // class modal
  classModal: document.getElementById("classModal"),
  cId: document.getElementById("cId"),
  cNameAr: document.getElementById("cNameAr"),
  cNameEn: document.getElementById("cNameEn"),
  cTemplate: document.getElementById("cTemplate"),
  cCapacity: document.getElementById("cCapacity"),
  cHomeroom: document.getElementById("cHomeroom"),
  cActive: document.getElementById("cActive"),
};

/* ---------- Tabs ---------- */
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    els.contents.forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

/* ---------- Auth ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "index.html"; return; }
  const ok = await requireRole(["owner","admin"]);
  if (!ok) { toast("error","صلاحيات غير كافية"); location.href = "index.html"; }
  else {
    hydrateOverview();
    loadInvites();
    hydrateUsers();
    hydrateClasses();
    hydrateInstitute();
  }
});
els.btnLogout?.addEventListener("click", () => signOutSafe(true));

/* ============= Overview ============= */
async function hydrateOverview() {
  try {
    showLoader();
    const cSnap = await getDocs(collection(db,"classes"));
    els.countClasses.textContent = cSnap.size;

    const qT = query(collection(db,"users"), where("role","==","teacher"), where("status","==","active"));
    const tSnap = await getDocs(qT);
    els.countTeachers.textContent = tSnap.size;

    const qI = query(collection(db,"invites"), where("active","==",true));
    const iSnap = await getDocs(qI);
    els.countInvites.textContent = iSnap.size;

    const yearId = await getCurrentYearId();
    els.currentYear.textContent = yearId || "—";
  } catch (err) {
    console.error(err); toast("error","تعذّر تحميل البيانات");
  } finally { hideLoader(); }
}

/* ============= Invites ============= */
els.inviteForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const role=(document.getElementById("role").value||"teacher").trim().toLowerCase();
  const usageLimit=Number(document.getElementById("usageLimit").value||1);
  const expiresAtRaw=document.getElementById("expiresAt").value;
  const allowedEmail=(document.getElementById("allowedEmail").value||"").trim().toLowerCase();

  if(!role) return toast("warning","من فضلك حدِّد الدور.");
  if(usageLimit<1 || !Number.isFinite(usageLimit)) return toast("warning","عدد الاستخدامات يجب أن يكون رقمًا موجبًا.");

  try{
    showLoader();
    const code=genCode("INV");
    const ref=doc(db,"invites",code);
    const payload={ code,role,active:true,usageLimit,usedCount:0, createdAt:serverTimestamp(), updatedAt:serverTimestamp() };
    if(expiresAtRaw) payload.expiresAt=new Date(expiresAtRaw);
    if(allowedEmail) payload.allowedEmail=allowedEmail;
    await setDoc(ref,payload);
    toast("success","تم إنشاء الدعوة"); els.inviteForm.reset(); await loadInvites();
  }catch(err){ console.error(err); toast("error","فشل إنشاء الدعوة"); }
  finally{ hideLoader(); }
});

async function loadInvites(){
  try{
    els.inviteList.innerHTML="<tr><td colspan='6'>تحميل...</td></tr>";
    const snap=await getDocs(collection(db,"invites"));
    if(snap.empty){ els.inviteList.innerHTML="<tr><td colspan='6'>لا توجد دعوات</td></tr>"; return; }
    els.inviteList.innerHTML="";
    snap.forEach((d)=>{
      const inv=d.data(); const id=d.id;
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${inv.code||id}</td>
        <td>${inv.role||"—"}</td>
        <td>${inv.active?"نشط":"مغلق"}</td>
        <td>${(inv.usedCount||0)}/${(inv.usageLimit||1)}</td>
        <td>${fmtDateMaybe(inv.expiresAt)}</td>
        <td>
          <button class="btn-action" data-id="${id}" data-action="copy">نسخ</button>
          <button class="btn-action" data-id="${id}" data-action="toggle">${inv.active?"تعطيل":"تفعيل"}</button>
          <button class="btn-action danger" data-id="${id}" data-action="delete">حذف</button>
        </td>`;
      els.inviteList.appendChild(tr);
    });
    els.inviteList.querySelectorAll("button.btn-action").forEach((btn)=>{
      btn.addEventListener("click",()=>inviteAction(btn.dataset.id,btn.dataset.action));
    });
  }catch(err){ console.error(err); toast("error","فشل تحميل الدعوات"); }
}
async function inviteAction(id,action){
  try{
    const ref=doc(db,"invites",id);
    if(action==="copy"){ await navigator.clipboard.writeText(id); toast("success","تم نسخ الكود"); return; }
    if(action==="delete"){ if(!confirm("متأكد من حذف الدعوة؟")) return; await deleteDoc(ref); toast("success","تم الحذف"); loadInvites(); return; }
    if(action==="toggle"){
      const snap=await getDoc(ref); if(!snap.exists()) return toast("error","الدعوة غير موجودة");
      const current=!!snap.data().active;
      await updateDoc(ref,{active:!current, updatedAt:serverTimestamp()});
      toast("success", current?"تم التعطيل":"تم التفعيل"); loadInvites(); return;
    }
  }catch(err){ console.error(err); toast("error","خطأ في العملية"); }
}

/* ============= Users ============= */
let _usersCache=[]; let _classesCache=[];

async function hydrateUsers(){
  try{
    showLoader();
    const cSnap=await getDocs(collection(db,"classes"));
    _classesCache=cSnap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
    fillHomeroomSelect(_classesCache);

    let uSnap;
    try{ uSnap=await getDocs(query(collection(db,"users"), orderBy("createdAt","desc"))); }
    catch{ uSnap=await getDocs(collection(db,"users")); }
    _usersCache=uSnap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
    _usersCache.sort((a,b)=>(b?.createdAt?.seconds||0)-(a?.createdAt?.seconds||0));

    renderUsers(_usersCache); bindUserFilters();
  }catch(err){ console.error(err); toast("error","فشل تحميل المستخدمين"); els.usersList.innerHTML=`<tr><td colspan="7">تعذّر التحميل.</td></tr>`; }
  finally{ hideLoader(); }
}
function fillHomeroomSelect(classes=[]){
  const sel=els.uHomeroom; if(!sel) return;
  sel.innerHTML=`<option value="">— لا شيء —</option>`;
  classes.sort((a,b)=>(a.order||0)-(b.order||0) || String(a.id).localeCompare(b.id,"ar"));
  classes.forEach(c=>{
    const name=c.nameAr||c.nameEn||c.id;
    const opt=document.createElement("option"); opt.value=c.id; opt.textContent=name; sel.appendChild(opt);
  });
}
function bindUserFilters(){ [els.fRole,els.fStatus,els.fSearch].forEach(el=>el?.addEventListener("input",()=>renderUsers(_usersCache))); }
function renderUsers(data=[]){
  if(!els.usersList) return;
  const role=(els.fRole?.value||"").toLowerCase(); const status=(els.fStatus?.value||"").toLowerCase(); const q=(els.fSearch?.value||"").toLowerCase();
  let rows=data.filter(u=>{
    const okRole=!role || String(u.role||"").toLowerCase()===role;
    const okStatus=!status || String(u.status||"").toLowerCase()===status;
    const text=`${u.nameAr||""} ${u.nameEn||""} ${u.email||""}`.toLowerCase();
    const okQ=!q || text.includes(q);
    return okRole && okStatus && okQ;
  });
  if(!rows.length){ els.usersList.innerHTML=`<tr><td colspan="7">لا نتائج مطابقة…</td></tr>`; return; }
  els.usersList.innerHTML="";
  rows.forEach(u=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${u.nameAr || u.nameEn || "—"}</td>
      <td>${u.email || "—"}</td>
      <td>${u.role || "—"}</td>
      <td>${u.status || "—"}</td>
      <td>${u.homeroomClassId || "—"}</td>
      <td>${Array.isArray(u.trackCodes)?u.trackCodes.join("، "):"—"}</td>
      <td>
        <button class="btn-action" data-id="${u.id}" data-act="toggleStatus">${(u.status||"").toLowerCase()==="active"?"إيقاف":"تفعيل"}</button>
        <button class="btn-action" data-id="${u.id}" data-act="switchRole">تحويل دور</button>
        <button class="btn-action" data-id="${u.id}" data-act="edit">تعديل</button>
      </td>`;
    els.usersList.appendChild(tr);
  });
  els.usersList.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>userAction(btn.dataset.id,btn.dataset.act)));
}
async function userAction(uid,act){
  try{
    const ref=doc(db,"users",uid);
    if(act==="toggleStatus"){
      const snap=await getDoc(ref); if(!snap.exists()) return;
      const current=(snap.data().status||"").toLowerCase()==="active";
      await updateDoc(ref,{ status: current?"inactive":"active", updatedAt:serverTimestamp() });
      toast("success", current?"تم إيقاف الحساب":"تم تفعيل الحساب");
      await refreshUsersRow(uid); return;
    }
    if(act==="switchRole"){
      const snap=await getDoc(ref); if(!snap.exists()) return;
      const role=(snap.data().role||"").toLowerCase();
      const next= role==="teacher" ? "admin" : "teacher";
      if(!confirm(`تأكيد تحويل الدور إلى: ${next}?`)) return;
      await updateDoc(ref,{ role: next, updatedAt:serverTimestamp() });
      toast("success","تم تحديث الدور"); await refreshUsersRow(uid); return;
    }
    if(act==="edit"){ openUserModal(uid); return; }
  }catch(err){ console.error(err); toast("error", `فشل تنفيذ العملية: ${err?.code||""}`); }
}
async function refreshUsersRow(uid){
  const snap=await getDoc(doc(db,"users",uid));
  const idx=_usersCache.findIndex(u=>u.id===uid);
  if(snap.exists() && idx>=0) _usersCache[idx]={ id:uid, ...(snap.data()||{}) };
  renderUsers(_usersCache);
}
/* modal */
function openUserModal(uid){
  const u=_usersCache.find(x=>x.id===uid); if(!u) return;
  els.uId.value=u.id; els.uNameAr.value=u.nameAr||""; els.uNameEn.value=u.nameEn||"";
  els.uRole.value=(u.role||"teacher"); els.uStatus.value=(u.status||"active");
  els.uHomeroom.value=u.homeroomClassId||"";
  [...els.uTracks.options].forEach(opt=> opt.selected=Array.isArray(u.trackCodes)?u.trackCodes.includes(opt.value):false );
  els.userModal?.showModal();
}
els.btnSaveUser?.addEventListener("click", async ()=>{
  try{
    showLoader();
    const uid=els.uId.value;
    const payload={
      nameAr: els.uNameAr.value.trim()||null,
      nameEn: els.uNameEn.value.trim()||null,
      role: els.uRole.value,
      status: els.uStatus.value,
      homeroomClassId: els.uHomeroom.value || null,
      trackCodes: [...els.uTracks.options].filter(o=>o.selected).map(o=>o.value),
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db,"users",uid), payload);
    toast("success","تم حفظ التعديلات"); els.userModal.close(); await refreshUsersRow(uid);
  }catch(err){ console.error(err); toast("error", `تعذّر حفظ التعديلات: ${err?.code||""}`); }
  finally{ hideLoader(); }
});

/* ============= Classes ============= */
let _classesAll=[]; let _templatesCache=[]; let _teachersActive=[];
function fillTemplateSelects(){
  const labelOf=(t)=> (t.name || t.nameAr || t.id || "قالب بدون اسم");
  if(els.periodTemplateId){
    els.periodTemplateId.innerHTML=`<option value="">— اختر قالب —</option>`;
    _templatesCache.forEach(t=>{
      const opt=document.createElement("option"); opt.value=t.id; opt.textContent=labelOf(t); els.periodTemplateId.appendChild(opt);
    });
  }
  if(els.cTemplate){
    els.cTemplate.innerHTML=``;
    _templatesCache.forEach(t=>{
      const opt=document.createElement("option"); opt.value=t.id; opt.textContent=labelOf(t); els.cTemplate.appendChild(opt);
    });
  }
}
function fillHomeroomTeachers(){
  if(els.homeroomTeacherId){
    els.homeroomTeacherId.innerHTML=`<option value="">— لا شيء —</option>`;
    _teachersActive.forEach(t=>{
      const opt=document.createElement("option"); opt.value=t.id; opt.textContent=(t.nameAr||t.nameEn||t.email||t.id); els.homeroomTeacherId.appendChild(opt);
    });
  }
  if(els.cHomeroom){
    els.cHomeroom.innerHTML=`<option value="">— لا شيء —</option>`;
    _teachersActive.forEach(t=>{
      const opt=document.createElement("option"); opt.value=t.id; opt.textContent=(t.nameAr||t.nameEn||t.email||t.id); els.cHomeroom.appendChild(opt);
    });
  }
}
async function hydrateClasses(){
  showLoader();
  try{
    // templates
    try{
      const ptSnap=await getDocs(collection(db,"periodTemplates"));
      _templatesCache=ptSnap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
      fillTemplateSelects();
    }catch(e){ console.error("periodTemplates error:",e); toast("error","تعذّر تحميل قوالب الحصص"); throw e; }
    // teachers
    try{
      const qT=query(collection(db,"users"), where("role","==","teacher"), where("status","==","active"));
      const tSnap=await getDocs(qT);
      _teachersActive=tSnap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
      fillHomeroomTeachers();
    }catch(e){ console.error("users(teachers) error:",e); toast("error","تعذّر تحميل قائمة المعلمين"); throw e; }
    // classes
    try{
      const cSnap=await getDocs(collection(db,"classes"));
      _classesAll=cSnap.docs.map(d=>({id:d.id, ...(d.data()||{})}));
      renderClasses(_classesAll); bindClassFilters(); bindClassForm();
    }catch(e){ console.error("classes error:",e); toast("error","تعذّر تحميل الصفوف"); throw e; }
  }catch(err){
    console.error("hydrateClasses failed:",err);
    els.classesList.innerHTML=`<tr><td colspan="10">تعذّر التحميل.</td></tr>`;
  }finally{ hideLoader(); }
}
function bindClassFilters(){ [els.cGradeFilter,els.cTrackFilter,els.cSearch].forEach(el=>el?.addEventListener("input",()=>renderClasses(_classesAll))); }
function renderClasses(data=[]){
  if(!els.classesList) return;
  const g=(els.cGradeFilter?.value||"").toLowerCase(); const t=(els.cTrackFilter?.value||"").toLowerCase(); const q=(els.cSearch?.value||"").toLowerCase();
  let rows=data.filter(c=>{
    const okG=!g || String(c.gradeId||"").toLowerCase()===g;
    const okT=!t || String(c.trackCode||"").toLowerCase()===t;
    const text=`${c.nameAr||""} ${c.nameEn||""} ${c.id||""}`.toLowerCase();
    const okQ=!q || text.includes(q);
    return okG && okT && okQ;
  });
  if(!rows.length){ els.classesList.innerHTML=`<tr><td colspan="10">لا نتائج مطابقة…</td></tr>`; return; }
  rows.sort((a,b)=> String(a.gradeId||"").localeCompare(String(b.gradeId||""),"ar") || String(a.id).localeCompare(String(b.id),"ar"));
  els.classesList.innerHTML="";
  rows.forEach(c=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${c.nameAr || displayClassNameLocal({gradeId:c.gradeId, trackCode:c.trackCode, section:c.section, nameAr:c.nameAr})}</td>
      <td>${c.id}</td><td>${c.gradeId||"—"}</td><td>${c.trackCode||"—"}</td>
      <td>${c.section?`${c.section} (${sectionToAr(c.section)})`:"—"}</td>
      <td>${c.periodTemplateId||"—"}</td><td>${c.capacity??"—"}</td>
      <td>${c.homeroomTeacherId||"—"}</td><td>${c.active===false?"مغلق":"نشط"}</td>
      <td>
        <button class="btn-action" data-id="${c.id}" data-act="editClass">تعديل</button>
        <button class="btn-action danger" data-id="${c.id}" data-act="deleteClass">حذف</button>
      </td>`;
    els.classesList.appendChild(tr);
  });
  els.classesList.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>classAction(btn.dataset.id,btn.dataset.act)));
}
function composeClassId(gradeId,trackCode,section){ return `${gradeId}-${trackCode}-${section}`; }
function autoNameAr(gradeId,trackCode,section,fallback=""){ return displayClassNameLocal({gradeId,trackCode,section,nameAr:""}) || fallback || `${gradeId} ـ ${trackCode} ـ ${sectionToAr(section)}`; }
function bindClassForm(){
  els.classForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const gradeId=els.gradeId.value, trackCode=els.trackCode.value, section=els.section.value;
    const templateId=els.periodTemplateId.value; const cap=Number(els.capacity.value||0);
    const homeroom=els.homeroomTeacherId.value||null; const nameAr=(els.nameAr.value||"").trim(); const active=!!els.active.checked;
    if(!gradeId||!trackCode||!section||!templateId){ toast("warning","الرجاء اختيار الصف والمسار والقسم والقالب."); return; }
    try{
      showLoader();
      const id=composeClassId(gradeId,trackCode,section);
      const classRef=doc(db,"classes",id); const exists=await getDoc(classRef);
      if(exists.exists()){ toast("error","هذا الصف مُسجّل بالفعل."); return; }
      const yearId=await getCurrentYearId();
      const payload={
        id, yearId, gradeId, trackCode, section, sectionNameAr: sectionToAr(section),
        nameAr: nameAr || autoNameAr(gradeId,trackCode,section),
        nameEn: `${gradeId}-${trackCode}-${section}`,
        periodTemplateId: templateId, capacity: Number.isFinite(cap)&&cap>0?cap:null,
        homeroomTeacherId: homeroom||null, active, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      await setDoc(classRef,payload);
      toast("success","تم حفظ الصف"); els.classForm.reset();
      _classesAll.push(payload); renderClasses(_classesAll);
    }catch(err){ console.error(err); toast("error",`تعذّر حفظ الصف: ${err?.code||""}`); }
    finally{ hideLoader(); }
  });
}
function openClassModal(cId){
  const c=_classesAll.find(x=>x.id===cId); if(!c) return;
  els.cId.value=c.id; els.cNameAr.value=c.nameAr||""; els.cNameEn.value=c.nameEn||"";
  els.cCapacity.value=c.capacity??""; els.cActive.value=(c.active===false)?"false":"true";
  els.cTemplate.innerHTML=""; _templatesCache.forEach(t=>{ const opt=document.createElement("option"); opt.value=t.id; opt.textContent=(t.name||t.nameAr||t.id); if(t.id===c.periodTemplateId) opt.selected=true; els.cTemplate.appendChild(opt); });
  els.cHomeroom.innerHTML=`<option value="">— لا شيء —</option>`; _teachersActive.forEach(t=>{ const opt=document.createElement("option"); opt.value=t.id; opt.textContent=(t.nameAr||t.nameEn||t.email||t.id); if(t.id===c.homeroomTeacherId) opt.selected=true; els.cHomeroom.appendChild(opt); });
  els.classModal?.showModal();
}
async function classAction(cId,act){
  if(act==="editClass"){ openClassModal(cId); return; }
  if(act==="deleteClass"){
    if(!confirm("تأكيد حذف الصف؟")) return;
    try{ showLoader(); await deleteDoc(doc(db,"classes",cId)); toast("success","تم حذف الصف"); _classesAll=_classesAll.filter(x=>x.id!==cId); renderClasses(_classesAll); }
    catch(err){ console.error(err); toast("error","تعذّر الحذف"); }
    finally{ hideLoader(); }
  }
}
document.getElementById("btnSaveClass")?.addEventListener("click", async ()=>{
  const id=els.cId.value; if(!id) return;
  const ref=doc(db,"classes",id);
  const payload={
    nameAr:(els.cNameAr.value||"").trim()||null, nameEn:(els.cNameEn.value||"").trim()||null,
    periodTemplateId: els.cTemplate.value || null, capacity: Number(els.cCapacity.value||0) || null,
    homeroomTeacherId: els.cHomeroom.value || null, active: els.cActive.value==="true", updatedAt: serverTimestamp(),
  };
  try{
    showLoader(); await updateDoc(ref,payload); toast("success","تم حفظ التعديلات"); document.getElementById("classModal").close();
    const i=_classesAll.findIndex(x=>x.id===id); if(i>=0) _classesAll[i]={..._classesAll[i], ...payload}; renderClasses(_classesAll);
  }catch(err){ console.error(err); toast("error",`تعذّر حفظ التعديلات: ${err?.code||""}`); }
  finally{ hideLoader(); }
});

/* ============= Branding Header ============= */
async function hydrateInstitute() {
  const inst = await getInstituteInfo();
  document.querySelectorAll(".institute-name").forEach(n => n.textContent = inst?.name || "اسم المعهد");
  if (inst?.logoUrl) document.querySelector(".logo").src = inst.logoUrl;
}
