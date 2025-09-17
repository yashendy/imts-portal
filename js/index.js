import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// 🔹 إدارة التبويبات
const tabs = document.querySelectorAll(".tab");
const panels = {
  login: document.getElementById("panel-login"),
  register: document.getElementById("panel-register"),
  admin: document.getElementById("panel-admin"),
  results: document.getElementById("panel-results")
};

function activateTab(name) {
  tabs.forEach(tab => {
    const isActive = tab.id === `tab-${name}`;
    tab.classList.toggle("is-active", isActive);
  });

  Object.keys(panels).forEach(key => {
    panels[key].classList.toggle("is-hidden", key !== name);
  });
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const name = tab.id.replace("tab-", "");
    activateTab(name);
  });
});

// 🔹 تسجيل الدخول
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.loginEmail.value.trim();
  const password = loginForm.loginPassword.value.trim();

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if (snap.exists()) {
      const role = snap.data().role;
      if (role === "admin") window.location.href = "admin.html";
      else if (role === "teacher") window.location.href = "teacher.html";
      else loginMsg.textContent = "لا تملك صلاحية الدخول.";
    } else {
      loginMsg.textContent = "الحساب غير مرفق ببيانات.";
    }
  } catch (err) {
    loginMsg.textContent = "خطأ في تسجيل الدخول.";
  }
});

// 🔹 تسجيل كأدمن (pending)
const adminForm = document.getElementById("adminRegisterForm");
const adminMsg = document.getElementById("adminRegisterMsg");

adminForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = adminForm.adminFullName.value.trim();
  const email = adminForm.adminEmail.value.trim();
  const phone = adminForm.adminPhone.value.trim();
  const pass1 = adminForm.adminPassword.value;
  const pass2 = adminForm.adminPassword2.value;

  if (pass1 !== pass2) {
    adminMsg.textContent = "كلمتا المرور غير متطابقتين.";
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass1);
    await updateProfile(cred.user, { displayName: fullName });
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      fullName,
      email,
      phone,
      role: "admin",
      status: "pending",
      isActive: false,
      createdAt: serverTimestamp()
    });
    await signOut(auth);
    adminMsg.textContent = "تم إرسال طلب التسجيل. في انتظار موافقة الإدارة.";
    adminForm.reset();
  } catch (err) {
    adminMsg.textContent = "تعذر التسجيل: " + err.message;
  }
});
