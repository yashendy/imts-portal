import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة التقييم: تدعم الدرجات الرقمية وحالة الغياب
function getEval(score) { 
    if (score === "غ") return "—"; // في حالة الغياب التقدير يكون شرطة[cite: 6]
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
            
            // 1. التحقق من حجب النتيجة
            if (d.isActive === false) {
                alert("النتيجة محجوبة مؤقتاً، يرجى مراجعة إدارة المعهد.");
                return;
            }

            // 2. تحديد المتغيرات الأساسية (الجنس، الديانة، القسم)[cite: 6]
            const isFemale = d.gender === "أنثى";
            const isChristian = d.rel_type === "مسيحي";
            const isLang = d.system === "لغات";

            // ضبط صيغة النصوص حسب الجنس[cite: 6]
            const sTitle = isFemale ? "الطالبة" : "الطالب";
            const sPassed = isFemale ? "تمت اجتياز" : "تم اجتياز";
            const sObtained = isFemale ? "وحصلت على" : "وحصل على";

            // إظهار الشهادة وإخفاء البحث
            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // 3. تعبئة البيانات الجانبية مع التأكد من وجود العناصر لتجنب الخطأ[cite: 4, 6]
            if (document.getElementById("cert-name")) document.getElementById("cert-name").textContent = `${sTitle}/ ${d.name}`;
            if (document.getElementById("cert-level")) document.getElementById("cert-level").textContent = d.level || "غير محدد";
            if (document.getElementById("cert-system")) document.getElementById("cert-system").textContent = d.system || "عربي";
            if (document.getElementById("cert-id")) document.getElementById("cert-id").textContent = id;

            // 4. بناء قائمة المواد الذكية[cite: 6]
            let subjects = [
                { n: "اللغة العربية", v: d.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
                { n: isLang ? "Science" : "العلوم", v: d.science },
                { n: "الدراسات الاجتماعية", v: d.Social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
            ];

            // استبعاد الدين للمسيحيين مؤقتاً[cite: 6]
            if (!isChristian) {
                subjects.push({ n: "التربية الدينية", v: d.religion });
            }

            // إضافة المستوى الرفيع للغات فقط[cite: 6]
            if (isLang && d.highlevel > 0) {
                subjects.push({ n: "High Level", v: d.highlevel });
            }

            // 5. معالجة الدرجات وحساب المجموع (مع دعم "غ")[cite: 6]
            let totalScore = 0;
            let html = "";
            subjects.forEach(s => {
                let displayVal = s.v;
                let evaluation = getEval(s.v);
                
                if (s.v === "غ") {
                    displayVal = "غ"; // عرض حرف غ كما هو[cite: 6]
                } else {
                    totalScore += Number(s.v) || 0; // الجمع فقط إذا كان رقماً[cite: 6]
                }
                
                html += `<tr><td>${s.n}</td><td>${displayVal}</td><td>${evaluation}</td></tr>`;
            });

            const maxScore = subjects.length * 20;
            document.getElementById("grades-body").innerHTML = html;
            
            // 6. عرض المجموع الكلي والتقدير العام[cite: 6]
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalScore}</strong> / ${maxScore}</td><td id="total-eval"></td>`;
            }

            const finalEval = totalScore >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";
            if (document.getElementById("total-eval")) document.getElementById("total-eval").textContent = finalEval;
            if (document.getElementById("cert-total-eval")) document.getElementById("cert-total-eval").textContent = finalEval;
            
            // 7. صياغة البيان الختامي حسب الجنس والتقدير[cite: 6]
            if (document.getElementById("statement")) {
                document.getElementById("statement").innerHTML = 
                    `${sTitle}/ ${d.name} ${sPassed} الاختبارات الفصلية بنجاح ${sObtained} تقدير عام: ${finalEval}`;
            }

        } else {
            alert("رقم الجلوس غير صحيح أو غير موجود.");
        }
    } catch (err) {
        console.error("حدث خطأ أثناء جلب البيانات:", err);
    }
});

// تفعيل زر الإغلاق للعودة لصفحة البحث[cite: 6]
const closeBtn = document.getElementById("close-cert-btn");
if (closeBtn) {
    closeBtn.addEventListener("click", () => {
        document.getElementById("certificate-section").style.display = "none";
        document.getElementById("search-section").style.display = "block";
        document.getElementById("student-id-input").value = "";
        document.body.style.alignItems = "center";
    });
}
