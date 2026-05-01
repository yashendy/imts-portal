import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

function getEval(score) { return score >= 18 ? "ممتاز" : "جيد جداً"; }

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

    try {
        const docSnap = await getDoc(doc(db, "students", id));
        if (docSnap.exists()) {
            const d = docSnap.data();
            if (d.isActive === false) { alert("النتيجة محجوبة مؤقتاً"); return; }

            const isFemale = d.gender === "أنثى";
            const isChristian = d.rel_type === "مسيحي";
            const isLang = d.system === "لغات";

            // تحديد صياغة النصوص
            const sTitle = isFemale ? "الطالبة" : "الطالب";
            const sPassed = isFemale ? "تمت اجتياز" : "تم اجتياز";
            const sObtained = isFemale ? "وحصلت على" : "وحصل على";

            document.getElementById("certificate-section").style.display = "block";
            document.getElementById("search-section").style.display = "none";

            // تعبئة البيانات الجانبية
            document.getElementById("cert-name").textContent = `${sTitle}/ ${d.name}`;
            document.getElementById("cert-level").textContent = d.level || "غير محدد";
            document.getElementById("cert-system").textContent = d.system || "عربي";
            document.getElementById("cert-id").textContent = id;

            // بناء قائمة المواد
            let subjects = [
                { n: "اللغة العربية", v: d.arabic },
                { n: isLang ? "Math" : "الرياضيات", v: d.math },
                { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
                { n: isLang ? "Science" : "العلوم", v: d.science },
                { n: "الدراسات الاجتماعية", v: d.Social },
                { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
            ];

            // استبعاد مادة الدين مؤقتاً للمسيحيين
            if (!isChristian) {
                subjects.push({ n: "التربية الدينية", v: d.religion });
            }

            // إضافة المستوى الرفيع للغات
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
            
            // تحديث صف المجموع
            const totalScoreEl = document.getElementById("total-score");
            totalScoreEl.parentElement.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${total}</strong> / ${maxScore}</td><td id="total-eval"></td>`;

            const finalEval = total >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";
            document.getElementById("total-eval").textContent = finalEval;
            
            // صياغة البيان الختامي
            document.getElementById("statement").innerHTML = 
                `${sTitle}/ ${d.name} ${sPassed} الاختبارات الفصلية بنجاح ${sObtained} تقدير عام: ${finalEval}`;

        } else { alert("رقم الجلوس غير موجود"); }
    } catch (err) { console.error("Error:", err); }
});

// تفعيل زر الإغلاق
document.getElementById("close-cert-btn").addEventListener("click", () => {
    document.getElementById("certificate-section").style.display = "none";
    document.getElementById("search-section").style.display = "block";
    document.getElementById("student-id-input").value = "";
});
