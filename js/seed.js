import {
  doc, setDoc, collection, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * تشغيل تهيئة سريعة: تنشئ صفوف، مواد، وفصول للسنة النشطة
 * الاستدعاء يتم من تبويب الإعدادات (للـ Owner فقط).
 */
export async function runSeed({db, activeYearId}){
  // 1) صفوف أساسية إن لم تكن موجودة
  const grades = [
    {id:"g10", name:"الصف الأول الثانوي", stage:"secondary", order:10},
    {id:"g11", name:"الصف الثاني الثانوي", stage:"secondary", order:11},
    {id:"g12", name:"الصف الثالث الثانوي", stage:"secondary", order:12}
  ];
  for(const g of grades){
    await setDoc(doc(db,"grades", g.id), g, { merge:true });
  }

  // 2) مواد أساسية لكل صف (مثال — عدّل كما تريد)
  const subjects = [
    {id:"arabic-g10", name:"اللغة العربية", gradeId:"g10", code:"arabic"},
    {id:"math-g10",   name:"الرياضيات",    gradeId:"g10", code:"math"},
    {id:"physics-g10",name:"الفيزياء",     gradeId:"g10", code:"physics"},
    {id:"arabic-g11", name:"اللغة العربية", gradeId:"g11", code:"arabic"},
    {id:"math-g11",   name:"الرياضيات",    gradeId:"g11", code:"math"},
    {id:"arabic-g12", name:"اللغة العربية", gradeId:"g12", code:"arabic"},
  ];
  for(const s of subjects){
    await setDoc(doc(db,"subjects", s.id), s, { merge:true });
  }

  // 3) أقسام افتراضية A..D من settings.global.sections أو افتراضي
  let sections = ["A","B","C","D"];
  try{
    const gs = await (await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")).getDoc(doc(db,"settings","global"));
    if(gs.exists() && Array.isArray(gs.data().sections)) sections = gs.data().sections;
  }catch{}

  // 4) إنشاء فصول لكل صف بالسنة النشطة
  for(const g of grades){
    for(const sec of sections){
      const classId = `${g.id}-${sec}`;
      await setDoc(doc(db,"classes", classId), {
        gradeId: g.id, section: sec, capacity: 35, active: true, yearId: activeYearId, createdAt: serverTimestamp()
      }, { merge:true });
    }
  }
}
