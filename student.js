import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة التقييم: أصبحت تأخذ اسم المادة لتحديد الدرجة النهائية (15 أو 20)
function getEval(score, subjectName) { 
    if (score === "غ" || isNaN(score) || score === null || score === "") return "ـ"; 
    
    const s = Number(score);
    // تحديد الدرجة النهائية للمادة
    const limit = (subjectName === "تكنولوجيا المعلومات" || subjectName === "ICT") ? 15 : 20;
    
    // ممتاز إذا حصل على 90% من الدرجة النهائية للمادة (13.5 للتكنولوجيا، 18 للبقية)
    return s >= (limit * 0.9) ? "ممتاز" : "جيد جداً"; 
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

            // بناء قائمة المواد
            let subjects = [
                { n: "اللغة العربية", v: d.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
                { n: isLang ? "Science" : "العلوم", v: d.science },
                { n: "التربية الدينية", v: d.religion },
                { n: "الدراسات الاجتماعية", v: d.Social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
            ];

            if (isLang && d.highlevel !== undefined) {
                subjects.push({ n: "High Level", v: d.highlevel });
            }

            let total = 0;
            let maxScore = 0; // سنحسب المجموع الأقصى بدقة
            let html = "";

            subjects.forEach(s => {
                let displayValue = s.v;
                let displayEval = getEval(s.v, s.n);

                // حساب المجموع الأقصى لكل مادة حسب اسمها
                if (s.n === "تكنولوجيا المعلومات" || s.n === "ICT") {
                    maxScore += 15;
                } else {
                    maxScore += 20;
                }

                // فحص الغياب
                if (s.v === "غ" || isNaN(s.v) || s.v === null || s.v === "") {
                    displayValue = "غ";
                    displayEval = "ـ";
                } else {
                    total += Number(s.v) || 0;
                }
                
                html += `<tr><td>${s.n}</td><td>${displayValue}</td><td>${displayEval}</td></tr>`;
            });

            document.getElementById("grades-body").innerHTML = html;
            
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.textContent = total;
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${total}</strong> / ${maxScore}</td><td id="total-eval"></td>`;
            }

            // التقييم العام بناءً على المجموع الفعلي مقارنة بالمجموع الأقصى المحسوب
            const finalEval = total >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";
            
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
