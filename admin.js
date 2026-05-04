import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
});

window.logout = () => signOut(auth);

// دالة معالجة المدخلات لتدعم حرف "غ"
const processGrade = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    const trimmed = String(val).trim();
    return trimmed === "غ" ? "غ" : (Number(trimmed) || 0);
};

// دالة ذكية للبحث عن قيمة العمود بناءً على جزء من اسمه
const getCellValue = (row, keywords) => {
    const keys = Object.keys(row);
    // البحث عن مفتاح يحتوي على أي من الكلمات الدليلية
    const foundKey = keys.find(k => keywords.some(word => k.toLowerCase().includes(word.toLowerCase())));
    return foundKey ? row[foundKey] : null;
};

let excelData = [];

// --- 1. معاينة ملف الإكسيل (Preview) ---
document.getElementById("excel-file").addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        document.getElementById("preview-section").style.display = "block";
        const table = document.getElementById("preview-table");
        table.innerHTML = `<tr><th>رقم الجلوس</th><th>الاسم</th><th>الحالة</th></tr>`;
        
        excelData.slice(0, 5).forEach(row => {
            const studentId = getCellValue(row, ["id", "جلوس", "رقم"]);
            const studentName = getCellValue(row, ["name", "اسم"]);
            
            table.innerHTML += `<tr>
                <td>${studentId || "???"}</td>
                <td>${studentName || "???"}</td>
                <td>جاهز للرفع</td>
            </tr>`;
        });
    };
    reader.readAsArrayBuffer(file);
});

// --- 2. اعتماد ورفع البيانات (مطور ليدعم الأعداد الكبيرة) ---
document.getElementById("upload-all-btn").addEventListener("click", async () => {
    if (excelData.length === 0) return;

    // تغيير نص الزر لمنع الضغط المتكرر
    const btn = document.getElementById("upload-all-btn");
    btn.disabled = true;
    btn.innerText = "جاري الرفع، يرجى الانتظار...";

    try {
        // تقسيم البيانات لدفعات كل دفعة 400 طالب لتجنب حد فايربيز الأقصى (500)
        const chunkSize = 400;
        let totalUploaded = 0;

        for (let i = 0; i < excelData.length; i += chunkSize) {
            const chunk = excelData.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((row) => {
                const idVal = getCellValue(row, ["id", "جلوس", "رقم"]);
                if (!idVal) return;
                const id = String(idVal).trim();

                const studentData = {
                    name: String(getCellValue(row, ["name", "اسم"]) || "").trim(),
                    level: String(getCellValue(row, ["level", "الصف"]) || "").trim(),
                    gender: getCellValue(row, ["gender", "النوع", "الجنس"]) || "ذكر",
                    rel_type: getCellValue(row, ["rel_type", "الديانة", "ديانة"]) || "مسلم",
                    system: getCellValue(row, ["system", "النظام", "القسم"]) || "عربي",
                    isActive: String(getCellValue(row, ["isActive", "حالة"]) || "").toLowerCase() !== "false",
                    arabic: processGrade(getCellValue(row, ["arabic", "عربي"])),
                    math: processGrade(getCellValue(row, ["math", "رياضيات"])),
                    english: processGrade(getCellValue(row, ["english", "إنجليزي", "انجليزي"])),
                    science: processGrade(getCellValue(row, ["science", "علوم"])),
                    religion: processGrade(getCellValue(row, ["religion", "دين", "تربية دينية"])),
                    Social: processGrade(getCellValue(row, ["social", "دراسات", "اجتماعية"])),
                    technology: processGrade(getCellValue(row, ["technology", "تكنولوجيا", "حاسب"])),
                    highlevel: processGrade(getCellValue(row, ["highlevel", "رفيعة", "مستوى"])),
                    lastUpdated: new Date().toISOString()
                };

                const ref = doc(db, "students", id);
                batch.set(ref, studentData);
                totalUploaded++;
            });

            // رفع الدفعة الحالية والانتظار حتى تكتمل قبل البدء في الدفعة التالية
            await batch.commit();
        }

        Swal.fire({
            title: 'عملية ناجحة!',
            text: `تم اعتماد ورفع ${totalUploaded} طالب بنجاح!`,
            icon: 'success',
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#1A75BB'
        });
        document.getElementById("preview-section").style.display = "none";
        excelData = []; // تفريغ الذاكرة بعد الرفع
        document.getElementById("excel-file").value = ""; // تفريغ حقل الملف
    } catch (error) {
        console.error("Upload Error:", error);
       Swal.fire({
            title: 'حدث خطأ!',
            text: 'فشل الرفع: تأكد من صحة البيانات أو اتصالك بالإنترنت.',
            icon: 'error',
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#B3393E'
        });
    } finally {
        // إرجاع الزر لحالته الطبيعية سواء نجح الرفع أو فشل
        btn.disabled = false;
        btn.innerText = "اعتماد ورفع البيانات";
    }
});

