import { auth, db, serverTimestamp } from "../core/firebase.js";
import { requireRole, toast, showLoader, hideLoader, signOutSafe, getInstituteInfo } from "../core/app.js";
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.0/firebase-auth.js";

const els = {
  tabs: document.querySelectorAll(".tab"),
  contents: document.querySelectorAll(".tab-content"),
  btnLogout: document.getElementById("btnLogout"),
  countClasses: document.getElementById("countClasses"),
  countTeachers: document.getElementById("countTeachers"),
  countInvites: document.getElementById("countInvites"),
  currentYear: document.getElementById("currentYear"),
  inviteForm: document.getElementById("inviteForm"),
  inviteList: document.getElementById("inviteList"),
};

// ===== تبويبات =====
els.tabs.forEach(tab=>{
  tab.addEventListener("click",()=>{
    els.tabs.forEach(t=>t.classList.remove("active"));
    els.contents.forEach(c=>c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// ===== حماية الدور =====
onAuthStateChanged(auth, async (user)=>{
  if(!user){ location.href="index.html"; return; }
  const ok = await requireRole(["owner","admin"]);
  if(!ok){ toast("error","صلاحيات غير كافية"); location.href="index.html"; }
  else{
    hydrateOverview();
    loadInvites();
    hydrateInstitute();
  }
});

els.btnLogout?.addEventListener("click",()=>signOutSafe(true));

// ===== Overview =====
async function hydrateOverview(){
  try{
    showLoader();
    // classes count
    const cSnap = await getDocs(collection(db,"classes"));
    els.countClasses.textContent = cSnap.size;

    // teachers count
    const qT = query(collection(db,"users"), where("role","==","teacher"), where("status","==","active"));
    const tSnap = await getDocs(qT);
    els.countTeachers.textContent = tSnap.size;

    // invites count
    const qI = query(collection(db,"invites"), where("active","==",true));
    const iSnap = await getDocs(qI);
    els.countInvites.textContent = iSnap.size;

    // current year
    const inst = await getInstituteInfo();
    els.currentYear.textContent = inst?.currentAcademicYearId || "—";

  }catch(err){
    console.error(err);
    toast("error","تعذّر تحميل البيانات");
  }finally{ hideLoader(); }
}

// ===== Invites =====
els.inviteForm?.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const role = document.getElementById("role").value.trim()||"teacher";
  const usageLimit = Number(document.getElementById("usageLimit").value||1);
  const expiresAt = document.getElementById("expiresAt").value;
  const allowedEmail = document.getElementById("allowedEmail").value.trim();

  try{
    showLoader();
    const code = `INV-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
    const payload = {
      code,
      role,
      active:true,
      usageLimit,
      usedCount:0,
      createdAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    };
    if(expiresAt) payload.expiresAt = new Date(expiresAt);
    if(allowedEmail) payload.allowedEmail = allowedEmail;

    await addDoc(collection(db,"invites"),payload);
    toast("success","تم إنشاء الدعوة");
    els.inviteForm.reset();
    loadInvites();
  }catch(err){
    console.error(err);
    toast("error","فشل إنشاء الدعوة");
  }finally{ hideLoader(); }
});

async function loadInvites(){
  try{
    els.inviteList.innerHTML = "<tr><td colspan='7'>تحميل...</td></tr>";
    const snap = await getDocs(collection(db,"invites"));
    if(snap.empty){
      els.inviteList.innerHTML = "<tr><td colspan='7'>لا توجد دعوات</td></tr>";
      return;
    }
    els.inviteList.innerHTML = "";
    snap.forEach(docu=>{
      const inv = docu.data();
      const tr = document.createElement("tr");
      tr.innerHTML=`
        <td>${inv.code||docu.id}</td>
        <td>${inv.role}</td>
        <td>${inv.active?"نشط":"مغلق"}</td>
        <td>${inv.usedCount||0}/${inv.usageLimit||1}</td>
        <td>${inv.expiresAt? new Date(inv.expiresAt.seconds*1000).toLocaleDateString("ar-EG"):"—"}</td>
        <td>
          <button data-id="${docu.id}" data-action="toggle">${inv.active?"تعطيل":"تفعيل"}</button>
          <button data-id="${docu.id}" data-action="delete">حذف</button>
        </td>
      `;
      els.inviteList.appendChild(tr);
    });

    // actions
    els.inviteList.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click",()=>inviteAction(btn.dataset.id,btn.dataset.action));
    });

  }catch(err){
    console.error(err);
    toast("error","فشل تحميل الدعوات");
  }
}

async function inviteAction(id,action){
  try{
    const ref = doc(db,"invites",id);
    if(action==="delete"){
      await deleteDoc(ref);
      toast("success","تم الحذف");
    }else if(action==="toggle"){
      await updateDoc(ref,{ active:true });
      toast("success","تم التحديث");
    }
    loadInvites();
  }catch(err){
    console.error(err);
    toast("error","خطأ في العملية");
  }
}

// ===== Institute Info in header =====
async function hydrateInstitute(){
  const inst = await getInstituteInfo();
  document.querySelectorAll(".institute-name").forEach(n=>n.textContent = inst?.name || "اسم المعهد");
  if(inst?.logoUrl) document.querySelector(".logo").src = inst.logoUrl;
}
