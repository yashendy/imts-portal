import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة التقييم بناءً على النسبة المئوية
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
            if (d.isActive === false) { alert("النتيجة محجوبة مؤقتاً"); return; }

            // --- إعدادات الدرجات النهائية المتمايزة حسب (الصف + النظام)[cite: 4, 5] ---
            const maxGradesConfig = {
                "الرابع": {
                    "عربي": { arabic: 20, math: 15, english: 20, science: 20, religion: 20, social: 20, tech: 15, high: 20 },
                    "لغات": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 }
                },
                "الخامس": {
                    "عربي": { arabic: 20, math: 20, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 },
                    "لغات": { arabic: 20, math: 25, english: 25, science: 25, religion: 20, social: 20, tech: 20, high: 20 }
                },
                "السادس": {
                    "عربي": { arabic: 20, math: 15, english: 20, science: 20, religion: 20, social: 20, tech: 20, high: 20 },
                    "لغات": { arabic: 20, math: 20, english: 25, science: 20, religion: 20, social: 20, tech: 20, high: 20 }
                }
            };

            // تحديد مفتاح الصف والنظام[cite: 5]
            let levelKey = String(d.level || "").trim();
            if (levelKey.includes("خامس")) levelKey = "الخامس";
            if (levelKey.includes("رابع")) levelKey = "الرابع";
            if (levelKey.includes("سادس")) levelKey = "السادس";

            const studentSystem = d.system || "عربي";
            
            // اختيار مصفوفة الدرجات الصحيحة[cite: 5]
            const currentMax = maxGradesConfig[levelKey] ? maxGradesConfig[levelKey][studentSystem] : maxGradesConfig["الرابع"]["عربي"];

            const isLang = studentSystem === "لغات";

            // إظهار الشهادة وإخفاء البحث
            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // تحديث بيانات الطالب وتعديل مسمى (الطالب/الطالبة)[cite: 5]
            const genderLabel = (d.gender === "أنثى") ? "اسم الطالبة:" : "اسم الطالب:";
            document.getElementById("cert-name").parentElement.innerHTML = `<strong>${genderLabel}</strong> <span id="cert-name">${d.name}</span>`;
            
            document.getElementById("cert-level").textContent = d.level;
            document.getElementById("cert-system").textContent = studentSystem;
            document.getElementById("cert-id").textContent = id;

            // تجهيز قائمة المواد[cite: 5]
            let subjects = [
                { n: "اللغة العربية", v: d.arabic, m: currentMax.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math, m: currentMax.math },
                { n: isLang ? "English" : "اللغة الإنجليزية", v: d.english, m: currentMax.english },
                { n: isLang ? "Science" : "العلوم", v: d.science, m: currentMax.science },
                { n: "التربية الدينية", v: d.religion, m: currentMax.religion },
                { n: "الدراسات الاجتماعية", v: (d.Social !== undefined ? d.Social : d.social), m: currentMax.social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: (d.technology !== undefined ? d.technology : d.tech), m: currentMax.tech }
            ];

            // فلترة مادة الدين والمستوى الرفيع[cite: 5]
            if (d.rel_type === "مسيحي") subjects = subjects.filter(sub => sub.n !== "التربية الدينية");
            if (isLang && d.highlevel !== undefined) subjects.push({ n: "المستوى الرفيع", v: d.highlevel, m: currentMax.high });

            let totalObtained = 0;
            let totalMax = 0;
            let headHtml = `<th>المادة / الدرجات</th>`;
            let rowMaxHtml = `<td>الدرجة الكبرى</td>`;
            let rowStudentHtml = `<td>درجة الطالب</td>`;

            // بناء أعمدة الجدول (أفقي)[cite: 5]
            subjects.reverse().forEach(s => {
                let score = (s.v === "غ" || s.v === undefined) ? 0 : Number(s.v);
                totalObtained += score;
                totalMax += s.m;

                headHtml += `<th>${s.n}</th>`;
                rowMaxHtml += `<td>${s.m}</td>`;
                rowStudentHtml += `<td>${s.v === "غ" ? "غ" : score}</td>`;
            });

            // إضافة المجموع الكلي[cite: 5]
            headHtml += `<th class="total-col">المجموع</th>`;
            rowMaxHtml += `<td class="total-col">${totalMax}</td>`;
            rowStudentHtml += `<td class="total-col">${totalObtained}</td>`;

            document.getElementById("grades-table-main").innerHTML = `
                <thead><tr>${headHtml}</tr></thead>
                <tbody>
                    <tr>${rowMaxHtml}</tr>
                    <tr class="final-score-row">${rowStudentHtml}</tr>
                </tbody>
            `;

            // صياغة البيان الختامي حسب الجنس[cite: 5]
            const finalEval = getEval(totalObtained, totalMax);
            const isFemale = (d.gender === "أنثى");
            const title = isFemale ? "الطالبة" : "الطالب";
            const verb1 = isFemale ? "اجتازت" : "اجتاز";
            const verb2 = isFemale ? "وحصلت" : "وحصل";

            document.getElementById("statement").innerHTML = `${title}/ ${d.name} ${verb1} الاختبارات بنجاح ${verb2} على تقدير عام: ${finalEval}`;

        } else { alert("رقم الجلوس غير موجود"); }
    } catch (err) { console.error("Error:", err); }
});

// إغلاق الشهادة
document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
});

// طباعة الشهادة
document.getElementById("print-btn").addEventListener("click", () => window.print());
