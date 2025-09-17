// js/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, collection, addDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// === Firebase Config ===
const firebaseConfig = {
  apiKey: "AIzaSyAk3r0OSq3NwvBjHpsNlGYb-dJWUmA9Azc",
  authDomain: "imts-portal.firebaseapp.com",
  projectId: "imts-portal",
  storageBucket: "imts-portal.firebasestorage.app",
  messagingSenderId: "819773792022",
  appId: "1:819773792022:web:58d92078d752959b5dba37",
  measurementId: "G-P9JK5KMDWL"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// === Tabs ===
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// === نتائج الطلاب: فتح صفحة الطالب ===
document.getElementById('goStudent').addEventListener('click', ()=>{
  const seat = document.getElementById('seatInput').value.trim();
  if(!seat){ alert('من فضلك أدخل رقم الجلوس'); return; }
  // نفتح صفحة student.html مع رقم الجلوس
  location.href = `./student.html?seat=${encodeURIComponent(seat)}`;
});

// === تسجيل معلّم ===
document.getElementById('t-register').addEventListener('click', async ()=>{
  const name = document.getElementById('t-name').value.trim();
  const email= document.getElementById('t-email').value.trim();
  const pass = document.getElementById('t-pass').value;
  const major= document.getElementById('t-major').value.trim();
  const st = document.getElementById('t-status');

  if(!name || !email || pass.length<6){ st.textContent='تحقق من البيانات (كلمة المرور ≥ 6)'; return; }

  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    await addDoc(collection(db,'usersPending'),{
      uid: cred.user.uid,
      name, email, role:'teacher', major,
      createdAt: Date.now(), status:'pending'
    });

    st.textContent = 'تم استلام طلبك وسيتم التفعيل بواسطة الأدمن.';
  }catch(err){
    console.error(err);
    st.textContent = 'حدث خطأ أثناء التسجيل.';
  }
});

// === تسجيل أدمن (طلب إنشاء) ===
document.getElementById('a-register').addEventListener('click', async ()=>{
  const name = document.getElementById('a-name').value.trim();
  const email= document.getElementById('a-email').value.trim();
  const pass = document.getElementById('a-pass').value;
  const code = document.getElementById('a-code').value.trim();
  const st = document.getElementById('a-status');

  if(!name || !email || pass.length<6 || !code){ st.textContent='أكمل البيانات.'; return; }

  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    await addDoc(collection(db,'usersPending'),{
      uid: cred.user.uid,
      name, email, role:'admin', verifyCode: code,
      createdAt: Date.now(), status:'pending'
    });

    st.textContent = 'تم استلام طلب الأدمن وبانتظار التفعيل.';
  }catch(err){
    console.error(err);
    st.textContent = 'حدث خطأ أثناء التسجيل.';
  }
});

// === دخول ===
document.getElementById('l-login').addEventListener('click', async ()=>{
  const email= document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-pass').value;
  const st = document.getElementById('l-status');

  if(!email || !pass){ st.textContent='أدخل البريد وكلمة المرور'; return; }

  try{
    const cred = await signInWithEmailAndPassword(auth,email,pass);
    // إحضار الدور من users/{uid} لاحقاً (عند تفعيل الأدمن ينقلوه من usersPending إلى users)
    // هنا Placeholder: توجيه عام
    st.textContent = 'تم الدخول. (ضع توجيه الدور هنا)';
    // مثال:
    // const udoc = await getDoc(doc(db,'users', cred.user.uid));
    // if(udoc.exists()){
    //   const role = udoc.data().role;
    //   if(role==='admin') location.href='./admin.html';
    //   else if(role==='teacher') location.href='./teacher.html';
    //   else location.href='./dashboard.html';
    // }else{
    //   st.textContent='حسابك قيد المراجعة.';
    // }
  }catch(err){
    console.error(err);
    st.textContent = 'فشل الدخول. تحقق من البيانات.';
  }
});
