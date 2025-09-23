import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc,
  increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrk...WnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.appspot.com",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const studentForm = $("studentForm");
const studentsList = $("studentsList");
const toast = $("globalMsg");
const roleBadge = $("roleBadge");
const btnSignOut = $("btnSignOut");

// 🔔 توست
function showToast(msg, type="ok") {
  toast.textContent = msg;
  toast.style.background = type==="err" ? "#7f1d1d" : "#065f46";
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),2000);
}

// 🆔 توليد Student Code حسب الصف
async function generateStudentCode(grade) {
  const snap = await getDocs(query(collection(db,"students"), where("grade","==",grade)));
  const count = snap.size + 1;
  return `${grade}-${String(count).padStart(3,"0")}`;
}

// 🔢 توليد Seat Number من عداد Firestore
async function generateSeatNumber() {
  const counterRef = doc(db, "counters", "seatNumbers");
  let newNumber = 1;
  await runTransaction(db, async (trx)=>{
    const snap = await trx.get(counterRef);
    if(!snap.exists()) {
      trx.set(counterRef,{ value:1 });
      newNumber = 1;
    } else {
      newNumber = (snap.data().value || 0) + 1;
      trx.update(counterRef,{ value: increment(1) });
    }
  });
  return newNumber;
}

// ➕ إضافة طالب
studentForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const name = $("name").value.trim();
  const grade= $("grade").value;
  const gender=$("gender").value;
  const religion=$("religion").value;
  const active= $("active").value==="true";

  if(!name || !grade || !gender || !religion) {
    showToast("املأ جميع الحقول","err");
    return;
  }

  // فحص التكرار بالاسم + الصف
  const qy = query(collection(db,"students"), where("grade","==",grade), where("name","==",name));
  const exists = await getDocs(qy);
  if(!exists.empty) {
    showToast("⚠️ يوجد طالب بنفس الاسم في نفس الصف","warn");
    return;
  }

  try {
    const studentCode = await generateStudentCode(grade);
    const seatNumber  = await generateSeatNumber();

    await addDoc(collection(db,"students"), {
      name, grade, gender, religion, active,
      studentCode, seatNumber,
      createdAt: new Date(),
      createdBy: auth.currentUser?.uid || "system"
    });

    showToast("تمت إضافة الطالب ✅");
    studentForm.reset();
    loadStudents();
  } catch(e) {
    console.error(e);
    showToast("خطأ أثناء الإضافة","err");
  }
});

// 📋 تحميل الطلاب
async function loadStudents() {
  studentsList.innerHTML = "";
  const snap = await getDocs(collection(db,"students"));
  snap.forEach(docu=>{
    const s = docu.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.grade}</td>
      <td>${s.gender==="M"?"ذكر":"أنثى"}</td>
      <td>${s.religion==="muslim"?"مسلم":"مسيحي"}</td>
      <td>${s.studentCode}</td>
      <td>${s.seatNumber}</td>
      <td>${s.active?"✅ مفعل":"❌ غير مفعل"}</td>
    `;
    studentsList.appendChild(tr);
  });
}

// 👤 معلومات المستخدم
onAuthStateChanged(auth, async (user)=>{
  if(!user) { location.href="index.html"; return; }
  const d = await getDoc(doc(db,"users",user.uid));
  roleBadge.textContent = d.exists()? (d.data().role || "—") : "—";
  loadStudents();
});

// 🚪 تسجيل الخروج
btnSignOut.addEventListener("click", async ()=>{
  await signOut(auth);
  location.href="index.html";
});
