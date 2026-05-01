import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

function getEval(score) { return score >= 18 ? "ممتاز" : "جيد جداً"; }

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    const docSnap = await getDoc(doc(db, "students", id));

    if (docSnap.exists()) {
        const d = docSnap.data();
        document.getElementById("search-section").style.display = "none";
        document.getElementById("certificate-section").style.display = "block";
        document.body.style.alignItems = "flex-start"; // لضبط شكل الشهادة الطولي

        document.getElementById("cert-name").textContent = d.name;
        document.getElementById("cert-level").textContent = d.level;
        document.getElementById("cert-system").textContent = d.system;
        document.getElementById("cert-id").textContent = id;

        const subjects = [
            {n: "اللغة العربية", v: d.arabic}, {n: "الرياضيات", v: d.math},
            {n: "اللغة الإنجليزية", v: d.english}, {n: "العلوم", v: d.science},
            {n: "التربية الدينية", v: d.religion}, {n: "الدراسات", v: d.Social},
            {n: "تكنولوجيا", v: d.technology}
        ];

        let total = 0;
        let html = "";
        subjects.forEach(s => {
            total += Number(s.v);
            html += `<tr><td>${s.n}</td><td>${s.v}</td><td>${getEval(s.v)}</td></tr>`;
        });

        document.getElementById("grades-body").innerHTML = html;
        document.getElementById("total-score").textContent = total + " / 140";
        document.getElementById("total-eval").textContent = total >= 126 ? "ممتاز" : "جيد جداً";
        document.getElementById("statement").innerHTML = `الطالب/ ${d.name} تم اجتياز الاختبارات الفصلية بنجاح وحصل على تقدير عام: ${total >= 126 ? "ممتاز" : "جيد جداً"}`;
    }
});
