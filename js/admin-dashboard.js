import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, collectionGroup, getCountFromServer, getDocs, query, limit, where,
  runTransaction, increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ===== Firebase ===== */
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
const db   = getFirestore(app);

const $ = (id)=>document.getElementById(id);
const toast = $("globalMsg");
const roleBadge = $("roleBadge");
const userName  = $("userName");
const yearSelect= $("yearSelect");

function showToast(msg, type="ok"){
  toast.textContent = msg;
  toast.style.background = type==="err" ? "#7f1d1d" : (type==="warn" ? "#92400e" : "#065f46");
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 2200);
}

/* ===== Helpers ===== */
async function ensureUserDoc(user){
  const uRef = doc(db, "users", user.uid);
  const snap = await getDoc(uRef);
  if (!snap.exists()) {
    await setDoc(uRef, {
      displayName: user.displayName || (user.email?.split("@")[0] ?? "مدير النظام"),
      role: "owner",
      status: "active",
      email: user.email || null,
      createdAt: serverTimestamp()
    });
  } else if (!snap.data().status) {
    await updateDoc(uRef, { status: "active" });
  }
  const u = (await getDoc(uRef)).data();
  userName.textContent = u.displayName || user.email || "مدير النظام";
  roleBadge.textContent = u.role || "—";
  return u;
}

/* ===== seeding (يعمل مرة واحدة فقط عند الفاضي) ===== */
async function ensureSeedData(currentUser){
  // 1) academicYears — إضافة 2025-2026 لو مش موجودة
  try{
    const yrQ = query(collection(db, "academicYears"), where("name","==","2025-2026"), limit(1));
    const yrS = await getDocs(yrQ);
    if (yrS.empty) {
      await setDoc(doc(collection(db,"academicYears")), { name:"2025-2026", current:true, createdAt: serverTimestamp() });
    }
  }catch(e){ /* ignore */ }

  // 2) classes — لو مفيش أي فصل، نضيف G10A
  const clsQ = query(collection(db,"classes"), limit(1));
  const clsS = await getDocs(clsQ);
  if (clsS.empty){
    const classRef = doc(collection(db,"classes"));
    await setDoc(classRef, {
      name: "G10A",
      grade: "G10",
      capacity: 30,
      enrolled: 0,
      createdAt: serverTimestamp()
    });

    // أ) أضف المعلّم الحالي كمعلم للفصل
    await setDoc(doc(collection(classRef, "teachers"), currentUser.uid), {
      role: "homeroom",
      userId: currentUser.uid,
      addedAt: serverTimestamp()
    });

    // ب) إعداد عدّاد أرقام الجلوس
    const counterRef = doc(db, "counters", "seatNumbers");
    await runTransaction(db, async (trx)=>{
      const cSnap = await trx.get(counterRef);
      if (!cSnap.exists()) trx.set(counterRef, { value: 0 });
    });

    // ج) أضف طالبين تجريبيين (students كـ subcollection تحت الفصل)
    async function nextSeatNumber(){
      const counterRef = doc(db, "counters", "seatNumbers");
      let newNumber = 1;
      await runTransaction(db, async (trx)=>{
        const s = await trx.get(counterRef);
        const current = s.exists() ? (s.data().value || 0) : 0;
        newNumber = current + 1;
        if (!s.exists()) trx.set(counterRef, { value: 1 });
        else trx.update(counterRef, { value: increment(1) });
      });
      return newNumber;
    }

    const s1 = {
      name:"أحمد محمد", grade:"G10", gender:"M", religion:"muslim", active:true,
      studentCode:"G10-001", seatNumber: await nextSeatNumber(),
      createdAt: serverTimestamp()
    };
    const s2 = {
      name:"مريم عادل", grade:"G10", gender:"F", religion:"christian", active:true,
      studentCode:"G10-002", seatNumber: await nextSeatNumber(),
      createdAt: serverTimestamp()
    };
    await setDoc(doc(collection(classRef, "students")), s1);
    await setDoc(doc(collection(classRef, "students")), s2);

    // حدث enrolled
    await updateDoc(classRef, { enrolled: 2 });
  }

  // 3) activities — حدث بسيط
  try{
    await setDoc(doc(collection(db,"activities")), {
      who: currentUser.email || "owner",
      what: "تهيئة بيانات الداشبورد",
      createdAt: serverTimestamp()
    });
  }catch(e){ /* ignore */ }
}

