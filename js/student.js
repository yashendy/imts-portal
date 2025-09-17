// js/student.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// === Firebase Config ===
const firebaseConfig = {
  apiKey: "AIzaSyAk3r0OSq3NwvBjHpsNlGYb-dJWUmA9Azc",
  authDomain: "imts-portal.firebaseapp.com",
  projectId: "imts-portal",
  storageBucket: "imts-portal.firebasestorage.app",
  messagingSenderId: "819773792022",
  appId: "1:819773792022:web:58d92078d752959b5dba37",
  measurementId: "G-P9JK5KMDWL"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// عناصر DOM
const seatInput = document.getElementById('seat7');
const showBtn   = document.getElementById('showBtn');
const printBtn  = document.getElementById('printBtn');
const csvBtn    = document.getElementById('csvBtn');
const pdfBtn    = document.getElementById('pdfBtn');

const sName = document.getElementById('sName');
const sClass= document.getElementById('sClass');
const sSeat = document.getElementById('sSeat');
const sYear = document.getElementById('sYear');

const monthsContainer = document.getElementById('monthsContainer');
const totalEl   = document.getElementById('total');
const percentEl = document.getElementById('percent');
const bandEl    = document.getElementById('band');
const showNumericEl = document.getElementById('showNumeric');
const displayValueEl = document.getElementById('displayValue');

const aiEnable = document.getElementById('aiEnable');
const aiArea   = document.getElementById('aiArea');
const toneEnc  = document.getElementById('toneEnc');
const toneCare = document.getElementById('toneCare');
const toneFirm = document.getElementById('toneFirm');

// قراءة seat من URL
const params = new URLSearchParams(location.search);
if(params.get('seat')) seatInput.value = params.get('seat');

// جلب السنة الفعالة
async function getActiveYear(){
  const conf = await getDoc(doc(db,'config','public'));
  if(conf.exists() && conf.data().activeYear) return conf.data().activeYear;
  // fallback
  return '2025-2026';
}

// تحميل بيانات الطالب
async function loadStudent(seat7){
  const yearId = await getActiveYear();

  // 1) ابحث عن رقم الجلوس
  const q1 = query(collection(db,'seatNumbers'),
      where('yearId','==',yearId),
      where('seat7','==',seat7));
  const snap1 = await getDocs(q1);
  if(snap1.empty){
    setStatus('لم يتم العثور على رقم الجلوس.');
    return;
  }
  const seatDoc = snap1.docs[0].data();

  // 2) عرض بيانات أساسية
  sName.textContent = seatDoc.studentId || '—';
  sClass.textContent= `${seatDoc.grade || ''} / ${seatDoc.section || ''}`.trim();
  sSeat.textContent = seatDoc.seat7 || seat7;
  sYear.textContent = yearId;

  // 3) ابحث عن نتائج الطالب
  // نفترض تخزين النتائج بالهيكل:
  // collection: studentResults
  // doc id: seat7-yearId  (أو any id يحوي { seat7, yearId, subjects, overall, ... })
  const q2 = query(collection(db,'studentResults'),
    where('yearId','==',yearId),
    where('seat7','==',seat7)
  );
  const snap2 = await getDocs(q2);
  if(snap2.empty){
    setStatus('لا توجد نتائج بعد لهذا الطالب.');
    renderResults({subjects:[], overall:null});
    return;
  }
  const result = snap2.docs[0].data();

  renderResults(result);
  setStatus('');
}

function setStatus(msg){
  // يمكنك وضع مكان مخصص للرسائل إن رغبت
  console.log('[status]', msg);
}

// رسم النتائج
function renderResults(data){
  monthsContainer.innerHTML='';
  const subjects = data.subjects || []; // مصفوفة مواد، وكل مادة فيها components: test/homework/participation/behavior

  // نبني جدول مبسّط شهريًا (إذا عندك months داخل الدوكمنت عدّل هنا)
  // هنا نفترض subjects[] يحمل computed (rawTotal/rounded/band/showNumeric/displayValue)
  // + components لكل مادة (score/max/absent)
  subjects.forEach(sub=>{
    const box = document.createElement('div');
    box.className='card';
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
        <div><b>المادة:</b> ${sub.name || '-'}</div>
        <div><b>الكود:</b> ${sub.code || '-'}</div>
      </div>
      <div style="margin-top:6px">
        <div>اختبار: ${componentText(sub.components?.test)}</div>
        <div>واجبات: ${componentText(sub.components?.homework)}</div>
        <div>مشاركة: ${componentText(sub.components?.participation)}</div>
        <div>سلوك: ${componentText(sub.behavior)}</div>
      </div>
    `;
    monthsContainer.appendChild(box);
  });

  // إجمالي وتقدير
  const overall = data.overall || {};
  const total = overall.total ?? overall.rawTotal ?? 0;
  const percentage = overall.percentage ?? ((total/40)*100).toFixed(2);
  const band = computeBand(total, subjects);

  totalEl.textContent = Number(total).toFixed(1);
  percentEl.textContent= percentage;
  bandEl.textContent   = band.text;
  showNumericEl.textContent = (overall.showNumeric ?? true) ? 'نعم' : 'لا';
  displayValueEl.textContent = overall.displayValue ?? String(total);

  // ذكاء لوليّ الأمر
  if(aiEnable.checked){
    aiArea.value = buildGuardianSummary(band.key, total, subjects);
  }
}

function componentText(c){
  if(!c) return '-';
  if(c.absent) return 'غ';
  return `${c.score ?? 0} / ${c.max ?? 10}`;
}

// حساب التقدير وفق الشروط
function computeBand(total, subjects){
  // غياب إن كانت درجة الاختبار = 0 لأي مادة اختبار أساسي؟
  const anyTestZero = subjects.some(s => (s.components?.test?.score ?? 0) === 0);
  if(anyTestZero){
    return { key:'absent', text:'غياب' };
  }

  if(total >= 39.5){
    return { key:'excellent', text:'ممتاز مع الشكر (شهادة تقدير)' };
  }else if(total >= 36){
    return { key:'verygood', text:'جيد جدًا' };
  }else if(total >= 30){
    return { key:'good', text:'جيد' };
  }else{
    return { key:'encourage', text:'بحاجة إلى دعم وتشجيع' };
  }
}

// ملخص ذكي بسيط (بدون API خارجي)
function buildGuardianSummary(bandKey, total, subjects){
  const names = subjects.map(s=>s.name).filter(Boolean);
  let base = `المجموع: ${Number(total).toFixed(1)} من 40.\n`;
  switch(bandKey){
    case 'excellent':
      base += 'المستوى ممتاز مع الشكر. ننصح بالاستمرار على نفس الوتيرة.';
      break;
    case 'verygood':
      base += 'المستوى جيد جدًا. حافظ على المراجعة المنتظمة لتعزيز الدرجة.';
      break;
    case 'good':
      base += 'المستوى جيد. بعض التركيز الإضافي في المواد سيحسّن النتائج.';
      break;
    case 'absent':
      base += 'يرجى تلافي الغياب مستقبلًا والمتابعة المبكرة لضمان الاستفادة.';
      break;
    default:
      base += 'الطالب يحتاج دعمًا من وليّ الأمر وخطة مراجعة قصيرة المدى.';
  }
  if(names.length) base += `\nالمواد: ${names.join('، ')}`;
  return base;
}

// أزرار
showBtn.addEventListener('click', ()=>{
  const seat = seatInput.value.trim();
  if(!seat){ alert('أدخل رقم الجلوس'); return; }
  loadStudent(seat);
  const url = new URL(location.href);
  url.searchParams.set('seat', seat);
  history.replaceState({},'',url);
});

printBtn.addEventListener('click', ()=> window.print());

// CSV
csvBtn.addEventListener('click', ()=>{
  const rows = [];
  rows.push(['الحقل','القيمة']);
  rows.push(['الاسم', sName.textContent]);
  rows.push(['الصف/الشعبة', sClass.textContent]);
  rows.push(['العام الدراسي', sYear.textContent]);
  rows.push(['المجموع', totalEl.textContent]);
  rows.push(['النسبة', percentEl.textContent]);
  rows.push(['التقدير', bandEl.textContent]);

  const csv = rows.map(r=>r.map(x=>`"${(x??'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob(csv,'text/csv','result.csv');
});

// PDF (بالطباعة)
pdfBtn.addEventListener('click', ()=> window.print());

function downloadBlob(content, type, filename){
  const blob = new Blob([content], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// نبرات المساعد
toneEnc.addEventListener('click', ()=>{
  if(!aiEnable.checked) return;
  aiArea.value = aiArea.value + '\nنبرة مشجعة: أحسنت، استمر في هذا التفوق!';
});
toneCare.addEventListener('click', ()=>{
  if(!aiEnable.checked) return;
  aiArea.value = aiArea.value + '\nنبرة رعاية: سنعمل معًا على تحسين الجوانب التي تحتاج دعمًا.';
});
toneFirm.addEventListener('click', ()=>{
  if(!aiEnable.checked) return;
  aiArea.value = aiArea.value + '\nنبرة حازمة: الالتزام بالمذاكرة شرط أساسي لتحقيق نتائج أفضل.';
});

// تحميل تلقائي لو seat موجود
if(seatInput.value.trim()){
  loadStudent(seatInput.value.trim());
}
