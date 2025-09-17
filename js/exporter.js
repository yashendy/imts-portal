// js/exporter.js

/* CSV */
export function exportAsCSV(studentInfo, monthsData){
  // رؤوس الأعمدة
  const headers = [
    "الاسم","الصف/الشعبة","رقم الجلوس","العام","الشهر",
    "المادة","الاختبار(10)","الواجبات(10)","المشاركة(10)","السلوك(10)","الإجمالي(40)","التقدير"
  ];

  const rows = [];

  monthsData.forEach(m=>{
    (m.subjects || []).forEach(sub=>{
      const c = sub.components || {};
      const test = c.test || {}, hw = c.homework || {}, part = c.participation || {}, beh = c.behavior || {};
      const t = test.absent ? "غ" : Number(test.score ?? 0);
      const h = hw.absent   ? "غ" : Number(hw.score ?? 0);
      const p = part.absent ? "غ" : Number(part.score ?? 0);
      const b = beh.absent  ? "غ" : Number(beh.score ?? 0);
      const rowTotal = (Number(test.score ?? 0) + Number(hw.score ?? 0) + Number(part.score ?? 0) + Number(beh.score ?? 0));
      const band = m.bandObj?.band || "";
      rows.push([
        studentInfo.fullName, studentInfo.classLabel, studentInfo.seat7, studentInfo.yearId, m.month,
        (sub.name || sub.subjectName || "-"), t, h, p, b, rowTotal, band
      ]);
    });
  });

  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `نتائج_${studentInfo.seat7 || "student"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* PDF سريع (بدون مكتبات): نافذة طباعة منسّقة */
export function exportAsPDF(studentInfo, monthsData, logoUrl=""){
  const win = window.open("", "_blank");
  if (!win){ alert("امنح المتصفح صلاحية فتح النوافذ المنبثقة للتصدير."); return; }

  const style = `
    <style>
      body{ font-family: "Tahoma", Arial; direction: rtl; padding: 16px; color:#111827; }
      .head{ display:flex; align-items:center; gap:12px; border-bottom:1px solid #e5e7eb; padding-bottom:10px; margin-bottom:12px; }
      .logo{ height:48px; }
      .muted{ color:#6b7280; }
      .row{ display:flex; gap:16px; flex-wrap:wrap; }
      table{ width:100%; border-collapse:collapse; margin-top:8px; }
      th,td{ border:1px solid #e5e7eb; padding:8px; text-align:center; font-size:13px; }
      th{ background:#f9fbff; }
      .badge{ display:inline-block; padding:4px 8px; border-radius:999px; border:1px solid #e5e7eb; font-size:12px; }
    </style>
  `;

  const info = `
    <div class="head">
      ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ``}
      <div>
        <h2 style="margin:0">تقرير نتائج الطالب</h2>
        <div class="muted">معهد الدراسات الإدارية والفنية</div>
      </div>
    </div>
    <div class="row" style="margin-bottom:8px">
      <div><strong>الاسم:</strong> ${studentInfo.fullName || "-"}</div>
      <div><strong>الصف/الشعبة:</strong> ${studentInfo.classLabel || "-"}</div>
    </div>
    <div class="row" style="margin-bottom:8px">
      <div><strong>رقم الجلوس:</strong> ${studentInfo.seat7 || "-"}</div>
      <div><strong>العام:</strong> ${studentInfo.yearId || "-"}</div>
    </div>
  `;

  // بناء جداول الشهور
  const blocks = monthsData.map(m=>{
    const header = `
      <h3 style="margin:14px 0 6px 0">شهر: ${m.month}</h3>
      <div>التقدير: <span class="badge">${m.bandObj?.band || "-"}</span> — إجمالي الشهر (من 40): <strong>${m.bandObj?.hideNumeric ? "—" : (m.total ?? "-")}</strong></div>
    `;
    const rows = (m.subjects || []).map(sub=>{
      const c = sub.components || {};
      const test = c.test || {}, hw = c.homework || {}, part = c.participation || {}, beh = c.behavior || {};
      const t = test.absent ? "غ" : Number(test.score ?? 0);
      const h = hw.absent   ? "غ" : Number(hw.score ?? 0);
      const p = part.absent ? "غ" : Number(part.score ?? 0);
      const b = beh.absent  ? "غ" : Number(beh.score ?? 0);
      const tot = (Number(test.score ?? 0) + Number(hw.score ?? 0) + Number(part.score ?? 0) + Number(beh.score ?? 0));
      return `<tr>
        <td>${sub.name || sub.subjectName || "-"}</td>
        <td>${t}</td><td>${h}</td><td>${p}</td><td>${b}</td><td>${tot}</td>
      </tr>`;
    }).join("");

    return `
      ${header}
      <table>
        <thead>
          <tr><th>المادة</th><th>الاختبار</th><th>الواجبات</th><th>المشاركة</th><th>السلوك</th><th>الإجمالي</th></tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="6">لا توجد مواد</td></tr>`}</tbody>
      </table>
    `;
  }).join("<hr style='border:none;border-top:1px solid #e5e7eb;margin:12px 0'/>");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8">${style}</head><body>${info}${blocks}</body></html>`);
  win.document.close();
  // ننتظر تحميل الصور/الصفحة ثم نفتح الطباعة
  win.onload = () => win.print();
}