/* ===== KPIs ===== */
async function loadKPIs(){
  try{
    const [cS, cT, cC] = await Promise.all([
      getCountFromServer(collectionGroup(db, "students")),
      getCountFromServer(collectionGroup(db, "teachers")),
      getCountFromServer(collection(db, "classes")),
    ]);
    $("kpiStudents").textContent = cS.data().count ?? 0;
    $("kpiTeachers").textContent = cT.data().count ?? 0;
    $("kpiClasses").textContent  = cC.data().count ?? 0;

    // تنبيهات بسيطة: فصول فوق السعة
    const alerts = [];
    // نحسبها من enrolled > capacity
    const cls = await getDocs(collection(db,"classes"));
    cls.forEach(d=>{
      const c = d.data();
      if ((c.enrolled ?? 0) > (c.capacity ?? 0)) {
        alerts.push(`فصل "${c.name}" فوق السعة (${c.enrolled}/${c.capacity})`);
      }
    });
    $("kpiAlerts").textContent = alerts.length;
    const list = $("alertsList");
    list.innerHTML = "";
    if (!alerts.length) {
      list.innerHTML = `<li><span>لا توجد تنبيهات الآن ✅</span></li>`;
    } else {
      alerts.slice(0,5).forEach(t=>{
        const li = document.createElement("li");
        const span = document.createElement("span"); span.textContent = t;
        const a = document.createElement("a"); a.href="classes.html"; a.className="alert-cta"; a.textContent="عرض";
        li.appendChild(span); li.appendChild(a);
        list.appendChild(li);
      });
    }

    // ملخص ذكي
    const parts = [];
    if (alerts.length) parts.push(`${alerts.length} فصل فوق السعة`);
    $("aiSummary").textContent = parts.length ? `اليوم: ${parts.join(" — ")}.` : "لا توجد مؤشرات غير طبيعية الآن ✅";

    // نشاطات (آخر 10)
    const acts = await getDocs(query(collection(db,"activities"), limit(10)));
    const ul = $("activityList");
    ul.innerHTML = "";
    if (acts.empty) {
      ul.innerHTML = `<li>لا توجد نشاطات بعد.</li>`;
    } else {
      acts.forEach(a=>{
        const d=a.data(); const li=document.createElement("li");
        li.textContent = `${d.who || "مستخدم"} — ${d.what || "عملية"} — ${new Date().toLocaleString("ar-EG")}`;
        ul.appendChild(li);
      });
    }

  }catch(e){
    console.warn("KPIs:", e.message);
    $("kpiStudents").textContent = "—";
    $("kpiTeachers").textContent = "—";
    $("kpiClasses").textContent  = "—";
    $("alertsList").innerHTML = `<li><span>لا توجد تنبيهات الآن ✅</span></li>`;
    $("aiSummary").textContent = "عرض محدود — تعذر تحميل بعض البيانات.";
  }
}

/* ===== Auth ===== */
onAuthStateChanged(auth, async (user)=>{
  if(!user){
    // مش مسجل → صفحة الدخول مرة واحدة فقط
    location.href = "index.html";
    return;
  }

  try{
    // أنشئ/أكمّل مستند المستخدم واعرض الاسم/الدور
    const u = await ensureUserDoc(user);

    // حمّل/أضف العام الأكاديمي + فصل/طلاب/معلم تجريبيين مرة واحدة لو فاضي
    await ensureSeedData(user);

    // عيّن العام الأكاديمي الافتراضي (لو اتضاف)
    try{
      yearSelect.value = "2025-2026";
    }catch(e){/* ignore */}

    // حمل KPIs والتنبيهات والنشاطات
    await loadKPIs();

  }catch(err){
    console.error("User init:", err);
    // ما نعملش signOut — نخلي الصفحة تشتغل بأقل الإمكانيات
    userName.textContent = user.email || "مستخدم";
    roleBadge.textContent = "—";
    await loadKPIs();
  }
});

/* ===== SignOut ===== */
$("btnSignOut").addEventListener("click", async ()=>{
  try{ await signOut(auth); }finally{ location.href = "index.html"; }
});
