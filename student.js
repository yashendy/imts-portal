import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة التقدير: تدعم الغياب بوضع شرطة
function getEval(score) { 
    if (score === "غ") return "—";[cite: 6]
    const v = Number(score);
    if (isNaN(v)) return "—";[cite: 6]
    return v >= 18 ? "ممتاز" : "جيد جداً"; 
}

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

    try {
        const docSnap = await getDoc(doc(db, "students", id));
        if (docSnap.exists()) {
            const d = docSnap.data();
            
            // التحقق من حجب النتيجة
            if (d.isActive === false) { 
                alert("النتيجة محجوبة مؤقتاً"); 
                return; 
            }

            const isFemale = d.gender === "أنثى";[cite: 6]
            const isChristian = d.rel_type === "مسيحي";[cite: 6]
            const isLang = d.system === "لغات";[cite: 6]

            // إظهار صفحة الشهادة وإخفاء البحث[cite: 6]
            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // تحديد صياغة النصوص[cite: 6]
            const sTitle = isFemale ? "الطالبة" : "الطالب";[cite: 6]
            document.getElementById("cert-name").textContent = `${sTitle}/ ${d.name}`;
            document.getElementById("cert-level").textContent = d.level || "غير محدد";
            document.getElementById("cert-system").textContent = d.system || "عربي";
            document.getElementById("cert-id").textContent = id;

            // قائمة المواد[cite: 6]
            let subjects = [
                { n: "اللغة العربية", v: d.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
                { n: isLang ? "Science" : "العلوم", v: d.science },
                { n: "الدراسات الاجتماعية", v: d.Social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
            ];

            if (!isChristian) subjects.push({ n: "التربية الدينية", v: d.religion });[cite: 6]
            if (isLang && d.highlevel > 0) subjects.push({ n: "High Level", v: d.highlevel });[cite: 6]

            // الحسابات وعرض الجدول[cite: 6]
            let totalScore = 0;
            let html = "";
            subjects.forEach(s => {
                const isAbsent = s.v === "غ";[cite: 6]
                const valToDisplay = isAbsent ? "غ" : (Number(s.v) || 0);[cite: 6]
                const evaluation = getEval(s.v);[cite: 6]

                if (!isAbsent) totalScore += Number(s.v) || 0;[cite: 6]
                html += `<tr><td>${s.n}</td><td>${valToDisplay}</td><td>${evaluation}</td></tr>`;[cite: 6]
            });

            document.getElementById("grades-body").innerHTML = html;
            const maxScore = subjects.length * 20;[cite: 6]
            
            // تحديث سطر المجموع[cite: 6]
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalScore}</strong> / ${maxScore}</td><td id="total-eval"></td>`;
            }

            const finalEval = totalScore >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";[cite: 6]
            if (document.getElementById("total-eval")) document.getElementById("total-eval").textContent = finalEval;
            
            // البيان الختامي[cite: 6]
            const sPassed = isFemale ? "تمت اجتياز" : "تم اجتياز";[cite: 6]
            const sObtained = isFemale ? "وحصلت على" : "وحصل على";[cite: 6]
            document.getElementById("statement").innerHTML = 
                `${sTitle}/ ${d.name} ${sPassed} الاختبارات بنجاح ${sObtained} تقدير عام: ${finalEval}`;

        } else { 
            alert("رقم الجلوس غير موجود"); 
        }
    } catch (err) { 
        console.error("حدث خطأ:", err); 
    }
});

// تفعيل زر الإغلاق[cite: 6]
document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
});
