import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

window.logout = () => signOut(auth);

// دالة معالجة المدخلات لتدعم حرف "غ"
const processGrade = (val) => {
    if (val === undefined || val === null) return 0;
    const trimmed = String(val).trim();
    return trimmed === "غ" ? "غ" : (Number(trimmed) || 0);
};

// --- وظيفة رفع ملف الإكسيل ---
document.getElementById("upload-excel")?.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            const batch = writeBatch(db);
            let count = 0;

            json.forEach((row) => {
                // تأكدي أن أسماء الأعمدة في الإكسيل تطابق هذه المفاتيح
                const id = String(row["id"] || row["رقم الجلوس"]).trim();
                if (!id) return;

                const studentData = {
                    name: row["name"] || row["اسم الطالب"],
                    level: row["level"] || row["الصف"],
                    gender: row["gender"] || row["النوع"] || "ذكر",
                    rel_type: row["rel_type"] || row["الديانة"] || "مسلم",
                    system: row["system"] || row["النظام"] || "عربي",
                    isActive: String(row["isActive"]).toLowerCase() !== "false",
                    arabic: processGrade(row["arabic"] || row["اللغة العربية"]),
                    math: processGrade(row["math"] || row["الرياضيات"]),
                    english: processGrade(row["english"] || row["اللغة الإنجليزية"]),
                    science: processGrade(row["science"] || row["العلوم"]),
                    religion: processGrade(row["religion"] || row["التربية الدينية"]),
                    Social: processGrade(row["Social"] || row["الدراسات الاجتماعية"]),
                    technology: processGrade(row["technology"] || row["التكنولوجيا"]),
                    highlevel: processGrade(row["highlevel"] || row["المادة الرفيعة"]),
                    lastUpdated: new Date().toISOString()
                };

                const ref = doc(db, "students", id);
                batch.set(ref, studentData);
                count++;
            });

            await batch.commit();
            alert(`✅ تم رفع ${count} طالب بنجاح!`);
        } catch (error) {
            console.error("Excel Upload Error:", error);
            alert("❌ حدث خطأ أثناء معالجة الملف. تأكد من جودة البيانات.");
        }
    };
    reader.readAsArrayBuffer(file);
});

// --- البحث اليدوي ---
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
        document.getElementById("m-highlevel").value = d.highlevel ?? 0;
        
        const fields = ["arabic", "math", "english", "science", "religion", "Social", "technology"];
        fields.forEach(f => {
            const el = document.getElementById(`m-${f}`);
            if (el) el.value = d[f] ?? 0;
        });
        alert("تم استرجاع البيانات بنجاح");
    }
});

// --- الحفظ اليدوي ---
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
        highlevel: processGrade(document.getElementById("m-highlevel").value),
        arabic: processGrade(document.getElementById("m-arabic").value),
        math: processGrade(document.getElementById("m-math").value),
        english: processGrade(document.getElementById("m-english").value),
        science: processGrade(document.getElementById("m-science").value),
        religion: processGrade(document.getElementById("m-religion").value),
        Social: processGrade(document.getElementById("m-Social").value),
        technology: processGrade(document.getElementById("m-technology").value),
        lastUpdated: new Date().toISOString()
    };
    await setDoc(doc(db, "students", id), data);
    alert("✅ تم حفظ البيانات بنجاح");
});
