import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// 1. حماية الصفحة
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

window.logout = () => signOut(auth);

// 2. البحث السريع عن طالب لتعديله
document.getElementById("fetch-btn").addEventListener("click", async () => {
    const searchId = document.getElementById("quick-search").value.trim();
    if (!searchId) return alert("يرجى إدخال رقم الجلوس");

    const docSnap = await getDoc(doc(db, "students", searchId));
    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById("m-id").value = searchId;
        document.getElementById("m-name").value = d.name;
        document.getElementById("m-level").value = d.level;
        document.getElementById("m-active").value = String(d.isActive !== false);
        
        const fields = ["arabic", "math", "english", "science", "religion", "Social", "technology"];
        fields.forEach(f => document.getElementById(`m-${f}`).value = d[f] || 0);
        alert("تم جلب بيانات الطالب بنجاح");
    } else {
        alert("الطالب غير موجود، يمكنك إضافته كجديد");
    }
});

// 3. حفظ البيانات (يدوي)
document.getElementById("manual-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("m-id").value.trim();
    const data = {
        name: document.getElementById("m-name").value.trim(),
        level: document.getElementById("m-level").value.trim(),
        isActive: document.getElementById("m-active").value === "true",
        arabic: Number(document.getElementById("m-arabic").value),
        math: Number(document.getElementById("m-math").value),
        english: Number(document.getElementById("m-english").value),
        science: Number(document.getElementById("m-science").value),
        religion: Number(document.getElementById("m-religion").value),
        Social: Number(document.getElementById("m-Social").value),
        technology: Number(document.getElementById("m-technology").value),
        system: "عربي"
    };
    await setDoc(doc(db, "students", id), data);
    alert("✅ تم الحفظ بنجاح");
});

// 4. رفع الأكسيل (مبسط)
document.getElementById("excel-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        processExcel(data);
    };
    reader.readAsBinaryString(file);
});

async function processExcel(data) {
    document.getElementById("upload-all-btn").onclick = async () => {
        for (const row of data) {
            const id = String(row["رقم الجلوس"] || row.id);
            await setDoc(doc(db, "students", id), {
                name: row["الاسم"] || row.name,
                level: row["الصف"] || row.level,
                isActive: true,
                arabic: row["عربي"] || 0,
                math: row["رياضيات"] || 0,
                english: row["إنجليزي"] || 0,
                science: row["علوم"] || 0,
                religion: row["دين"] || 0,
                Social: row["دراسات"] || 0,
                technology: row["تكنولوجيا"] || 0,
                system: "عربي"
            });
        }
        alert("✅ تم رفع ملف الأكسيل بالكامل");
    };
    document.getElementById("preview-section").style.display = "block";
}
