import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

function getEval(score) { return score >= 18 ? "ممتاز" : "جيد جداً"; }

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

    const docSnap = await getDoc(doc(db, "students", id));

    if (docSnap.exists()) {
        const d = docSnap.data();
        
        // --- ميزة الحجب (غير فعال) ---
        if (d.isActive === false) {
            alert("عذراً، النتيجة محجوبة حالياً. يرجى مراجعة إدارة المعهد.");
            return;
        }

        document.getElementById("search-section").style.display = "none";
        document.getElementById("certificate-section").style.display = "block";

        document.getElementById("cert-name").textContent = d.name;
        document.getElementById("cert-name-footer").textContent = d.name;
        document.getElementById("cert-level").textContent = d.level;
        document.getElementById("cert-system").textContent = d.system || "عربي";
        document.getElementById("cert-id").textContent = id;

        const subjects = [
            {n: "اللغة العربية", v: d.arabic, id: "arabic"}, 
            {n: "الرياضيات", v: d.math, id: "math"},
            {n: "اللغة الإنجليزية", v: d.english, id: "english"}, 
            {n: "العلوم", v: d.science, id: "science"},
            {n: "التربية الدينية", v: d.religion, id: "religion"}, 
            {n: "الدراسات الاجتماعية", v: d.Social, id: "Social"},
            {n: "تكنولوجيا المعلومات", v: d.technology, id: "technology"}
        ];

        let total = 0;
        let html = "";
        subjects.forEach(s => {
            const val = Number(s.v) || 0;
            total += val;
            html += `<tr><td>${s.n}</td><td>${val}</td><td>${getEval(val)}</td></tr>`;
        });

        document.getElementById("grades-body").innerHTML = html;
        document.getElementById("total-score").textContent = total;
        const finalEval = total >= 126 ? "ممتاز" : "جيد جداً";
        document.getElementById("total-eval").textContent = finalEval;
        document.getElementById("cert-total-eval").textContent = finalEval;
        document.getElementById("statement").innerHTML = `الطالب/ ${d.name} تم اجتياز الاختبارات الفصلية بنجاح وحصل على تقدير عام: ${finalEval}`;
    } else {
        alert("رقم الجلوس غير موجود");
    }
});
