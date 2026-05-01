import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// دالة حساب التقدير للمادة الواحدة (من 20)
function getSubjectEval(score) {
    if (score === 20) return "ممتاز مع الشكر";
    if (score === 19) return "ممتاز";
    if (score === 18) return "جيد جداً";
    return "جيد"; // أي درجة أقل من 18
}

// دالة حساب التقدير العام (من 140)
function getTotalEval(totalScore) {
    if (totalScore === 140) return "ممتاز مع الشكر";
    if (totalScore >= 133) return "ممتاز";
    if (totalScore >= 126) return "جيد جداً";
    return "جيد"; // أي مجموع أقل من 126
}

// ربط زر البحث
document.getElementById("search-btn").addEventListener("click", async () => {
    const studentId = document.getElementById("student-id-input").value.trim();
    const errorMsg = document.getElementById("error-msg");
    const certSection = document.getElementById("certificate-section");

    if (!studentId) {
        errorMsg.textContent = "يرجى إدخال رقم الجلوس أولاً.";
        return;
    }

    try {
        errorMsg.textContent = "جاري البحث...";
        // البحث في جدول الطلبة
        const docRef = doc(db, "students", studentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // إظهار الشهادة وإخفاء الخطأ
            errorMsg.textContent = "";
            certSection.style.display = "block";

            // 1. تعبئة بيانات الهوية (الشريط الجانبي)
            document.getElementById("cert-name").textContent = data.name;
            document.getElementById("cert-level").textContent = data.level;
            document.getElementById("cert-system").textContent = data.system;
            document.getElementById("cert-id").textContent = studentId;

            // 2. تعبئة الدرجات وحساب التقديرات
            const subjects = [
                { id: "religion", val: data.religion },
                { id: "arabic", val: data.arabic },
                { id: "english", val: data.english },
                { id: "math", val: data.math },
                { id: "science", val: data.science },
                { id: "Social", val: data.Social },
                { id: "technology", val: data.technology }
            ];

            let totalScore = 0;

            subjects.forEach(sub => {
                const grade = Number(sub.val) || 0;
                totalScore += grade;
                
                // طباعة الدرجة
                document.getElementById(`grade-${sub.id}`).textContent = grade;
                // طباعة التقدير
                document.getElementById(`eval-${sub.id}`).textContent = getSubjectEval(grade);
            });

            // 3. تعبئة المجموع الكلي والتقدير العام
            document.getElementById("total-score").textContent = totalScore;
            document.getElementById("total-eval").textContent = getTotalEval(totalScore);

        } else {
            errorMsg.textContent = "عفواً، رقم الجلوس غير مسجل أو غير صحيح.";
            certSection.style.display = "none";
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        errorMsg.textContent = "حدث خطأ في الاتصال بقاعدة البيانات.";
    }
});