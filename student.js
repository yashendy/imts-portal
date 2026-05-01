import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

function getSubjectEval(score) {
    if (score === 20) return "ممتاز مع الشكر";
    if (score === 19) return "ممتاز";
    if (score === 18) return "جيد جداً";
    return "جيد";
}

function getTotalEval(totalScore) {
    if (totalScore === 140) return "ممتاز مع الشكر";
    if (totalScore >= 133) return "ممتاز";
    if (totalScore >= 126) return "جيد جداً";
    return "جيد";
}

document.getElementById("search-btn").addEventListener("click", async () => {
    const studentId = document.getElementById("student-id-input").value.trim();
    const errorMsg = document.getElementById("error-msg");
    const certSection = document.getElementById("certificate-section");

    if (!studentId) {
        errorMsg.textContent = "يرجى إدخال رقم الجلوس.";
        return;
    }

    try {
        errorMsg.textContent = "جاري البحث...";
        const docRef = doc(db, "students", studentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            errorMsg.textContent = "";
            certSection.style.display = "block";

            // بيانات الكارت
            document.getElementById("cert-name").textContent = data.name;
            document.getElementById("cert-level").textContent = data.level;
            document.getElementById("cert-system").textContent = data.system;
            document.getElementById("cert-id").textContent = studentId;

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
                document.getElementById(`grade-${sub.id}`).textContent = grade;
                document.getElementById(`eval-${sub.id}`).textContent = getSubjectEval(grade);
            });

            const finalEval = getTotalEval(totalScore);
            document.getElementById("total-score").textContent = totalScore;
            document.getElementById("total-eval").textContent = finalEval;

            // ملء الجملة الختامية
            document.getElementById("cert-name-footer").textContent = data.name;
            document.getElementById("cert-total-eval").textContent = finalEval;

        } else {
            errorMsg.textContent = "رقم الجلوس غير صحيح.";
            certSection.style.display = "none";
        }
    } catch (error) {
        errorMsg.textContent = "خطأ في الاتصال بقاعدة البيانات.";
    }
});