// --- 3. البحث اليدوي ---
document.getElementById("fetch-btn").addEventListener("click", async () => {
    const id = document.getElementById("quick-search").value.trim();
    if(!id) return;
    
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
        
        // تحديث شكل الواجهة بناءً على بيانات الطالب المستدعاة
        updateFormVisibility();
        
        Swal.fire({
            title: 'تم الاسترجاع بنجاح',
            icon: 'success',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    } else {
        // الـ else مكانها الصحيح هنا لو الطالب مش موجود
        Swal.fire('غير موجود', 'لم يتم العثور على طالب بهذا الرقم', 'warning');
    }
});

// --- 4. الحفظ اليدوي (مع حماية الدرجات) ---
document.getElementById("manual-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // 1. قراءة الدرجات أولاً لاختبارها
    const arabic = processGrade(document.getElementById("m-arabic").value);
    const math = processGrade(document.getElementById("m-math").value);
    const english = processGrade(document.getElementById("m-english").value);
    const science = processGrade(document.getElementById("m-science").value);
    const religion = processGrade(document.getElementById("m-religion").value);
    const social = processGrade(document.getElementById("m-Social").value);
    const technology = processGrade(document.getElementById("m-technology").value);
    const highlevel = processGrade(document.getElementById("m-highlevel").value);

    // 2. التحقق من النهايات العظمى (Validation)
    if (arabic !== "غ" && arabic > 20) return Swal.fire('خطأ في الإدخال', 'درجة العربي لا يمكن أن تتجاوز 20', 'error');
    if (math !== "غ" && math > 15) return Swal.fire('خطأ في الإدخال', 'درجة الرياضيات لا يمكن أن تتجاوز 15', 'error');
    if (english !== "غ" && english > 20) return Swal.fire('خطأ في الإدخال', 'درجة الإنجليزي لا يمكن أن تتجاوز 20', 'error');
    if (science !== "غ" && science > 20) return Swal.fire('خطأ في الإدخال', 'درجة العلوم لا يمكن أن تتجاوز 20', 'error');
    if (religion !== "غ" && religion > 20) return Swal.fire('خطأ في الإدخال', 'درجة التربية الدينية لا يمكن أن تتجاوز 20', 'error');
    if (social !== "غ" && social > 20) return Swal.fire('خطأ في الإدخال', 'درجة الدراسات لا يمكن أن تتجاوز 20', 'error');
    if (technology !== "غ" && technology > 15) return Swal.fire('خطأ في الإدخال', 'درجة التكنولوجيا لا يمكن أن تتجاوز 15', 'error');
    if (highlevel !== "غ" && highlevel > 20) return Swal.fire('خطأ في الإدخال', 'درجة المستوى الرفيع لا يمكن أن تتجاوز 20', 'error');

    // 3. لو الدرجات سليمة، يتم تجهيز البيانات للحفظ
    const id = document.getElementById("m-id").value.trim();
    if (!id) return Swal.fire('تنبيه', 'يرجى إدخال رقم الجلوس أولاً', 'warning');

    const data = {
        name: document.getElementById("m-name").value.trim(),
        level: document.getElementById("m-level").value.trim(),
        gender: document.getElementById("m-gender").value,
        rel_type: document.getElementById("m-religion-type").value,
        system: document.getElementById("m-system").value,
        isActive: document.getElementById("m-active").value === "true",
        arabic: arabic,
        math: math,
        english: english,
        science: science,
        religion: religion,
        Social: social,
        technology: technology,
        highlevel: highlevel,
        lastUpdated: new Date().toISOString()
    };
    
    // 4. الحفظ في فايربيز وإظهار إشعار النجاح
    try {
        await setDoc(doc(db, "students", id), data);
        Swal.fire({
            title: 'تم الحفظ!',
            text: 'تم تسجيل بيانات الطالب بنجاح',
            icon: 'success',
            confirmButtonText: 'استمرار',
            confirmButtonColor: '#27ae60'
        });
    } catch (error) {
        console.error("Save Error:", error);
        Swal.fire('حدث خطأ', 'لم يتم حفظ البيانات، يرجى المحاولة مرة أخرى', 'error');
    }
});

// --- 5. ذكاء واجهة الإدخال اليدوي (Smart Form) ---
const religionSelect = document.getElementById("m-religion-type");
const religionInput = document.getElementById("m-religion");
const systemSelect = document.getElementById("m-system");
const highLevelInput = document.getElementById("m-highlevel");

function updateFormVisibility() {
    // التربية الدينية
    if (religionSelect.value === "مسيحي") {
        religionInput.value = ""; // تفريغ الخانة
        religionInput.disabled = true; // قفل الخانة
        religionInput.parentElement.style.opacity = "0.4"; // بهتان اللون
    } else {
        religionInput.disabled = false;
        religionInput.parentElement.style.opacity = "1";
    }

    // المستوى الرفيع
    if (systemSelect.value === "عربي") {
        highLevelInput.value = "";
        highLevelInput.disabled = true;
        highLevelInput.parentElement.style.opacity = "0.4";
    } else {
        highLevelInput.disabled = false;
        highLevelInput.parentElement.style.opacity = "1";
    }
}

// الاستماع لتغيير القوائم من المستخدم
if(religionSelect) religionSelect.addEventListener("change", updateFormVisibility);
if(systemSelect) systemSelect.addEventListener("change", updateFormVisibility);

// تشغيل الدالة أول ما الصفحة تفتح لضبط الحالة الافتراضية
updateFormVisibility();
