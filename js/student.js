import { db } from "./firebase.js";
import {
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import { generateLocalAdvice, answerQuestionLocally } from "./coach.js";
import { exportAsCSV, exportAsPDF } from "./exporter.js";

/* DOM */
const seatForm   = document.getElementById("seatForm");
const seatInput  = document.getElementById("seatInput");
const printBtn   = document.getElementById("printBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const statusArea = document.getElementById("statusArea");

const sName  = document.getElementById("s_name");
const sClass = document.getElementById("s_class");
const sSeat  = document.getElementById("s_seat");
const sYear  = document.getElementById("s_year");
const guardianNote = document.getElementById("guardianNote");

const monthsTabs   = document.getElementById("monthsTabs");
const monthsPanels = document.getElementById("monthsPanels");

/* Coach DOM */
const coachSummary = document.getElementById("coachSummary");
const coachForm    = document.getElementById("coachForm");
const coachQ       = document.getElementById("coachQ");
const coachAnswer  = document.getElementById("coachAnswer");
document.querySelectorAll(".chip").forEach(ch => {
  ch.addEventListener("click", ()=> {
    coachQ.value = ch.dataset.q || "";
    coachForm.requestSubmit();
  });
});

/* Helpers */
const MONTHS_ORDER = ["سبتمبر","أكتوبر","نوفمبر","ديسمبر","يناير","فبراير","مارس","أبريل","مايو"];
function byOrder(a,b){ return MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b); }
function setStatus(msg){ statusArea.textContent = msg || ""; }

/* تقدير */
function computeBand({total, testAbsent=false, testScore=null}){
  if (testAbsent || testScore === 0) return { band:"غياب", class:"bad", hideNumeric:false, appreciation:false };
  if (total >= 39.5) return { band:"ممتاز مع الشكر", class:"excellent", hideNumeric:false, appreciation:true };
  if (total >= 35)   return { band:"جيد جدًا", class:"good", hideNumeric:false, appreciation:false };
  if (total >= 30)   return { band:"جيد", class:"warn", hideNumeric:false, appreciation:false };
  return { band:"بحاجة لدعم", class:"bad", hideNumeric:true, appreciation:false };
}

/* بيانات عامة محفوظة للاستخدام في التصدير والمساعد */
let studentInfo = { fullName:"-", classLabel:"-", seat7:"-", yearId:"-" };
let monthsData  = []; // [{ month, subjects, total, bandObj }]

/* تعبئة بيانات الطالب */
function fillStudentInfo({fullName, classLabel, seat7, yearId}){
  studentInfo = { fullName: fullName || "-", classLabel: classLabel || "-", seat7: seat7 || "-", yearId: yearId || "-" };
  sName.textContent  = studentInfo.fullName;
  sClass.textContent = studentInfo.classLabel;
  sSeat.textContent  = studentInfo.seat7;
  sYear.textContent  = studentInfo.yearId;
}

/* رسم شهر */
function renderMonthPanel(month, subjects){
  const panel = document.createElement("div");
  panel.className = "card";
  panel.dataset.month = month;

  let total = 0, anyAbs = false, testZero = false;
  const rows = subjects.map((subj)=>{
    const name = subj.name || subj.subjectName || "-";
    const c = subj.components || {};
    const test = c.test || {}, hw = c.homework || {}, part = c.participation || {}, beh = c.behavior || {};
    const t = Number(test.score ?? 0), h = Number(hw.score ?? 0), p = Number(part.score ?? 0), b = Number(beh.score ?? 0);
    const rowTotal = t+h+p+b;
    total += rowTotal;
    if (test.absent) anyAbs = true;
    if (t === 0) testZero = true;
    return `
      <tr>
        <td>${name}</td>
        <td>${test.absent ? "غ" : t}</td>
        <td>${hw.absent ? "غ" : h}</td>
        <td>${part.absent ? "غ" : p}</td>
        <td>${beh.absent ? "غ" : b}</td>
        <td>${rowTotal}</td>
      </tr>
    `;
  }).join("");

  const bandObj = computeBand({ total, testAbsent:anyAbs, testScore:testZero?0:null });
  const badgeCls = `badge ${bandObj.class}`;
  const totalDisplay = bandObj.hideNumeric ? `<span class="muted">—</span>` : `<strong>${total}</strong>`;
  const guardianVisible = bandObj.band === "بحاجة لدعم";

  panel.innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:center;">
      <h3 style="margin:0">نتيجة شهر: ${month}</h3>
      <span class="${badgeCls}">${bandObj.band}</span>
    </div>
    <div class="row" style="gap:10px; align-items:center;">
      <div><strong>إجمالي الشهر (من 40):</strong> ${totalDisplay}</div>
      ${bandObj.appreciation ? `<span class="badge excellent">شهادة تقدير</span>` : ``}
    </div>
    ${guardianVisible ? `<div class="note">الطالب يحتاج دعمًا من ولي الأمر.</div>` : ``}
    <div style="overflow:auto; margin-top:8px">
      <table class="table">
        <thead>
          <tr>
            <th>المادة</th>
            <th>الاختبار (10)</th>
            <th>الواجبات (10)</th>
            <th>المشاركة (10)</th>
            <th>السلوك (10)</th>
            <th>الإجمالي (40)</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">لا توجد مواد</td></tr>`}</tbody>
      </table>
    </div>
  `;

  if (guardianVisible) guardianNote.classList.remove("is-hidden");

  // خزّن للاحصاء/التصدير/المساعد
  monthsData.push({ month, subjects, total, bandObj });
  return panel;
}

function renderMonthTab(month, active=false){
  const btn = document.createElement("button");
  btn.className = "tab-btn" + (active ? " active" : "");
  btn.textContent = month;
  btn.dataset.month = month;
  btn.addEventListener("click", ()=> activateMonth(month));
  return btn;
}

function activateMonth(month){
  document.querySelectorAll(".tab-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.month === month);
  });
  monthsPanels.querySelectorAll(".card").forEach(p=>{
    p.style.display = (p.dataset.month === month) ? "block" : "none";
  });
}

/* استعلام seatNumbers */
async function findSeatDoc(seat7){
  const q = query(
    collection(db,"seatNumbers"),
    where("seat7","==",seat7),
    where("status","==","active")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { id: snap.docs[0].id, ...d };
}

/* جلب النتائج من مسارات محتملة */
async function tryCollection(coll, conditions){
  let ref = collection(db, coll);
  for (const [f,op,val] of conditions){
    ref = query(ref, where(f,op,val));
  }
  const s = await getDocs(ref);
  if (s.empty) return [];
  return s.docs.map(d => ({ id:d.id, ...d.data() }));
}
async function trySubcollection(path){
  try{
    const s = await getDocs(collection(db, path));
    if (s.empty) return [];
    return s.docs.map(d => ({ id:d.id, ...d.data() }));
  }catch{ return []; }
}
async function fetchResults(studentId, yearId, seat7){
  // 1) studentResults (studentId + yearId)
  let r = await tryCollection("studentResults", [["studentId","==",studentId],["yearId","==",yearId]]);
  if (r.length) return r;
  // 2) studentResults (seat7 + yearId)
  r = await tryCollection("studentResults", [["seat7","==",seat7],["yearId","==",yearId]]);
  if (r.length) return r;
  // 3) results (studentId + yearId)
  r = await tryCollection("results", [["studentId","==",studentId],["yearId","==",yearId]]);
  if (r.length) return r;
  // 4) students/{id}/results/{yearId}/months
  r = await trySubcollection(`students/${studentId}/results/${yearId}/months`);
  return r;
}

/* تحويل نتائج خام → مجموعات شهور موحّدة */
function normalizeResultsDocs(docs){
  const groups = {};
  docs.forEach(d=>{
    const month = d.month || d.title || d.id || "غير محدد";
    const subjects = d.subjects || d.items || [];
    if (!groups[month]) groups[month] = [];
    groups[month].push(...subjects);
  });
  return groups;
}

/* رسم النتائج وإعداد المساعد/التصدير */
function renderResultsByMonths(docs){
  // إعادة الضبط
  monthsTabs.innerHTML = "";
  monthsPanels.innerHTML = "";
  guardianNote.classList.add("is-hidden");
  monthsData = [];

  const groups = normalizeResultsDocs(docs);
  const months = Object.keys(groups).sort(byOrder);

  if (!months.length){
    setStatus("لا توجد نتائج لهذا الطالب.", "info");
    return;
  }

  months.forEach((m, i)=>{
    const btn = renderMonthTab(m, i===0);
    monthsTabs.appendChild(btn);

    const panel = renderMonthPanel(m, groups[m]);
    panel.style.display = (i===0) ? "block" : "none";
    monthsPanels.appendChild(panel);
  });

  // إعداد ملخص للمساعد
  const summary = generateLocalAdvice(studentInfo, monthsData);
  coachSummary.textContent = summary;
  coachAnswer.textContent = "";
}

/* تحميل بالرقم */
async function loadBySeat(seat7){
  setStatus("جاري البحث عن رقم الجلوس…");
  monthsTabs.innerHTML = "";
  monthsPanels.innerHTML = "";
  guardianNote.classList.add("is-hidden");
  monthsData = [];

  if (!/^\d{7}$/.test(seat7)){
    setStatus("برجاء إدخال رقم جلوس صحيح (٧ أرقام).");
    return;
  }

  const seatDoc = await findSeatDoc(seat7);
  if (!seatDoc){
    setStatus("رقم الجلوس غير موجود أو غير مفعل.");
    return;
  }

  const basic = seatDoc.studentBasic || {};
  fillStudentInfo({
    fullName: basic.fullName || basic.name || "-",
    classLabel: basic.classLabel || "-",
    seat7,
    yearId: seatDoc.yearId || "-"
  });

  setStatus("جاري تحميل النتائج…");
  const rs = await fetchResults(seatDoc.studentId, seatDoc.yearId, seat7);

  if (!rs.length){
    setStatus("لا توجد نتائج مسجلة لهذا الطالب في هذا العام.");
    return;
  }

  setStatus("");
  renderResultsByMonths(rs);
}

/* URL param */
(function initFromURL(){
  const params = new URLSearchParams(location.search);
  const s = params.get("seat");
  if (s){
    seatInput.value = s;
    loadBySeat(s);
  }
})();

/* أحداث */
seatForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const s = seatInput.value.trim();
  loadBySeat(s);
});
printBtn.addEventListener("click", ()=> window.print());

/* التصدير */
exportCsvBtn.addEventListener("click", ()=>{
  if (!monthsData.length) { alert("لا توجد بيانات للتصدير."); return; }
  exportAsCSV(studentInfo, monthsData);
});
exportPdfBtn.addEventListener("click", ()=>{
  if (!monthsData.length) { alert("لا توجد بيانات للتصدير."); return; }
  // نمرر مسار الشعار لو متاح
  exportAsPDF(studentInfo, monthsData, "assets/logo.png");
});

/* المساعد */
coachForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  const q = coachQ.value.trim();
  if (!q){ coachAnswer.textContent = "اكتب سؤالك أولًا."; return; }
  coachAnswer.textContent = answerQuestionLocally(q, studentInfo, monthsData);
});
