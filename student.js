import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة تقييم مرنة تعتمد على النسبة المئوية للدرجة
function getEval(score, maxForThisSubject) {
    if (score === "غ") return "غائب";
    if (isNaN(score) || score === null || score === "") return "ـ"; 

    const s = Number(score);
    const percentage = (s / maxForThisSubject) * 100;

    if (percentage >= 85) return "ممتاز";
    if (percentage >= 75) return "جيد جداً";
    return "جيد"; 
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

            // --- إعدادات الدرجات النهائية لكل صف ---
            const maxGradesConfig = {
                "الرابع": { arabic: 20, math: 15, english: 20, science: 20, religion: 20, social: 20, tech: 15, high: 20 },
                "الخامس": { arabic: 30, math: 20, english: 30, science: 30, religion: 30, social: 30, tech: 20, high: 30 },
                "السادس": { arabic: 100, math: 100, english: 100, science: 100, religion: 100, social: 100, tech: 100, high: 100 }
            };

            // اختيار الدرجة النهائية بناءً على صف الطالب (القيمة الافتراضية هي الرابع)
            const currentMax = maxGradesConfig[d.level] || maxGradesConfig["الرابع"];

            const isLang = d.system === "لغات";
            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // تحديث البيانات الأساسية
            const elements = {
                "cert-name": d.name,
                "cert-level": d.level,
                "cert-system": d.system || "عربي",
                "cert-id": id
            };

            for (let elId in elements) {
                const el = document.getElementById(elId);
                if (el) el.textContent = elements[elId];
            }

            // تحديد المواد والدرجات النهائية الديناميكية
            let subjects = [
                { n: "اللغة العربية", v: d.arabic, m: currentMax.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math, m: currentMax.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english, m: currentMax.english },
                { n: isLang ? "Science" : "العلوم", v: d.science, m: currentMax.science },
                { n: "التربية الدينية", v: d.religion, m: currentMax.religion },
                { n: "الدراسات الاجتماعية", v: d.Social, m: currentMax.social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology, m: currentMax.tech }
            ];

            if (d.rel_type === "مسيحي") {
                subjects = subjects.filter(sub => sub.n !== "التربية الدينية");
            }

            if (isLang && d.highlevel !== undefined) {
                subjects.push({ n: "High Level", v: d.highlevel, m: currentMax.high });
            }

            let totalObtained = 0;
            let totalMax = 0;
            let html = "";

            subjects.forEach(s => {
                let displayValue = s.v;
                let displayEval = getEval(s.v, s.m);
                totalMax += s.m;

                if (s.v === "غ" || isNaN(s.v) || s.v === null || s.v === "") {
                    displayValue = "غ";
                    displayEval = "ـ";
                } else {
                    totalObtained += Number(s.v) || 0;
                }
                
                html += `<tr><td>${s.n}</td><td>${displayValue}</td><td>${displayEval}</td></tr>`;
            });

            document.getElementById("grades-body").innerHTML = html;
            
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalObtained}</strong> / ${totalMax}</td><td id="total-eval"></td>`;
            }

            const finalPercentage = (totalObtained / totalMax) * 100;
            let finalEval = "جيد"; 
            
            if (finalPercentage >= 85) finalEval = "ممتاز";
            else if (finalPercentage >= 75) finalEval = "جيد جداً";
            
            if (document.getElementById("total-eval")) document.getElementById("total-eval").textContent = finalEval;
            
            if (document.getElementById("statement")) {
                const prefix = (d.gender === "أنثى") ? "الطالبة/" : "الطالب/";
                const verb = (d.gender === "أنثى") ? "اجتازت" : "اجتاز";
                const preposition = (d.gender === "أنثى") ? "وحصلت" : "وحصل";
                document.getElementById("statement").innerHTML = `${prefix} ${d.name} ${verb} الاختبارات بنجاح ${preposition} على تقدير عام: ${finalEval}`;
            }

        } else {
            alert("رقم الجلوس غير موجود");
        }
    } catch (err) {
        console.error("Error fetching student data:", err);
    }
});

// تفعيل زر إغلاق الشهادة
document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
    document.getElementById("student-id-input").value = "";
});

// تفعيل زر الطباعة
const printBtn = document.getElementById("print-btn");
if (printBtn) {
    printBtn.addEventListener("click", () => {
        window.print();
    });
}
