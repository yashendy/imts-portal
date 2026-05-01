import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة التقدير: تدعم الدرجات الرقمية وحالة الغياب بالحرف "غ"
function getEval(score) { 
    if (score === "غ") return "—"; 
    const v = Number(score);
    if (isNaN(v)) return "—";
    return v >= 18 ? "ممتاز" : "جيد جداً"; 
}

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

    try {
        const docSnap = await getDoc(doc(db, "students", id));
        if (docSnap.exists()) {
            const d = docSnap.data();
            
            // التحقق من حالة حجب النتيجة
            if (d.isActive === false) {
                alert("النتيجة محجوبة مؤقتاً، يرجى مراجعة الإدارة.");
                return;
            }

            // تحديد المتغيرات الأساسية للطالب
            const isFemale = d.gender === "أنثى";
            const isChristian = d.rel_type === "مسيحي";
            const isLang = d.system === "لغات";

            // إظهار قسم الشهادة وإخفاء البحث
            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // ضبط صيغة النصوص حسب الجنس (ذكر/أنثى)
            const sTitle = isFemale ? "الطالبة" : "الطالب";
            const sPassed = isFemale ? "تمت اجتياز" : "تم اجتياز";
            const sObtained = isFemale ? "وحصلت على" : "وحصل على";

            // تعبئة البيانات الشخصية في الشهادة
            document.getElementById("cert-name").textContent = `${sTitle}/ ${d.name}`;
            document.getElementById("cert-level").textContent = d.level || "غير محدد";
            document.getElementById("cert-system").textContent = d.system || "عربي";
            document.getElementById("cert-id").textContent = id;

            // بناء مصفوفة المواد مع مراعاة اللغات والديانة
            let subjects = [
                { n: "اللغة العربية", v: d.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
                { n: isLang ? "Science" : "العلوم", v: d.science },
                { n: "الدراسات الاجتماعية", v: d.Social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
            ];

            // استبعاد مادة الدين للمسيحيين مؤقتاً
            if (!isChristian) {
                subjects.push({ n: "التربية الدينية", v: d.religion });
            }

            // إضافة مادة المستوى الرفيع لطلاب اللغات فقط
            if (isLang && d.highlevel > 0) {
                subjects.push({ n: "High Level", v: d.highlevel });
            }

            // معالجة الجدول وحساب المجموع الكلي مع دعم الغياب
            let totalScore = 0;
            let html = "";
            subjects.forEach(s => {
                const isAbsent = s.v === "غ";
                const valToDisplay = isAbsent ? "غ" : (Number(s.v) || 0);
                const evaluation = getEval(s.v);

                if (!isAbsent) {
                    totalScore += Number(s.v) || 0;
                }
                html += `<tr><td>${s.n}</td><td>${valToDisplay}</td><td>${evaluation}</td></tr>`;
            });

            document.getElementById("grades-body").innerHTML = html;
            const maxScore = subjects.length * 20;

            // تحديث خلية المجموع الكلي
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalScore}</strong> / ${maxScore}</td><td id="total-eval"></td>`;
            }

            // حساب التقدير العام والبيان الختامي
            const finalEval = totalScore >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";
            document.getElementById("total-eval").textContent = finalEval;
            
            document.getElementById("statement").innerHTML = 
                `${sTitle}/ ${d.name} ${sPassed} الاختبارات الفصلية بنجاح ${sObtained} تقدير عام: ${finalEval}`;

        } else {
            alert("رقم الجلوس غير صحيح أو غير موجود.");
        }
    } catch (err) {
        console.error("خطأ في جلب البيانات:", err);
    }
});

// تفعيل زر الإغلاق والعودة للبحث
const closeBtn = document.getElementById("close-cert-btn");
if (closeBtn) {
    closeBtn.addEventListener("click", () => {
        document.getElementById("certificate-section").style.display = "none";
        document.getElementById("search-section").style.display = "block";
        document.getElementById("student-id-input").value = "";
    });
}
