import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// تعديل دالة التقييم لتتعامل مع الغياب
function getEval(score) { 
    if (score === "غ") return "ـ"; 
    const s = Number(score);
    if (isNaN(s)) return "ـ";
    return s >= 18 ? "ممتاز" : "جيد جداً"; 
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

            for (let id in elements) {
                const el = document.getElementById(id);
                if (el) el.textContent = elements[id];
            }

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
            let html = "";
            let hasAbsence = false;

            subjects.forEach(s => {
                const val = s.v;
                // إذا كانت القيمة رقمية تضاف للمجموع، إذا كانت "غ" لا تضاف
                if (val !== "غ") {
                    total += Number(val) || 0;
                } else {
                    hasAbsence = true; 
                }
                html += `<tr><td>${s.n}</td><td>${val}</td><td>${getEval(val)}</td></tr>`;
            });

            document.getElementById("grades-body").innerHTML = html;
            const maxScore = subjects.length * 20;
            
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.textContent = total;
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${total}</strong> / ${maxScore}</td><td id="total-eval"></td>`;
            }

            // التقييم العام (يمكنك تعديل منطقه إذا كان الغياب يؤثر على التقييم الكلي)
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
