import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة التقييم بناءً على النسبة المئوية
function getEval(score, maxForThisSubject) {
    if (score === "غ") return "غائب";
    if (isNaN(score) || score === null || score === "" || score === undefined) return "ـ"; 

    const s = Number(score);
    const percentage = (s / maxForThisSubject) * 100;

    if (percentage >= 85) return "ممتاز";
    if (percentage >= 75) return "جيد جداً";
    if (percentage >= 65) return "جيد";
    return "مقبول"; 
}

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

    try {
        const docSnap = await getDoc(doc(db, "students", id));
        if (docSnap.exists()) {
            const d = docSnap.data();
            
            if (d.isActive === false) {
                alert("النتيجة محجوبة مؤقتاً");
                return;
            }

            // --- 1. إعدادات الدرجات النهائية الثابتة ---
            const maxGradesConfig = {
                "الرابع": { arabic: 20, math: 15, english: 20, science: 20, religion: 20, social: 20, tech: 15, high: 20 },
                "الخامس": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 },
                "السادس": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 }
            };

            // تنظيف نص الصف لضمان المطابقة (مثلاً "خامس" تصبح "الخامس" إذا لزم الأمر)
            let levelKey = String(d.level || "").trim();
            if (levelKey === "خامس") levelKey = "الخامس";
            if (levelKey === "رابع") levelKey = "الرابع";
            if (levelKey === "سادس") levelKey = "السادس";

            const currentMax = maxGradesConfig[levelKey] || maxGradesConfig["الرابع"];
            const isLang = d.system === "لغات";

            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // تحديث البيانات الأساسية
            document.getElementById("cert-name").textContent = d.name;
            document.getElementById("cert-level").textContent = d.level;
            document.getElementById("cert-system").textContent = d.system || "عربي";
            document.getElementById("cert-id").textContent = id;

            // --- 2. بناء مصفوفة المواد مع معالجة الأسماء في Firebase ---
            let subjects = [
                { n: "اللغة العربية", v: d.arabic, m: currentMax.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math, m: currentMax.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english, m: currentMax.english },
                { n: isLang ? "Science" : "العلوم", v: d.science, m: currentMax.science },
                { n: "التربية الدينية", v: d.religion, m: currentMax.religion },
                { n: "الدراسات الاجتماعية", v: (d.Social !== undefined ? d.Social : d.social), m: currentMax.social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: (d.technology !== undefined ? d.technology : d.tech), m: currentMax.tech }
            ];

            // استثناء الدين للمسيحي
            if (d.rel_type === "مسيحي") {
                subjects = subjects.filter(sub => sub.n !== "التربية الدينية");
            }

            // إضافة المستوى الرفيع للغات فقط
            if (isLang && d.highlevel !== undefined) {
                subjects.push({ n: "High Level", v: d.highlevel, m: currentMax.high });
            }

            // --- 3. الحسابات النهائية ---
            let totalObtained = 0;
            let totalMax = 0; 
            let html = "";

            subjects.forEach(s => {
                let val = s.v;
                // حساب المجموع الكلي من الإعدادات m لضمان الوصول لـ 140
                totalMax += Number(s.m || 20); 

                if (val === undefined || val === null || val === "") val = 0;

                let displayValue = (val === "غ") ? "غ" : val;
                let displayEval = getEval(val, s.m);

                if (val !== "غ") {
                    totalObtained += Number(val) || 0;
                }
                
                html += `<tr><td>${s.n}</td><td>${displayValue}</td><td>${displayEval}</td></tr>`;
            });

            document.getElementById("grades-body").innerHTML = html;
            
            // تحديث خانة المجموع
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalObtained}</strong> / ${totalMax}</td><td id="total-eval"></td>`;
            }

            // التقدير العام والبيان
            const finalPercentage = (totalObtained / totalMax) * 100;
            let finalEval = "جيد"; 
            if (finalPercentage >= 85) finalEval = "ممتاز";
            else if (finalPercentage >= 75) finalEval = "جيد جداً";
            
            if (document.getElementById("total-eval")) document.getElementById("total-eval").textContent = finalEval;
            
            if (document.getElementById("statement")) {
                const prefix = (d.gender === "أنثى") ? "الطالبة/" : "الطالب/";
                document.getElementById("statement").innerHTML = `${prefix} ${d.name} اجتاز الاختبارات بنجاح وحصل على تقدير عام: ${finalEval}`;
            }

        } else {
            alert("رقم الجلوس غير موجود");
        }
    } catch (err) {
        console.error("Error fetching student data:", err);
    }
});

// أزرار التحكم
document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
    document.getElementById("student-id-input").value = "";
});

if (document.getElementById("print-btn")) {
    document.getElementById("print-btn").addEventListener("click", () => window.print());
}
