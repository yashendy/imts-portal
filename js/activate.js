// js/activate.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCoZ19SWabidrkmrX8SWy4rFbpWnuYtSSM",
  authDomain: "imts-4b827.firebaseapp.com",
  projectId: "imts-4b827",
  storageBucket: "imts-4b827.firebasestorage.app",
  messagingSenderId: "607673793508",
  appId: "1:607673793508:web:d8dbf01a99ce4b7b8565f1",
  measurementId: "G-3YVBHGWJ9V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = s=>document.querySelector(s);
const msg = $("#msg");
const ok = t=> msg.innerHTML = `<div class="success">${t}</div>`;
const err= t=> msg.innerHTML = `<div class="error">${t}</div>`;

onAuthStateChanged(auth, async (u)=>{
  if(!u){ window.location.href="index.html"; return; }
  $("#btnActivate").addEventListener("click", ()=> activate(u));
});

async function activate(user){
  msg.innerHTML="";
  const code = $("#code").value.trim();
  const role = $("#roleSel").value;
  if(!code) return err("اكتب كود الدعوة.");

  try{
    const ref = doc(db,"invites", code);
    const snap = await getDoc(ref);
    if(!snap.exists()) return err("كود غير صحيح.");
    const inv = snap.data();

    // صلاحية الدعوة
    const notExpired = !inv.expiresAt || (inv.expiresAt.toMillis ? inv.expiresAt.toMillis() : inv.expiresAt.seconds*1000) > Date.now();
    if(!inv.active || !notExpired) return err("الدعوة غير فعّالة أو منتهية.");

    // الدور المتوقع (لو تم اختيار admin/teacher من القائمة)
    if(inv.role !== role) return err("هذا الكود ليس لهذا الدور.");

    // تحديث المستخدم
    await setDoc(doc(db,"users", user.uid), {
      email: user.email, displayName: user.displayName || user.email,
      role: inv.role, status: "active", updatedAt: serverTimestamp()
    }, { merge:true });

    // تعطيل الدعوة بعد الاستخدام
    await updateDoc(ref, { active:false, redeemedBy: user.uid, updatedAt: serverTimestamp() });

    ok("تم التفعيل بنجاح. سيتم تحويلك الآن...");
    setTimeout(()=>{
      if(inv.role==="admin" || inv.role==="owner") window.location.href="admin-dashboard.html";
      else window.location.href="teacher-dashboard.html";
    }, 800);
  }catch(e){ console.error(e); err("فشل التفعيل. جرّب مرة أخرى."); }
}
