// js/seed.js
import {
  doc, setDoc, getDoc, collection, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function runSeed({ db, activeYearId }) {
  const grades = [
    {id:"g1",  name:"الصف الأول الابتدائي",  stage:"primary",   order:1},
    {id:"g2",  name:"الصف الثاني الابتدائي", stage:"primary",   order:2},
    {id:"g3",  name:"الصف الثالث الابتدائي", stage:"primary",   order:3},
    {id:"g4",  name:"الصف الرابع الابتدائي", stage:"primary",   order:4},
    {id:"g5",  name:"الصف الخامس الابتدائي", stage:"primary",   order:5},
    {id:"g6",  name:"الصف السادس الابتدائي", stage:"primary",   order:6},
    {id:"g7",  name:"الصف الأول الإعدادي",   stage:"prep",      order:7},
    {id:"g8",  name:"الصف الثاني الإعدادي",  stage:"prep",      order:8},
    {id:"g9",  name:"الصف الثالث الإعدادي",  stage:"prep",      order:9},
    {id:"g10", name:"الصف الأول الثانوي",    stage:"secondary", order:10},
    {id:"g11", name:"الصف الثاني الثانوي",   stage:"secondary", order:11},
    {id:"g12", name:"الصف الثالث الثانوي",   stage:"secondary", order:12},
  ];

  // 1) درجات/صفوف
  for (const g of grades) {
    await setDoc(doc(db, "grades", g.id), {
      code: g.id, name: g.name, stage: g.stage, order: g.order,
      yearLength: 1, active: true, updatedAt: serverTimestamp(), createdAt: serverTimestamp()
    }, { merge: true });
  }

  // 2) مسارات اختيارية (ar/lang) لكل صف — لو مش عايزها تجاهلها في الواجهة
  for (const g of grades) {
    await setDoc(doc(db, "tracks", `${g.id}-ar`),   { code:"ar",   gradeId:g.id, name:"عربي",  active:true }, { merge:true });
    await setDoc(doc(db, "tracks", `${g.id}-lang`), { code:"lang", gradeId:g.id, name:"لغات", active:true }, { merge:true });
  }

  // 3) قالب فترات افتراضي (7 حصص)
  await setDoc(doc(db,"periodTemplates","default-7"), {
    name: "افتراضي (7 حصص)",
    periods: [
      {i:1, start:"08:00", end:"08:45"},
      {i:2, start:"08:55", end:"09:40"},
      {i:3, start:"09:50", end:"10:35"},
      {i:4, start:"10:45", end:"11:30"},
      {i:5, start:"11:40", end:"12:25"},
      {i:6, start:"12:35", end:"13:20"},
      {i:7, start:"13:30", end:"14:15"},
    ],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }, { merge:true });

  // 4) مادة عربية قياسية لكل صف (يمكن حذف الجزء ده لو مش محتاجه)
  for (const g of grades) {
    const sid = `arabic-${g.id}`;
    await setDoc(doc(db,"subjects", sid), {
      nameAr: "اللغة العربية", code:"arabic", gradeId: g.id,
      compulsory: true, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }, { merge:true });
  }

  // 5) إعدادات عامة مبدئية (لو مش موجودة)
  await setDoc(doc(db,"settings","global"), {
    instituteName: "معهد الدراسات الإدارية والفنية",
    activeYearId: activeYearId || "2025-2026",
    sections: ["A","B","C","D"],
    sectionsAr: ["أ","ب","ج","د"],
    updatedAt: serverTimestamp()
  }, { merge:true });

  return true;
}
