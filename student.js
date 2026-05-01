import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

function getEval(score) { return score >= 18 ? "ممتاز" : "جيد جداً"; }

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

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
        document.getElementById("cert-name").textContent = d.name;
        document.getElementById("cert-name-footer").textContent = d.name;
        document.getElementById("cert-level").textContent = d.level;
        document.getElementById("cert-system").textContent = d.system;
        document.getElementById("cert-id").textContent = id;

        // مصفوفة المواد الذكية
        let subjects = [
            { n: "اللغة العربية", v: d.arabic },
            { n: isLang ? "Math" : "الرياضيات", v: d.math },
            { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
            { n: isLang ? "Science" : "العلوم", v: d.science },
            { n: "التربية الدينية", v: d.religion },
            { n: "الدراسات الاجتماعية", v: d.Social },
            { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
        ];

        if (isLang && d.highlevel > 0) {
            subjects.push({ n: "High Level", v: d.highlevel });
        }

        let total = 0;
        let html = "";
        subjects.forEach(s => {
            const v = Number(s.v) || 0;
            total += v;
            html += `<tr><td>${s.n}</td><td>${v}</td><td>${getEval(v)}</td></tr>`;
        });

        const maxScore = subjects.length * 20;
        document.getElementById("grades-body").innerHTML = html;
        document.getElementById("total-score").textContent = total;
        document.getElementById("total-score").parentElement.innerHTML = `<strong>المجموع الكلي</strong></td><td><strong>${total}</strong> / ${maxScore}</td>`;
        
        const finalEval = total >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";
        document.getElementById("total-eval").textContent = finalEval;
        document.getElementById("cert-total-eval").textContent = finalEval;
        document.getElementById("statement").innerHTML = `الطالب/ ${d.name} تم اجتياز الاختبارات بنجاح وحصل على تقدير عام: ${finalEval}`;
    }
});
