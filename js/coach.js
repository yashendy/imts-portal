// js/coach.js

// تحليل مبسّط لاستخراج نقاط القوة/الضعف شهريًا
function analyzeMonths(monthsData){
  const stats = {
    monthsCount: monthsData.length,
    highMonths: [], // شهور ممتازة
    weakMonths: [], // شهور بحاجة دعم
    byComponent: { test:0, homework:0, participation:0, behavior:0, count:0 },
  };

  monthsData.forEach(m => {
    if (m.bandObj?.band === "ممتاز مع الشكر") stats.highMonths.push(m.month);
    if (m.bandObj?.band === "بحاجة لدعم" || m.bandObj?.band === "غياب") stats.weakMonths.push(m.month);

    // متوسّطات مكوّنات تقريبية
    (m.subjects || []).forEach(sub=>{
      const c = sub.components || {};
      stats.byComponent.test          += Number(c.test?.score ?? 0);
      stats.byComponent.homework      += Number(c.homework?.score ?? 0);
      stats.byComponent.participation += Number(c.participation?.score ?? 0);
      stats.byComponent.behavior      += Number(c.behavior?.score ?? 0);
      stats.byComponent.count++;
    });
  });

  return stats;
}

export function generateLocalAdvice(studentInfo, monthsData){
  if (!monthsData?.length){
    return "من فضلك أدخل رقم الجلوس لعرض النتائج وتوليد ملخص ذكي.";
  }
  const st = analyzeMonths(monthsData);

  const lines = [];
  lines.push(`ملخص ${studentInfo.fullName || "الطالب"} للعام ${studentInfo.yearId || "-"}`);
  if (st.highMonths.length) lines.push(`أشهر التميز: ${st.highMonths.join("، ")}`);
  if (st.weakMonths.length) lines.push(`أشهر تحتاج دعم: ${st.weakMonths.join("، ")}`);

  if (st.byComponent.count > 0) {
    const denom = st.byComponent.count;
    const avg = {
      test:          (st.byComponent.test/denom).toFixed(1),
      homework:      (st.byComponent.homework/denom).toFixed(1),
      participation: (st.byComponent.participation/denom).toFixed(1),
      behavior:      (st.byComponent.behavior/denom).toFixed(1),
    };
    lines.push(`متوسطات المكوّنات (من 10): اختبار ${avg.test}، واجبات ${avg.homework}، مشاركة ${avg.participation}، سلوك ${avg.behavior}.`);

    // توصيات قصيرة
    const tips = [];
    if (avg.test < 7) tips.push("التركيز على حل نماذج قصيرة قبل كل اختبار.");
    if (avg.homework < 7) tips.push("تخصيص وقت يومي ثابت لإنجاز الواجبات والمتابعة.");
    if (avg.participation < 7) tips.push("تدريب على عرض شفهي قصير أو تلخيص الدروس بصوت مسموع.");
    if (avg.behavior < 7) tips.push("روتين نوم ثابت ومكافأة أسبوعية للسلوك الجيد والتواصل مع المعلم.");

    if (tips.length) lines.push("اقتراحات: " + tips.join(" "));
    else lines.push("استمروا على نفس الوتيرة 👍");
  }

  return lines.join(" ");
}

export function answerQuestionLocally(question, studentInfo, monthsData){
  const q = question.toLowerCase();
  const summary = generateLocalAdvice(studentInfo, monthsData);

  if (q.includes("تقدير") || q.includes("شرح")) {
    return "التقدير يعتمد على مجموع (اختبار + واجبات + مشاركة + سلوك) من 40. إذا حصل الطالب على 39.5 أو 40 يُمنح «ممتاز مع الشكر». إن كان الاختبار صفرًا تُسجَّل «غياب». أقل من 30 يعتبر «بحاجة لدعم». " + summary;
  }

  if (q.includes("خطة") || q.includes("أسبوع")) {
    return [
      "خطة أسبوعية مقترحة:",
      "- 20 دقيقة مراجعة يومية للدرس + حل 5 أسئلة قصيرة.",
      "- الواجب أولًا ثم 10 دقائق تلخيص صوتي.",
      "- يوميًا نظرة على الأخطاء السابقة قبل النوم.",
      "- نهاية الأسبوع: اختبار قصير منزلي ومكافأة بسيطة عند التحسن."
    ].join("\n");
  }

  if (q.includes("سلوك") || q.includes("التزام")) {
    return [
      "تحسين السلوك:",
      "- روتين نوم واستيقاظ ثابت.",
      "- جدول صغير لمكافأة أسبوعية للسلوك الإيجابي.",
      "- تواصل دوري مع المعلم لمتابعة التقدم.",
      "- تدريب على آداب الحوار والإنصات دقيقتين يوميًا."
    ].join("\n");
  }

  if (q.includes("اختبار") || q.includes("امتحان")) {
    return [
      "تقوية الاختبارات:",
      "- حل نماذج قصيرة مع تصحيح فوري للأخطاء.",
      "- تقسيم المنهج لأجزاء صغيرة على مدار الأسبوع.",
      "- مراجعة نشطة (استرجاع من الذاكرة) بدل القراءة فقط."
    ].join("\n");
  }

  return "تمت المعالجة محليًا. " + summary;
}
