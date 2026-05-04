import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

function getEval(score, maxForThisSubject) {
    if (score === "غ" || score === undefined || score === null || score === "") return "غائب";
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
            if (d.isActive === false) { alert("النتيجة محجوبة"); return; }

            const maxGradesConfig = {
                "الرابع": { arabic: 20, math: 15, english: 20, science: 20, religion: 20, social: 20, tech: 15, high: 20 },
                "الخامس": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 },
                "السادس": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 }
            };

            let levelKey = String(d.level || "").trim();
            if (levelKey.includes("خامس")) levelKey = "الخامس";
            if (levelKey.includes("رابع")) levelKey = "الرابع";
            if (levelKey.includes("سادس")) levelKey = "السادس";

            const currentMax = maxGradesConfig[levelKey] || maxGradesConfig["الرابع"];
            const isLang = d.system === "لغات";

            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            document.getElementById("cert-name").textContent = d.name;
            document.getElementById("cert-level").textContent = d.level;
            document.getElementById("cert-system").textContent = d.system || "عربي";
            document.getElementById("cert-id").textContent = id;

            let subjects = [
                { n: "اللغة العربية", v: d.arabic, m: currentMax.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math, m: currentMax.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english, m: currentMax.english },
                { n: isLang ? "Science" : "العلوم", v: d.science, m: currentMax.science },
                { n: "التربية الدينية", v: d.religion, m: currentMax.religion },
                { n: "الدراسات الاجتماعية", v: (d.Social !== undefined ? d.Social : d.social), m: currentMax.social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: (d.technology !== undefined ? d.technology : d.tech), m: currentMax.tech }
            ];

            if (d.rel_type === "مسيحي") subjects = subjects.filter(sub => sub.n !== "التربية الدينية");
            if (isLang && d.highlevel !== undefined) subjects.push({ n: "High Level", v: d.highlevel, m: currentMax.high });

            // --- التصفير والجمع الصارم ---
            let totalObtained = 0;
            let totalMax = 0;
            let html = "";

            subjects.forEach(s => {
                totalMax += Number(s.m); // جمع المجموع الكلي من الإعدادات

                let scoreVal = s.v;
                let displayValue = "";
                
                // التأكد من أن القيمة رقمية للجمع
                if (scoreVal === "غ" || scoreVal === undefined || scoreVal === null || scoreVal === "") {
                    displayValue = "غ";
                } else {
                    let num = Number(scoreVal);
                    totalObtained += isNaN(num) ? 0 : num; // يجمع فقط إذا كان رقماً
                    displayValue = num;
                }

                let displayEval = getEval(scoreVal, s.m);
                html += `<tr><td>${s.n}</td><td>${displayValue}</td><td>${displayEval}</td></tr>`;
            });

            document.getElementById("grades-body").innerHTML = html;
            
            const totalScoreEl = document.getElementById("total-score");
            if (totalScoreEl) {
                totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${totalObtained}</strong> / ${totalMax}</td><td id="total-eval"></td>`;
            }

            const finalPercentage = (totalObtained / totalMax) * 100;
            let finalEval = getEval(totalObtained, totalMax);
            if (document.getElementById("total-eval")) document.getElementById("total-eval").textContent = finalEval;

        } else { alert("رقم الجلوس غير موجود"); }
    } catch (err) { console.error(err); }
});

document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
});
