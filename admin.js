import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// --- أولاً: منطق الإدخال اليدوي ---
const manualForm = document.getElementById("manual-form");

manualForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // جمع البيانات من النموذج
    const studentId = document.getElementById("m-id").value.trim();
    const studentData = {
        name: document.getElementById("m-name").value.trim(),
        level: document.getElementById("m-level").value.trim(),
        system: "عربي", // قيمة افتراضية أو يمكن إضافتها للنموذج
        arabic: Number(document.getElementById("m-arabic").value) || 0,
        math: Number(document.getElementById("m-math").value) || 0,
        english: Number(document.getElementById("m-english").value) || 0,
        science: Number(document.getElementById("m-science").value) || 0,
        religion: Number(document.getElementById("m-religion").value) || 0,
        Social: Number(document.getElementById("m-Social").value) || 0,
        technology: Number(document.getElementById("m-technology").value) || 0,
        lastUpdated: new Date().toISOString()
    };

    try {
        // الرفع لـ Firebase باستخدام رقم الجلوس كـ ID للمستند
        await setDoc(doc(db, "students", studentId), studentData);
        alert(`✅ تم حفظ بيانات الطالب: ${studentData.name} بنجاح`);
        manualForm.reset();
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("❌ حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.");
    }
});

// --- ثانياً: منطق رفع ملفات الأكسيل ---
const excelInput = document.getElementById("excel-file");
const previewSection = document.getElementById("preview-section");
const previewTable = document.getElementById("preview-table");
const uploadAllBtn = document.getElementById("upload-all-btn");

let excelData = []; // لتخزين البيانات المستخرجة من الملف مؤقتاً

excelInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0]; // قراءة أول ورقة في الملف
        const ws = wb.Sheets[wsname];
        
        // تحويل البيانات لـ JSON
        excelData = XLSX.utils.sheet_to_json(ws);
        
        if (excelData.length > 0) {
            showPreview(excelData);
        }
    };
    reader.readAsBinaryString(file);
});

// دالة لمعاينة البيانات قبل الرفع
function showPreview(data) {
    previewSection.style.display = "block";
    let html = `<tr>
        <th>رقم الجلوس</th>
        <th>الاسم</th>
        <th>عربي</th>
        <th>رياضيات</th>
    </tr>`;
    
    // عرض أول 5 طلاب فقط للمعاينة
    data.slice(0, 5).forEach(row => {
        html += `<tr>
            <td>${row.id || row["رقم الجلوس"]}</td>
            <td>${row.name || row["الاسم"]}</td>
            <td>${row.arabic || row["عربي"]}</td>
            <td>${row.math || row["رياضيات"]}</td>
        </tr>`;
    });
    
    previewTable.innerHTML = html;
}

// الرفع الجماعي عند الضغط على الزر
uploadAllBtn.addEventListener("click", async () => {
    uploadAllBtn.disabled = true;
    uploadAllBtn.textContent = "جاري الرفع... يرجى عدم إغلاق الصفحة";
    
    let successCount = 0;

    for (const row of excelData) {
        const studentId = String(row.id || row["رقم الجلوس"]).trim();
        const studentData = {
            name: row.name || row["الاسم"],
            level: row.level || row["الصف"] || "الرابع الابتدائي",
            system: row.system || "عربي",
            arabic: Number(row.arabic || row["عربي"]) || 0,
            math: Number(row.math || row["رياضيات"]) || 0,
            english: Number(row.english || row["إنجليزي"]) || 0,
            science: Number(row.science || row["علوم"]) || 0,
            religion: Number(row.religion || row["دين"]) || 0,
            Social: Number(row.Social || row["دراسات"]) || 0,
            technology: Number(row.technology || row["تكنولوجيا"]) || 0
        };

        try {
            await setDoc(doc(db, "students", studentId), studentData);
            successCount++;
        } catch (err) {
            console.error(`خطأ في رفع الطالب ${studentId}:`, err);
        }
    }

    alert(`✅ اكتملت العملية! تم رفع ${successCount} سجل بنجاح.`);
    previewSection.style.display = "none";
    uploadAllBtn.disabled = false;
    uploadAllBtn.textContent = "اعتماد ورفع كافة البيانات";
});
