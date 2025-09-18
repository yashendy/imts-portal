// auth.js
import { app, auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, getDocs, query, collection, where, limit
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ========== Helpers ========== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const byId = id => document.getElementById(id);

function setActive(tabName){
  $$(".tab").forEach(b=>{
    const on = b.dataset.tab === tabName;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  $$(".panel").forEach(p=>{
    p.classList.toggle("active", p.id === `panel-${tabName}`);
  });
}

// تنسيق تقدير لعرض النتائج
function gradeBadge(total){
  if(total == null) return "—";
  const t = Number(total);
  if (t >= 90) return "امتياز";
  if (t >= 80) return "جيد جدًا";
  if (t >= 70) return "جيد";
  if (t === 0) return "غياب";
  return "يحتاج دعم";
}

// تحققات
const KUWAIT_CIVIL = /^\d{12}$/;
const E164 = /^\+?[1-9]\d{7,14}$/;
const MIN_AGE = 21; // العمر الأدنى (قابل للتعديل)

function yearsBetween(d1, d2){
  const diff = d2.getTime() - d1.getTime();
  const y = diff / (365.25 * 24 * 3600 * 1000);
  return Math.floor(y);
}

function parseMultiSelect(sel){
  return [...sel.selectedOptions].map(o=>o.value);
}

function linesToArray(textarea){
  return textarea.value.trim()
    ? textarea.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
    : [];
}

/* ========== Tabs ========== */
$$(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>setActive(btn.dataset.tab));
});

/* ========== Login ========== */
$("#form-login").addEventListener("submit", async (e)=>{
  e.preventDefault();
  $("#loginError").hidden = true;
  $("#btnLogin").disabled = true;

  const email = byId("loginEmail").value.trim();
  const password = byId("loginPassword").value;

  try{
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // اقرأ ملف المستخدم لتحديد الدور/الحالة
    const uref = doc(db, "users", uid);
    const usnap = await getDoc(uref);
    let role = null, status = null;
    if (usnap.exists()){
      const u = usnap.data();
      role = u.role; status = u.status;
    }

    if (role === "admin"){
      location.href = "admin.html";
    } else if (role === "teacher"){
      if (status === "approved"){
        location.href = "teacher.html";
      } else {
        $("#loginInfo").textContent = "تم تسجيل الدخول. طلبك كمعلّم قيد المراجعة.";
      }
    } else {
      // وليّ أمر/طالب: وجّهه لصفحة النتائج العامة
      $("#loginInfo").textContent = "تم تسجيل الدخول. يمكنك متابعة النتائج من التبويب المخصص.";
      setActive("results");
    }
  }catch(err){
    $("#loginError").textContent = err.message;
    $("#loginError").hidden = false;
  }finally{
    $("#btnLogin").disabled = false;
  }
});

/* ========== Parent/Student Results ========== */
$("#form-results").addEventListener("submit", async (e)=>{
  e.preventDefault();
  $("#resError").hidden = true;

  const seat = byId("seatNumber").value.trim();
  const yearId = byId("yearId").value.trim();
  const dob = byId("dobCheck").value ? new Date(byId("dobCheck").value) : null;

  try{
    // نفترض أن النتائج مخزّنة في مجموعة عليا studentResults
    // بمفاتيح (yearId + seatNumber). عدّلي إن كنتِ تستخدمين بنية مختلفة.
    const qRef = query(
      collection(db, "studentResults"),
      where("yearId", "==", yearId),
      where("seatNumber", "==", seat),
      limit(1)
    );
    const snap = await getDocs(qRef);
    if (snap.empty) throw new Error("لا توجد بيانات مطابقة.");

    const data = snap.docs[0].data();

    // تحقق خفيف: لو المستخدم أدخل DOB نقارنه إن كان متوفرًا في الوثيقة
    if (dob && data.dob){
      const d = new Date(data.dob);
      if (d.toDateString() !== dob.toDateString()){
        throw new Error("بيانات التحقق لا تطابق سجلاتنا.");
      }
    }

    $("#resultCard").hidden = false;
    byId("rName").textContent = data.name ?? "—";
    byId("rClass").textContent = data.className ?? "—";
    byId("rTotal").textContent = data.total ?? "—";
    byId("rGrade").textContent = gradeBadge(data.total);
    byId("rNotes").textContent = data.notes ?? "—";

    // توليد PDF بسيط (placeholder): يمكنك استبداله بمكتبة مثل jsPDF
    $("#btnPDF").onclick = ()=>{
      const w = window.open("", "_blank");
      w.document.write(`<pre style="font-family:Tahoma">${JSON.stringify(data, null, 2)}</pre>`);
      w.document.close();
      w.focus();
    };
  }catch(err){
    $("#resultCard").hidden = true;
    $("#resError").textContent = err.message;
    $("#resError").hidden = false;
  }
});

/* ========== Teacher Apply ========== */
$("#form-apply").addEventListener("submit", async (e)=>{
  e.preventDefault();
  $("#applyError").hidden = true; $("#applyInfo").hidden = true;
  $("#btnApply").disabled = true;

  try{
    // جمع الحقول
    const fullName = byId("fullName").value.trim();
    const dob = new Date(byId("dob").value);
    const civilId = byId("civilId").value.trim();
    const gender = byId("gender").value;
    const nationality = byId("nationality").value.trim();
    const maritalStatus = byId("maritalStatus").value.trim();
    const address = byId("address").value.trim();
    const phone = byId("phone").value.trim();
    const whatsapp = byId("whatsapp").value.trim();
    const email = byId("email").value.trim();
    const password = byId("password").value;

    const degree = byId("degree").value;
    const major = byId("major").value.trim();
    const experienceYears = parseInt(byId("experienceYears").value || "0", 10);
    const courses = linesToArray(byId("courses"));
    const subjects = byId("subjects").value.split(",").map(s=>s.trim()).filter(Boolean);
    const preferredStages = parseMultiSelect(byId("preferredStages"));
    const langs = parseMultiSelect(byId("langs"));
    const bio = byId("bio").value.trim();

    const employeeNo = byId("employeeNo").value.trim() || null;
    const availFrom = byId("availFrom").value;
    const availTo = byId("availTo").value;
    const availDays = parseMultiSelect(byId("availDays"));

    const notifyEmail = byId("nEmail").checked;
    const notifyPush  = byId("nPush").checked;
    const notifyWhats = byId("nWhats").checked;
    const notifyFreq  = byId("nFreq").value;

    // تحققات
    if (!KUWAIT_CIVIL.test(civilId)) throw new Error("الرقم المدني يجب أن يكون 12 رقمًا.");
    if (!E164.test(phone)) throw new Error("برجاء إدخال هاتف دولي بصيغة صحيحة (E.164).");
    if (whatsapp && !E164.test(whatsapp)) throw new Error("رقم واتساب غير صحيح.");
    const age = yearsBetween(dob, new Date());
    if (isNaN(age) || age < MIN_AGE) throw new Error(`الحد الأدنى للعمر ${MIN_AGE} سنة.`);

    // منع تكرار الرقم المدني: فحص سريع
    const dupQ = query(collection(db, "users"), where("civilId", "==", civilId), limit(1));
    const dup = await getDocs(dupQ);
    if (!dup.empty) throw new Error("الرقم المدني مستخدم مسبقًا.");

    // إنشاء حساب auth ثم حفظ ملف المستخدم بحالة pending ودور teacher
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const profile = {
      // شخصية
      fullName, dob: dob.toISOString().slice(0,10), civilId, gender, nationality,
      maritalStatus: maritalStatus || null, address, phone, whatsapp: whatsapp || phone,
      email,
      // مهنية/تعليمية
      degree, major, experienceYears, courses, subjects, preferredStages, langs, bio,
      // وظيفية داخل المنصة
      role: "teacher", status: "pending", employeeNo,
      availability: { days: availDays, from: availFrom, to: availTo },
      notifications: { email: notifyEmail, push: notifyPush, whatsapp: notifyWhats, frequency: notifyFreq },
      createdAt: (new Date()).toISOString(),
    };

    await setDoc(doc(db, "users", uid), profile, { merge: true });
    await setDoc(doc(db, "usersPending", uid), { ...profile }, { merge: true });

    // لتفادي أي صلاحيات غير مرغوبة قبل الموافقة، نخرج المستخدم
    await signOut(auth);

    $("#applyInfo").textContent = "تم استلام طلبك كمعلّم. سيتم مراجعته من قِبل الإدارة.";
    $("#applyInfo").hidden = false;

    // تنظيف النموذج
    e.target.reset();
  }catch(err){
    $("#applyError").textContent = err.message;
    $("#applyError").hidden = false;
  }finally{
    $("#btnApply").disabled = false;
  }
});
