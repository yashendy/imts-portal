import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة تقييم مرنة تعتمد على القيمة الفعلية والدرجة النهائية للمادة
// دالة تقييم مبدئية (ممتاز، جيد جداً، جيد)
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

            // إزالة مادة التربية الدينية إذا كان الطالب مسيحياً
            if (d.rel_type === "مسيحي") {
                subjects = subjects.filter(sub => sub.n !== "التربية الدينية");
            }

            // إضافة مادة المستوى الرفيع لطلاب اللغات فقط
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

            // التقييم العام بناءً على النسبة المئوية للمجموع الكلي
            const finalPercentage = (totalObtained / totalMax) * 100;
            let finalEval = "جيد"; // القيمة الافتراضية لأي نسبة أقل من 75%
            
            if (finalPercentage >= 85) {
                finalEval = "ممتاز";
            } else if (finalPercentage >= 75) {
                finalEval = "جيد جداً";
            }
            
            if (document.getElementById("total-eval")) document.getElementById("total-eval").textContent = finalEval;
            
            // التعديل الجديد: تحديد صياغة الجملة الختامية بناءً على الجنس
            if (document.getElementById("statement")) {
                let statementText = "";
                
                if (d.gender === "أنثى") {
                    statementText = `الطالبة/ ${d.name} اجتازت الاختبارات بنجاح وحصلت على تقدير عام: ${finalEval}`;
                } else {
                    statementText = `الطالب/ ${d.name} اجتاز الاختبارات بنجاح وحصل على تقدير عام: ${finalEval}`;
                }
                
                document.getElementById("statement").innerHTML = statementText;
            }

        } else {
            alert("رقم الجلوس غير موجود");
        }
    } catch (err) {
        console.error("Error fetching student data:", err);
    }
});

// تفعيل زر إغلاق الشهادة والعودة للبحث
document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
    
    // تفريغ حقل البحث عشان يكون جاهز لرقم الجلوس الجديد
    document.getElementById("student-id-input").value = "";
    document.getElementById("error-msg").innerText = ""; 
});
