import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, writeBatch, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
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

// --- 4. الحفظ اليدوي المطور (تمايز درجات العربي واللغات) ---
document.getElementById("manual-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // 1. إعدادات الدرجات النهائية المتمايزة حسب النظام والصف الدراسي
    const maxGradesConfig = {
        "الرابع": {
            "عربي": { arabic: 20, math: 15, english: 20, science: 20, religion: 20, social: 20, tech: 15, high: 20 },
            "لغات": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 }
        },
        "الخامس": {
            "عربي": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 },
            "لغات": { arabic: 20, math: 25, english: 25, science: 25, religion: 20, social: 20, tech: 20, high: 20 }
        },
        "السادس": {
            "عربي": { arabic: 20, math: 15, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 },
            "لغات": { arabic: 20, math: 20, english: 25, science: 20, religion: 20, social: 20, tech: 20, high: 20 }
        }
    };

    let level = document.getElementById("m-level").value.trim();
    if (level.includes("خامس")) level = "الخامس";
    if (level.includes("رابع")) level = "الرابع";
    if (level.includes("سادس")) level = "السادس";

    const system = document.getElementById("m-system").value; // الحصول على النظام الحالي (عربي/لغات)
    
    // اختيار مصفوفة الدرجات بناءً على الصف والنظام
    const currentMax = maxGradesConfig[level] ? maxGradesConfig[level][system] : maxGradesConfig["الرابع"]["عربي"];

    const inputGrades = {
        "اللغة العربية": { val: processGrade(document.getElementById("m-arabic").value), max: currentMax.arabic },
        "الرياضيات": { val: processGrade(document.getElementById("m-math").value), max: currentMax.math },
        "اللغة الإنجليزية": { val: processGrade(document.getElementById("m-english").value), max: currentMax.english },
        "العلوم": { val: processGrade(document.getElementById("m-science").value), max: currentMax.science },
        "التربية الدينية": { val: processGrade(document.getElementById("m-religion").value), max: currentMax.religion },
        "الدراسات الاجتماعية": { val: processGrade(document.getElementById("m-Social").value), max: currentMax.social },
        "تكنولوجيا المعلومات": { val: processGrade(document.getElementById("m-technology").value), max: currentMax.tech },
        "المستوى الرفيع": { val: processGrade(document.getElementById("m-highlevel").value), max: currentMax.high }
    };

    for (const [subjectName, data] of Object.entries(inputGrades)) {
        if (data.val !== "غ" && data.val > data.max) {
            return Swal.fire({
                title: 'خطأ في الدرجة',
                text: `درجة ${subjectName} لنظام ${system} (صف ${level}) لا تتجاوز ${data.max}`,
                icon: 'error',
                confirmButtonColor: '#B3393E'
            });
        }
    }
    // ... بقية كود الحفظ (setDoc) كما هو ...
});

    // 4. الحفظ في قاعدة البيانات
    const id = document.getElementById("m-id").value.trim();
    const studentData = {
        name: document.getElementById("m-name").value.trim(),
        level: level,
        gender: document.getElementById("m-gender").value,
        rel_type: document.getElementById("m-religion-type").value,
        system: document.getElementById("m-system").value,
        isActive: document.getElementById("m-active").value === "true",
        arabic: inputGrades["اللغة العربية"].val,
        math: inputGrades["الرياضيات"].val,
        english: inputGrades["اللغة الإنجليزية"].val,
        science: inputGrades["العلوم"].val,
        religion: inputGrades["التربية الدينية"].val,
        Social: inputGrades["الدراسات الاجتماعية"].val,
        technology: inputGrades["تكنولوجيا المعلومات"].val,
        highlevel: inputGrades["المستوى الرفيع"].val,
        lastUpdated: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "students", id), studentData);
        Swal.fire({
            title: 'تم الحفظ بنجاح!',
            icon: 'success',
            confirmButtonColor: '#1A75BB'
        });
    } catch (error) {
        Swal.fire('حدث خطأ', 'تعذر حفظ البيانات', 'error');
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

// --- 6. تصدير البيانات إلى ملف إكسيل (فلترة ذكية حسب الصف) ---
const exportBtn = document.getElementById("export-btn");
if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
        const selectedLevel = document.getElementById("export-level-select").value;
        
        try {
            Swal.fire({
                title: 'جاري التحضير...',
                text: selectedLevel === "الكل" ? "يتم الآن جمع بيانات جميع الطلاب" : `يتم الآن جمع بيانات طلاب الصف ${selectedLevel}`,
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const querySnapshot = await getDocs(collection(db, "students"));
            let studentsData = [];

            querySnapshot.forEach((doc) => {
                const d = doc.data();
                
                // التحقق من مطابقة الصف المختار (فلترة ذكية لضمان تخطي المسافات أو الفوارق البسيطة)[cite: 2, 3]
                const studentLevel = String(d.level || "").trim();
                if (selectedLevel === "الكل" || studentLevel.includes(selectedLevel)) {
                    studentsData.push({
                        "رقم الجلوس": doc.id,
                        "اسم الطالب": d.name || "",
                        "النوع": d.gender || "",
                        "الديانة": d.rel_type || "",
                        "الصف": d.level || "",
                        "القسم": d.system || "",
                        "عربي": d.arabic ?? "",
                        "رياضيات": d.math ?? "",
                        "إنجليزي": d.english ?? "",
                        "علوم": d.science ?? "",
                        "دراسات": d.Social ?? "",
                        "دين": d.religion ?? "",
                        "تكنولوجيا": d.technology ?? "",
                        "مستوى رفيع": d.highlevel ?? "",
                        "حالة النتيجة": d.isActive !== false ? "فعال" : "محجوب"
                    });
                }
            });

            if (studentsData.length === 0) {
                return Swal.fire('لا توجد بيانات', `لا يوجد طلاب مسجلين في ${selectedLevel}`, 'info');
            }

            const worksheet = XLSX.utils.json_to_sheet(studentsData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");
            
            const timeStamp = new Date().toLocaleDateString('ar-EG').replace(/\//g, '-');
            const fileName = selectedLevel === "الكل" ? `Full_Backup_${timeStamp}.xlsx` : `Grade_${selectedLevel}_${timeStamp}.xlsx`;
            
            XLSX.writeFile(workbook, fileName);

            Swal.fire({
                title: 'تم التصدير بنجاح!',
                text: `تم استخراج بيانات ${studentsData.length} طالب بنجاح.`,
                icon: 'success',
                confirmButtonColor: '#27ae60'
            });

        } catch (error) {
            console.error("Export Error:", error);
            Swal.fire('خطأ', 'حدث خطأ تقني أثناء التصدير', 'error');
        }
    });
}

// --- 7. حذف الطالب ---
const deleteBtn = document.getElementById("delete-btn");
if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
        const id = document.getElementById("m-id").value.trim();
        
        if (!id) {
            return Swal.fire('تنبيه', 'يرجى إدخال رقم الجلوس أو البحث عن الطالب أولاً', 'warning');
        }

        // رسالة تأكيد قبل الحذف لمنع الحذف بالخطأ
        const result = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: `هل تريد فعلاً حذف بيانات الطالب صاحب رقم الجلوس: ${id}؟ لا يمكن التراجع عن هذا الإجراء!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            cancelButtonColor: '#95a5a6',
            confirmButtonText: 'نعم، احذف الطالب',
            cancelButtonText: 'إلغاء'
        });

        if (result.isConfirmed) {
            try {
                // تنفيذ الحذف من قاعدة البيانات
                await deleteDoc(doc(db, "students", id));
                
                // تفريغ النموذج بعد الحذف
                document.getElementById("manual-form").reset();
                updateFormVisibility(); // لإعادة ضبط الواجهة وقفل الخانات لو لزم الأمر
                
                Swal.fire(
                    'تم الحذف!',
                    'تم مسح بيانات الطالب من النظام نهائياً.',
                    'success'
                );
            } catch (error) {
                console.error("Delete Error:", error);
                Swal.fire('خطأ', 'حدث خطأ أثناء الحذف، يرجى المحاولة مرة أخرى', 'error');
            }
        }
    });
}
