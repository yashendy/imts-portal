import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

window.logout = () => signOut(auth);

// وظيفة ذكية للتعامل مع "غ" أو الأرقام
const formatValue = (val) => {
    const trimmed = String(val).trim();
    if (trimmed === "غ") return "غ";[cite: 6]
    return trimmed === "" || isNaN(trimmed) ? 0 : Number(trimmed);[cite: 6]
};

// بحث واسترجاع البيانات للتعديل
document.getElementById("fetch-btn").addEventListener("click", async () => {
    const id = document.getElementById("quick-search").value.trim();
    const docSnap = await getDoc(doc(db, "students", id));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById("m-id").value = id;
        document.getElementById("m-name").value = d.name;
        document.getElementById("m-level").value = d.level || "";
        document.getElementById("m-system").value = d.system || "عربي";
        document.getElementById("m-gender").value = d.gender || "ذكر";
        document.getElementById("m-religion-type").value = d.rel_type || "مسلم";
        document.getElementById("m-active").value = String(d.isActive !== false);
        document.getElementById("m-highlevel").value = d.highlevel || 0;
        
        const fields = ["arabic", "math", "english", "science", "religion", "Social", "technology"];
        fields.forEach(f => document.getElementById(`m-${f}`).value = d[f]);[cite: 5]
        alert("تم جلب البيانات بنجاح");
    }
});

// حفظ البيانات المحدثة
document.getElementById("manual-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("m-id").value.trim();
    const data = {
        name: document.getElementById("m-name").value.trim(),
        level: document.getElementById("m-level").value.trim(),
        gender: document.getElementById("m-gender").value,
        rel_type: document.getElementById("m-religion-type").value,
        system: document.getElementById("m-system").value,
        isActive: document.getElementById("m-active").value === "true",
        arabic: formatValue(document.getElementById("m-arabic").value),[cite: 6]
        math: formatValue(document.getElementById("m-math").value),[cite: 6]
        english: formatValue(document.getElementById("m-english").value),[cite: 6]
        science: formatValue(document.getElementById("m-science").value),[cite: 6]
        religion: formatValue(document.getElementById("m-religion").value),[cite: 6]
        Social: formatValue(document.getElementById("m-Social").value),[cite: 6]
        technology: formatValue(document.getElementById("m-technology").value),[cite: 6]
        highlevel: formatValue(document.getElementById("m-highlevel").value),[cite: 6]
        lastUpdated: new Date().toISOString()
    };
    await setDoc(doc(db, "students", id), data);
    alert("✅ تم الحفظ بنجاح (رقمياً أو غياب)");
});
