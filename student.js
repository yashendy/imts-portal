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
            if (d.isActive === false) { alert("النتيجة محجوبة"); return; }

            const isFemale = d.gender === "أنثى";
            const isChristian = d.rel_type === "مسيحي";
            const isLang = d.system === "لغات";

            // إظهار صفحة الشهادة
            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // البيانات الشخصية
            const sTitle = isFemale ? "الطالبة" : "الطالب";
            document.getElementById("cert-name").textContent = `${sTitle}/ ${d.name}`;
            document.getElementById("cert-level").textContent = d.level || "غير محدد";
            document.getElementById("cert-system").textContent = d.system || "عربي";
            document.getElementById("cert-id").textContent = id;

            // قائمة المواد
            let subjects = [
                { n: "اللغة العربية", v: d.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
                { n: isLang ? "Science" : "العلوم", v: d.science },
                { n: "الدراسات الاجتماعية", v: d.Social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
            ];

            if (!isChristian) subjects.push({ n: "التربية الدينية", v: d.religion });
            if (isLang && d.highlevel > 0) subjects.push({ n: "High Level", v: d.highlevel });

            // الحسابات وعرض الجدول (منع NaN)
            let totalScore = 0;
            let html = "";
            subjects.forEach(s => {
                const isAbsent = s.v === "غ";[cite: 6]
                const valToDisplay = isAbsent ? "غ" : (Number(s.v) || 0);[cite: 6]
                const evaluation = getEval(s.v);

                if (!isAbsent) totalScore += Number(s.v) || 0;[cite: 6]
                html += `<tr><td>${s.n}</td><td>${valToDisplay}</td><td>${evaluation}</td></tr>`;[cite: 6]
            });

            document.getElementById("grades-body").innerHTML = html;
            const maxScore = subjects.length * 20;
            
            // تحديث سطر المجموع
            const totalScoreEl = document.getElementById("total-score");
            totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalScore}</strong> / ${maxScore}</td><td id="total-eval"></td>`;

            const finalEval = totalScore >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";
            document.getElementById("total-eval").textContent = finalEval;
            
            // البيان الختامي
            const sPassed = isFemale ? "تمت اجتياز" : "تم اجتياز";
            const sObtained = isFemale ? "وحصلت على" : "وحصل على";
            document.getElementById("statement").innerHTML = 
                `${sTitle}/ ${d.name} ${sPassed} الاختبارات بنجاح ${sObtained} تقدير عام: ${finalEval}`;

        } else { alert("رقم الجلوس غير موجود"); }
    } catch (err) { console.error(err); }
});

// زر الإغلاق
document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
});
