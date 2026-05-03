import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة تقييم مرنة تعتمد على القيمة الفعلية والدرجة النهائية للمادة
function getEval(score, maxForThisSubject) { 
    if (score === "غ" || isNaN(score) || score === null || score === "") return "ـ"; 
    
    const s = Number(score);
    // ممتاز إذا حصل على 90% أو أكثر من الدرجة النهائية للمادة
    return s >= (maxForThisSubject * 0.9) ? "ممتاز" : "جيد جداً"; 
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

            const isLang = d.system === "لغات";
            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // تحديث البيانات الأساسية
            const elements = {
                "cert-name": d.name,
                "cert-name-footer": d.name,
                "cert-level": d.level,
                "cert-system": d.system || "عربي",
                "cert-id": id
            };

            for (let elId in elements) {
                const el = document.getElementById(elId);
                if (el) el.textContent = elements[elId];
            }

            // --- الجزء الأهم: تحديد الدرجات النهائية هنا ---
            // يمكنك تغيير الـ m (الدرجة النهائية) لكل مادة بسهولة من هنا
            let subjects = [
                { n: "اللغة العربية", v: d.arabic, m: 20 },
                { n: isLang ? "Math" : "الرياضيات", v: d.math, m: 15 },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english, m: 20 },
                { n: isLang ? "Science" : "العلوم", v: d.science, m: 20 },
                { n: "التربية الدينية", v: d.religion, m: 20 },
                { n: "الدراسات الاجتماعية", v: d.Social, m: 20 }, // مثال: من 15
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology, m: 15 } // من 15
            ];

            if (isLang && d.highlevel !== undefined) {
                subjects.push({ n: "High Level", v: d.highlevel, m: 20 });
            }

            let totalObtained = 0; // المجموع الذي حصل عليه الطالب
            let totalMax = 0;      // المجموع الكلي النهائي (مجموع الـ 20 والـ 15)
            let html = "";

            subjects.forEach(s => {
                let displayValue = s.v;
                let displayEval = getEval(s.v, s.m);

                totalMax += s.m; // يجمع الدرجة النهائية للمادة (سواء 15 أو 20)

                if (s.v === "غ" || isNaN(s.v) || s.v === null || s.v === "") {
                    displayValue = "غ";
                    displayEval = "ـ";
                } else {
                    totalObtained += Number(s.v) || 0;
                }
                
                html += `<tr><td>${s.n}</td><td>${displayValue}</td><td>${displayEval}</td></tr>`;
            });

            document.getElementById("grades-body").innerHTML = html;
            
            // تحديث عرض المجموع الكلي بدقة
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.textContent = totalObtained;
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalObtained}</strong> / ${totalMax}</td><td id="total-eval"></td>`;
            }

            // التقييم العام بناءً على النسبة من المجموع الكلي الجديد
            const finalEval = totalObtained >= (totalMax * 0.9) ? "ممتاز" : "جيد جداً";
            
            if (document.getElementById("total-eval")) document.getElementById("total-eval").textContent = finalEval;
            if (document.getElementById("cert-total-eval")) document.getElementById("cert-total-eval").textContent = finalEval;
            
            if (document.getElementById("statement")) {
                document.getElementById("statement").innerHTML = `الطالب/ ${d.name} تم اجتياز الاختبارات بنجاح وحصل على تقدير عام: ${finalEval}`;
            }

        } else {
            alert("رقم الجلوس غير موجود");
        }
    } catch (err) {
        console.error("Error fetching student data:", err);
    }
});
