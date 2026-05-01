import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

window.logout = () => signOut(auth);

// بحث وتعديل
document.getElementById("fetch-btn").addEventListener("click", async () => {
    const id = document.getElementById("quick-search").value.trim();
    const docSnap = await getDoc(doc(db, "students", id));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById("m-id").value = id;
        document.getElementById("m-name").value = d.name;
        document.getElementById("m-level").value = d.level;
        document.getElementById("m-system").value = d.system || "عربي";
        document.getElementById("m-active").value = String(d.isActive !== false);
        document.getElementById("m-highlevel").value = d.highlevel || 0;
        
        const fields = ["arabic", "math", "english", "science", "religion", "Social", "technology"];
        fields.forEach(f => document.getElementById(`m-${f}`).value = d[f] || 0);
        alert("تم جلب البيانات");
    }
});

// حفظ يدوي
document.getElementById("manual-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("m-id").value.trim();
    const data = {
        name: document.getElementById("m-name").value.trim(),
        level: document.getElementById("m-level").value.trim(),
        system: document.getElementById("m-system").value,
        isActive: document.getElementById("m-active").value === "true",
        highlevel: Number(document.getElementById("m-highlevel").value) || 0,
        arabic: Number(document.getElementById("m-arabic").value),
        math: Number(document.getElementById("m-math").value),
        english: Number(document.getElementById("m-english").value),
        science: Number(document.getElementById("m-science").value),
        religion: Number(document.getElementById("m-religion").value),
        Social: Number(document.getElementById("m-Social").value),
        technology: Number(document.getElementById("m-technology").value)
    };
    await setDoc(doc(db, "students", id), data);
    alert("✅ تم الحفظ بنجاح");
});
