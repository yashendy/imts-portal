import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

function getTotalEval(score) {
    if (score === 140) return "ممتاز مع الشكر";
    if (score >= 133) return "ممتاز";
    if (score >= 126) return "جيد جداً";
    return "جيد";
}

document.getElementById("search-btn").addEventListener("click", async () => {
    const id = document.getElementById("student-id-input").value.trim();
    if (!id) return;

    const docSnap = await getDoc(doc(db, "students", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById("certificate-section").style.display = "block";
        
        // تعبئة الكارت
        document.getElementById("cert-name").textContent = data.name;
        document.getElementById("cert-level").textContent = data.level;
        document.getElementById("cert-system").textContent = data.system;
        document.getElementById("cert-id").textContent = id;

        // حساب الدرجات
        let total = Number(data.arabic) + Number(data.math) + Number(data.english) + 
                    Number(data.science) + Number(data.religion) + Number(data.Social) + Number(data.technology);
        
        document.getElementById("total-score").textContent = total;
        const evalText = getTotalEval(total);
        document.getElementById("total-eval").textContent = evalText;

        // تعبئة الجملة الختامية
        document.getElementById("cert-name-footer").textContent = data.name;
        document.getElementById("cert-total-eval").textContent = evalText;

        // ملء الجدول (اختصاراً)
        const fields = ["arabic", "math", "english", "science", "religion", "Social", "technology"];
        fields.forEach(f => {
            document.getElementById(`grade-${f}`).textContent = data[f];
            document.getElementById(`eval-${f}`).textContent = (data[f] >= 18 ? "ممتاز" : "جيد");
        });
    }
});
