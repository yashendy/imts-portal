import {
  getFirestore, collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.0/firebase-firestore.js";

import { db } from "./exporter.js";
import { toast } from "./toast.js";

const els = {
  tblClasses: document.getElementById("tblClasses").querySelector("tbody"),
  tblUsers: document.getElementById("tblUsers").querySelector("tbody"),
  fGrade: document.getElementById("fGrade"),
  fTrack: document.getElementById("fTrack"),
  txtSearch: document.getElementById("txtSearch"),
  btnNewClass: document.getElementById("btnNewClass"),
  // Class modal
  classModal: document.getElementById("classModal"),
  cId: document.getElementById("cId"),
  cNameAr: document.getElementById("cNameAr"),
  cNameEn: document.getElementById("cNameEn"),
  cTemplate: document.getElementById("cTemplate"),
  cHomeroom: document.getElementById("cHomeroom"),
  btnSaveClass: document.getElementById("btnSaveClass"),
  // User modal
  userModal: document.getElementById("userModal"),
  uId: document.getElementById("uId"),
  uNameAr: document.getElementById("uNameAr"),
  uNameEn: document.getElementById("uNameEn"),
  uRole: document.getElementById("uRole"),
  uStatus: document.getElementById("uStatus"),
  uHomeroom: document.getElementById("uHomeroom"),
  uTracks: document.getElementById("uTracks"),
  btnSaveUser: document.getElementById("btnSaveUser"),
};

let _classesCache = [];
let _usersCache = [];
let _templatesCache = [];

// Load data
async function hydrateClasses() {
  const templatesSnap = await getDocs(collection(db, "periodTemplates"));
  _templatesCache = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const usersSnap = await getDocs(collection(db, "users"));
  _usersCache = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const classesSnap = await getDocs(collection(db, "classes"));
  _classesCache = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  fillTemplateSelects();
  renderClasses();
  renderUsers();
}

function fillTemplateSelects() {
  els.cTemplate.innerHTML = "";
  _templatesCache.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name || t.nameAr || t.id;
    els.cTemplate.appendChild(opt);
  });
}

// Render
function renderClasses() {
  els.tblClasses.innerHTML = "";
  _classesCache.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td>${c.nameAr}</td>
      <td>${c.nameEn}</td>
      <td>${c.trackCode}</td>
      <td>${getTemplateName(c.periodTemplateId)}</td>
      <td>
        <button onclick="openClassModal('${c.id}')">تعديل</button>
        <button onclick="deleteClass('${c.id}')">حذف</button>
      </td>`;
    els.tblClasses.appendChild(tr);
  });
}

function renderUsers() {
  els.tblUsers.innerHTML = "";
  _usersCache.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.nameAr || "—"}</td>
      <td>${u.nameEn || "—"}</td>
      <td>${u.role}</td>
      <td>${u.status}</td>
      <td>
        <button onclick="openUserModal('${u.id}')">تعديل</button>
      </td>`;
    els.tblUsers.appendChild(tr);
  });
}

function getTemplateName(tid) {
  const t = _templatesCache.find((x) => x.id === tid);
  return t ? (t.name || t.nameAr || t.id) : "—";
}

// Class modal
window.openClassModal = function (cid) {
  const c = _classesCache.find((x) => x.id === cid);
  if (!c) return;
  els.cId.value = c.id;
  els.cNameAr.value = c.nameAr;
  els.cNameEn.value = c.nameEn;
  els.cTemplate.value = c.periodTemplateId;
  els.classModal.showModal();
};

els.btnSaveClass.addEventListener("click", async (e) => {
  e.preventDefault();
  const id = els.cId.value;
  const ref = doc(db, "classes", id);
  await updateDoc(ref, {
    nameAr: els.cNameAr.value,
    nameEn: els.cNameEn.value,
    periodTemplateId: els.cTemplate.value,
    updatedAt: serverTimestamp(),
  });
  toast("success", "تم حفظ التعديلات");
  els.classModal.close();
  hydrateClasses();
});

window.deleteClass = async function (cid) {
  if (!confirm("هل أنت متأكد؟")) return;
  await deleteDoc(doc(db, "classes", cid));
  toast("success", "تم الحذف");
  hydrateClasses();
};

// User modal
window.openUserModal = function (uid) {
  const u = _usersCache.find((x) => x.id === uid);
  if (!u || !els.userModal) { toast("error","النافذة غير جاهزة"); return; }
  els.uId.value = u.id;
  els.uNameAr.value = u.nameAr || "";
  els.uNameEn.value = u.nameEn || "";
  els.uRole.value = u.role || "teacher";
  els.uStatus.value = u.status || "active";
  els.userModal.showModal();
};

els.btnSaveUser.addEventListener("click", async (e) => {
  e.preventDefault();
  const id = els.uId.value;
  const ref = doc(db, "users", id);
  await updateDoc(ref, {
    nameAr: els.uNameAr.value,
    nameEn: els.uNameEn.value,
    role: els.uRole.value,
    status: els.uStatus.value,
    updatedAt: serverTimestamp(),
  });
  toast("success", "تم حفظ بيانات المستخدم");
  els.userModal.close();
  hydrateClasses();
});

// Init
hydrateClasses();
