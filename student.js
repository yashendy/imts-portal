import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة التقييم بناءً على الدرجة
function getEval(score) { 
    return score >= 18 ? "ممتاز" : "جيد جداً"; 
}

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

    const docSnap = await getDoc(doc(db, "students", id));
    
    if (docSnap.exists()) {
        const d = docSnap.data();
        
        // 1. التحقق من حالة حجب النتيجة
        if (d.isActive === false) {
            alert("النتيجة محجوبة مؤقتاً");
            return;
        }

        // 2. تحديد النظام (عربي أو لغات) لضبط مسميات المواد
        const isLang = d.system === "لغات";
        
        // إظهار قسم الشهادة وإخفاء البحث
        document.getElementById("certificate-section").style.display = "block";
        document.getElementById("search-section").style.display = "none";

        // 3. تحديث البيانات الأساسية (التأكد من جلب الاسم والصف والنظام)
        document.getElementById("cert-name").textContent = d.name || "غير مسجل";
        document.getElementById("cert-name-footer").textContent = d.name || "";
        document.getElementById("cert-level").textContent = d.level || "غير محدد";
        document.getElementById("cert-system").textContent = d.system || "عربي";
        document.getElementById("cert-id").textContent = id;

        // 4. بناء مصفوفة المواد (تغيير الأسماء أوتوماتيكياً للغات)[cite: 4]
        let subjects = [
            { n: "اللغة العربية", v: d.arabic },
            { n: isLang ? "Math" : "الرياضيات", v: d.math },
            { n: isLang ? "English (AL)" : "اللغة الإنجليزية", v: d.english },
            { n: isLang ? "Science" : "العلوم", v: d.science },
            { n: "التربية الدينية", v: d.religion },
            { n: "الدراسات الاجتماعية", v: d.Social },
            { n: isLang ? "ICT" : "تكنولوجيا المعلومات", v: d.technology }
        ];

        // 5. إضافة "المستوى الرفيع" فقط إذا كان القسم لغات وهناك درجة[cite: 4]
        if (isLang && d.highlevel !== undefined && d.highlevel > 0) {
            subjects.push({ n: "High Level", v: d.highlevel });
        }

        // 6. حساب المجموع وبناء جدول الدرجات[cite: 4]
        let total = 0;
        let html = "";
        subjects.forEach(s => {
            const v = Number(s.v) || 0; // تحويل القيمة لرقم لضمان الحساب الصحيح
            total += v;
            html += `<tr><td>${s.n}</td><td>${v}</td><td>${getEval(v)}</td></tr>`;
        });

        // 7. تحديث واجهة الجدول والمجموع الكلي[cite: 4]
        const maxScore = subjects.length * 20; // المجموع من 140 للعربي أو 160 للغات (لو فيه مستوى رفيع)
        document.getElementById("grades-body").innerHTML = html;
        
        // تحديث خلية المجموع الكلي لتناسب عدد المواد
        const totalRow = document.getElementById("total-score").parentElement;
        totalRow.innerHTML = `<td><strong>المجموع الكلي</strong></td><td><strong>${total}</strong> / ${maxScore}</td><td id="total-eval"></td>`;
        
        // 8. تحديد التقدير العام والبيان الختامي[cite: 4]
        const finalEval = total >= (maxScore * 0.9) ? "ممتاز" : "جيد جداً";
        document.getElementById("total-eval").textContent = finalEval;
        document.getElementById("cert-total-eval").textContent = finalEval;
        document.getElementById("statement").innerHTML = `الطالب/ ${d.name} تم اجتياز الاختبارات بنجاح وحصل على تقدير عام: ${finalEval}`;
        
    } else {
        alert("رقم الجلوس غير موجود، يرجى التأكد من البيانات.");
    }
});
