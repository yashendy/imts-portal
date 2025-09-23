import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { 
  getFirestore, doc, getDoc, collection, collectionGroup, getCountFromServer 
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
const toast = $("globalMsg");

// 🔔 Toast
function showToast(msg, type="ok") {
  toast.textContent = msg;
  toast.style.background = type==="err" ? "#7f1d1d" : "#065f46";
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),2000);
}

// ===== KPIs =====
async function loadKPIs() {
  try {
    const [cS, cT, cC] = await Promise.all([
      getCountFromServer(collectionGroup(db, "students")),
      getCountFromServer(collectionGroup(db, "teachers")),
      getCountFromServer(collection(db, "classes")),
    ]);

    $("kpiStudents").textContent = cS.data().count || 0;
    $("kpiTeachers").textContent = cT.data().count || 0;
    $("kpiClasses").textContent = cC.data().count || 0;
  } catch (e) {
    console.warn("⚠️ loadKPIs:", e.message);
    $("kpiStudents").textContent = "—";
    $("kpiTeachers").textContent = "—";
    $("kpiClasses").textContent = "—";
    showToast("⚠️ لا يمكن تحميل مؤشرات الأداء","err");
  }
}

// ===== Auth =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { 
    location.href = "index.html"; 
    return; 
  }

  try {
    const uDoc = await getDoc(doc(db, "users", user.uid));
    if (uDoc.exists()) {
      const data = uDoc.data();
      $("userName").textContent = data.displayName || user.email;
      $("roleBadge").textContent = data.role || "—";
    } else {
      $("userName").textContent = user.email;
      $("roleBadge").textContent = "—";
    }
  } catch (err) {
    console.error("⚠️ User load error:", err);
    $("userName").textContent = user.email;
    $("roleBadge").textContent = "—";
  }

  loadKPIs();
});

// ===== SignOut =====
$("btnSignOut").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});
