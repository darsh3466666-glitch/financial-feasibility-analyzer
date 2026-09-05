/* ============================================
   Exporter — تصدير PDF + Excel الشامل
   يشمل: تحليل العملاء + الجدوى + التسعير + أعمار الديون + الإعدادات
   ============================================ */

const Exporter = {
  /**
   * تصدير النتائج كملف Excel شامل
   */
  exportExcel(classifiedClients, salesByClass, summary, pricingReport, pricingSummary, settings) {
    const wb = XLSX.utils.book_new();

    // ═══ Sheet 1: جدول العملاء الشامل ═══
    const clientsData = classifiedClients.map(c => {
      const isCredit = c.isCredit;
      const isCash = (!c.avgReceivables || c.avgReceivables === 0 || c.dso === 0 || c.dso < 1 || c.annualizedTurnover >= 365 || isCredit);
      return {
        'اسم العميل': c.clientName,
        'التصنيف': c.classLabel,
        'طبيعة الرصيد': isCredit ? 'دائن (له رصيد / دفعة مقدمة)' : 'مدين (عليه مديونية)',
        'الجدوى': c.isFeasible ? 'مُجدي' : 'غير مُجدي',
        'إجمالي المبيعات': c.totalSales,
        'رصيد أول المدة': c.openingBalance,
        'رصيد آخر المدة': c.closingBalance,
        'متوسط المدينين': c.avgReceivables,
        'معدل الدوران السنوي': isCredit ? 'نقدي (دائن)' : (isCash ? 'نقدي ∞' : c.annualizedTurnover),
        'أيام التحصيل (DSO)': isCredit ? '0 (دائن)' : (isCash ? '0 (سداد فوري)' : c.dso),
        'نسبة الزيادة المقترحة %': isCash ? 0 : (c.totalMarkupPct || 0),
        'السعر المقترح للوحدة (جنيه)': (c.suggestedPrice && c.suggestedPrice > 0) ? c.suggestedPrice : (c.cashPrice || 0),
        'معدل التحصيل %': c.collectionRate,
        'عدد الفواتير': c.transactionCount,
        'فترة التحليل (أيام)': c.periodDays
      };
    });

    const ws1 = XLSX.utils.json_to_sheet(clientsData);
    XLSX.utils.book_append_sheet(wb, ws1, 'تحليل العملاء الشامل');

    // ═══ Sheet 2: تحليل حسب التصنيف ═══
    const classData = [];
    const classLabels = { good: 'A ممتاز', average: 'B عادي', poor: 'C بطيء' };

    for (const [key, data] of Object.entries(salesByClass)) {
      classData.push({
        'التصنيف': classLabels[key],
        'عدد العملاء': data.count,
        'إجمالي المبيعات النقدية': data.totalCashSales,
        'نسبة النقدية %': data.cashSalesPercentage,
        'إجمالي المبيعات الآجلة': data.totalCreditSales,
        'نسبة الآجلة %': data.creditSalesPercentage,
        'إجمالي المبيعات': data.totalSales,
        'نسبة المبيعات %': data.salesPercentage,
        'إجمالي المديونيات': data.totalReceivables,
        'نسبة المديونيات %': data.receivablesPercentage,
        'متوسط DSO': data.avgDSO
      });
    }

    const ws2 = XLSX.utils.json_to_sheet(classData);
    XLSX.utils.book_append_sheet(wb, ws2, 'تحليل حسب التصنيف');

    // ═══ Sheet 3: محرك التسعير ═══
    if (pricingReport && pricingReport.length > 0) {
      const pricingData = pricingReport.map(p => ({
        'اسم العميل': p.clientName,
        'التصنيف': p.classLabel,
        'أيام التحصيل': p.dso,
        'السعر النقدي': p.cashPrice,
        'تكلفة التمويل %': p.financingCostPct,
        'إجمالي الزيادة %': p.totalMarkupPct,
        'السعر المقترح': p.suggestedPrice,
        'فرق السعر': p.priceDifference
      }));

      const ws3 = XLSX.utils.json_to_sheet(pricingData);
      XLSX.utils.book_append_sheet(wb, ws3, 'محرك التسعير');
    }

    // ═══ Sheet 5: أعمار الديون ═══
    const agingData = classifiedClients.map(c => ({
      'اسم العميل': c.clientName,
      'التصنيف': c.classLabel,
      '0-30 يوم': c.agingBuckets?.current || 0,
      '31-60 يوم': c.agingBuckets?.days60 || 0,
      '61-90 يوم': c.agingBuckets?.days90 || 0,
      '> 90 يوم': c.agingBuckets?.over90 || 0,
      'الإجمالي': c.agingBuckets?.total || 0
    }));

    const ws5 = XLSX.utils.json_to_sheet(agingData);
    XLSX.utils.book_append_sheet(wb, ws5, 'أعمار الديون');

    // ═══ Sheet 6: الملخص والإعدادات ═══
    const summaryData = [
      { 'المؤشر': '═══ ملخص التحليل ═══', 'القيمة': '' },
      { 'المؤشر': 'إجمالي العملاء', 'القيمة': summary.totalClients },
      { 'المؤشر': 'إجمالي المبيعات', 'القيمة': summary.totalSales },
      { 'المؤشر': 'إجمالي المديونيات', 'القيمة': summary.totalReceivables },
      { 'المؤشر': 'متوسط أيام التحصيل (DSO)', 'القيمة': summary.avgDSO },
      { 'المؤشر': 'متوسط معدل الدوران', 'القيمة': summary.avgTurnover },
      { 'المؤشر': 'متوسط معدل التحصيل %', 'القيمة': summary.avgCollectionRate },
      { 'المؤشر': 'متوسط العائد على المديونية %', 'القيمة': summary.avgReturnOnAR },
      { 'المؤشر': 'متوسط مؤشر الجدوى %', 'القيمة': summary.avgFeasibilityIndex },
      { 'المؤشر': 'عدد العملاء المُجديين', 'القيمة': summary.feasibleCount },
      { 'المؤشر': 'عدد العملاء غير المُجديين', 'القيمة': summary.notFeasibleCount },
      { 'المؤشر': 'إجمالي تكلفة الفرصة البديلة', 'القيمة': summary.totalOpportunityCost },
      { 'المؤشر': 'إجمالي تكلفة التمويل', 'القيمة': summary.totalFinancingCost },
      { 'المؤشر': '', 'القيمة': '' },
      { 'المؤشر': '═══ إعدادات Macro Settings ═══', 'القيمة': '' },
      { 'المؤشر': 'سعر عائد الإيداع (CBE) %', 'القيمة': settings?.depositRate || 'غير محدد' },
      { 'المؤشر': 'سعر الإقراض البنكي %', 'القيمة': settings?.lendingRate || 'غير محدد' },
      { 'المؤشر': 'علاوة مخاطر الإدارة %', 'القيمة': settings?.riskPremiumPct || 'غير محدد' },
      { 'المؤشر': 'الحد الأدنى المقبول للعائد (Hurdle Rate) %', 'القيمة': summary.hurdleRate },
      { 'المؤشر': 'هامش الربح الإجمالي %', 'القيمة': settings?.profitMargin || 'غير محدد' },
      { 'المؤشر': 'السعر النقدي للوحدة (جنيه)', 'القيمة': settings?.cashPricePerTon || 'غير محدد' },
      { 'المؤشر': '', 'القيمة': '' },
      { 'المؤشر': '═══ علاوات المخاطر ═══', 'القيمة': '' },
      { 'المؤشر': 'A ممتاز %', 'القيمة': settings?.riskPremiums?.good || 0.5 },
      { 'المؤشر': 'B عادي %', 'القيمة': settings?.riskPremiums?.average || 2.0 },
      { 'المؤشر': 'C بطيء %', 'القيمة': settings?.riskPremiums?.poor || 4.5 },
      { 'المؤشر': '', 'القيمة': '' },
      { 'المؤشر': 'تاريخ التقرير', 'القيمة': new Date().toLocaleDateString('ar-EG') }
    ];

    const ws6 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws6, 'الملخص والإعدادات');

    // تحميل
    const fileName = `تحليل_الجدوى_التجارية_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showToast('تم تصدير الملف الشامل بنجاح (6 شيتات)', 'success');
  },

  /**
   * تصدير التقرير التنفيذي كملف PDF عالي الجودة مقسم لصفحات بدون تقطيع أو تجميد
   */
  async exportPDF(classifiedClients, salesByClass, summary, pricingReport, pricingSummary, settings) {
    showToast('جاري تجهيز التقرير التنفيذي PDF...', 'info');

    try {
      classifiedClients = classifiedClients || window.App?.state?.classifiedClients || [];
      salesByClass = salesByClass || window.App?.state?.salesByClass || {};
      summary = summary || window.App?.state?.summary || {};
      pricingReport = pricingReport || window.App?.state?.pricingReport || [];
      pricingSummary = pricingSummary || window.App?.state?.pricingSummary || {};
      settings = settings || (window.App?.readSettings ? window.App.readSettings() : {});

      if (!classifiedClients || classifiedClients.length === 0) {
        showToast('لا توجد بيانات متاحة للتصدير', 'error');
        return;
      }

      const totalClients = summary.totalClients || classifiedClients.length;
      const feasiblePct = totalClients > 0 ? (summary.feasibleCount / totalClients) * 100 : 0;
      const notFeasiblePct = totalClients > 0 ? (summary.notFeasibleCount / totalClients) * 100 : 0;
      const cashPrice = settings.cashPricePerTon || (pricingReport[0]?.cashPrice) || 20000;
      const depositRate = settings.depositRate || settings.interestRate || 19;

      // التقاط صور الرسوم البيانية مباشرة من الكانفاس الحالية (فورية وبجودة 100%)
      const dsoChartImg = document.getElementById('chart-dso')?.toDataURL('image/png') || null;
      const scatterChartImg = document.getElementById('chart-feasibility-scatter')?.toDataURL('image/png') || null;
      const agingChartImg = document.getElementById('chart-aging')?.toDataURL('image/png') || null;
      const barChartImg = document.getElementById('chart-feasibility')?.toDataURL('image/png') || null;

      // اختيار أعلى 22 عميلاً من حيث المديونية والمبيعات لعرضهم في الصفحة الثالثة
      const topClients = [...classifiedClients]
        .sort((a, b) => (b.avgReceivables + b.totalSales * 0.1) - (a.avgReceivables + a.totalSales * 0.1))
        .slice(0, 22);

      // إنشاء حاوية التقرير المؤقتة (مقسمة لصفحات A4 بدقة 794x1123 بكسل)
      const container = document.createElement('div');
      container.id = 'pdf-report-render-target';
      container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 794px;
        background: #ffffff;
        color: #0f172a;
        font-family: 'Alexandria', 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
        direction: rtl;
        z-index: -9999;
      `;

      // ═══════════════════════════════════════════
      // الصفحة 1: الغلاف التنفيذي + المؤشرات + الجدوى + التسعير
      // ═══════════════════════════════════════════
      const page1HTML = `
        <div class="pdf-page" style="width: 794px; height: 1123px; padding: 28px 32px; box-sizing: border-box; background: #ffffff; position: relative; overflow: hidden;">
          <!-- الهيدر المؤسسي -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <h1 style="margin: 0; font-size: 20px; color: #0f172a; font-weight: 800;">تقرير التحليل المالي والجدوى الاقتصادية</h1>
              <p style="margin: 4px 0 0 0; font-size: 11.5px; color: #64748b;">تحليل كفاءة التحصيل، دوران المدينين، والجدوى الاستراتيجية لمحفظة العملاء</p>
            </div>
            <div style="text-align: left; font-size: 10.5px; color: #334155; line-height: 1.5;">
              <div><strong>تاريخ التقرير:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
              <div><strong>فترة التحليل:</strong> ${summary.periodDays || 365} يوم</div>
              <div><strong>السعر النقدي الأساسي:</strong> ${formatNumber(cashPrice)} جنيه</div>
              <div><strong>عائد الإيداع البنكي:</strong> ${depositRate}% سنوياً</div>
            </div>
          </div>

          <!-- لوحة المؤشرات الرئيسية -->
          <h3 style="margin: 0 0 8px 0; font-size: 13.5px; color: #0369a1; border-right: 4px solid #0284c7; padding-right: 8px;">1. لوحة المؤشرات الرئيسية للشركة</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">إجمالي العملاء</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 2px 0;">${formatNumber(totalClients)}</div>
              <div style="font-size: 9.5px; border-top: 1px dashed #cbd5e1; padding-top: 3px; display: flex; justify-content: space-between;">
                <span style="color: #059669; font-weight: 700;">مُجدي: ${formatNumber(summary.feasibleCount)} (${formatPercent(feasiblePct)})</span>
                <span style="color: #dc2626; font-weight: 700;">غير مُجدي: ${formatNumber(summary.notFeasibleCount)} (${formatPercent(notFeasiblePct)})</span>
              </div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">إجمالي المبيعات</div>
              <div style="font-size: 18px; font-weight: 800; color: #d97706; margin: 2px 0;">${formatNumber(summary.totalSales)} جنيه</div>
              <div style="font-size: 9.5px; color: #64748b;">صافي مبيعات الفترة المسجلة</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">متوسط أيام التحصيل (DSO)</div>
              <div style="font-size: 18px; font-weight: 800; color: #d97706; margin: 2px 0;">${formatNumber(summary.avgDSO, 0)} يوم</div>
              <div style="font-size: 9.5px; color: #64748b;">متوسط دورة السداد المرجحة</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">إجمالي متوسط حسابات المدينين</div>
              <div style="font-size: 18px; font-weight: 800; color: #dc2626; margin: 2px 0;">${formatNumber(summary.totalReceivables)} جنيه</div>
              <div style="font-size: 9.5px; color: #64748b;">متوسط رأس المال المعطل بالسوق</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">معدل دوران المديونية السنوي</div>
              <div style="font-size: 18px; font-weight: 800; color: #059669; margin: 2px 0;">${formatNumber(summary.avgTurnover, 1)} مرة</div>
              <div style="font-size: 9.5px; color: #64748b;">سنوياً (متوافق مع متوسط السداد)</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">معدل التحصيل العام</div>
              <div style="font-size: 18px; font-weight: 800; color: #0284c7; margin: 2px 0;">${formatPercent(summary.avgCollectionRate)}</div>
              <div style="font-size: 9.5px; color: #64748b;">نسبة المحصل إلى إجمالي المستحق</div>
            </div>
          </div>

          <!-- مؤشرات الجدوى وتكلفة الأموال -->
          <h3 style="margin: 0 0 8px 0; font-size: 13.5px; color: #0369a1; border-right: 4px solid #0284c7; padding-right: 8px;">2. تقييم الجدوى وتكلفة الأموال المعطلة</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">متوسط نقاط الجودة الشاملة</div>
              <div style="font-size: 17px; font-weight: 800; color: ${summary.avgQualityScore >= 50 ? '#059669' : '#dc2626'}; margin: 2px 0;">
                ${formatNumber(summary.avgQualityScore, 1)} / 100
              </div>
              <div style="font-size: 9px; color: #64748b;">تقييم متكامل للسرعة والتحصيل</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">نسبة الخسارة الخفية</div>
              <div style="font-size: 17px; font-weight: 800; color: #dc2626; margin: 2px 0;">
                ${formatPercent(summary.avgHiddenLossPct)}
              </div>
              <div style="font-size: 9px; color: #64748b;">كنسبة من المبيعات بسبب فترة الانتظار</div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 10.5px; color: #64748b;">تكلفة الفرصة البديلة بالجنيه</div>
              <div style="font-size: 17px; font-weight: 800; color: #d97706; margin: 2px 0;">
                ${formatNumber(summary.totalOpportunityCost)} جنيه
              </div>
              <div style="font-size: 9px; color: #64748b;">عائد الإيداع الضائع عن الفترة</div>
            </div>
          </div>

          <!-- محرك التسعير الديناميكي -->
          <h3 style="margin: 0 0 8px 0; font-size: 13.5px; color: #0369a1; border-right: 4px solid #0284c7; padding-right: 8px;">3. ملخص محرك التسعير الديناميكي حسب الفئات</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 20px;">
            ${['good', 'average', 'poor'].map(key => {
              const p = pricingSummary[key] || { avgSuggestedPrice: cashPrice, avgMarkup: 0, count: 0 };
              const meta = {
                good: { t: 'الفئة A ممتاز (سداد سريع)', c: '#059669', bg: '#ecfdf5', bc: '#a7f3d0' },
                average: { t: 'الفئة B عادي (سداد متوسط)', c: '#d97706', bg: '#fffbeb', bc: '#fde68a' },
                poor: { t: 'الفئة C بطيء (تأخير عالي)', c: '#dc2626', bg: '#fef2f2', bc: '#fecaca' }
              }[key];
              return `
                <div style="background: ${meta.bg}; border: 1px solid ${meta.bc}; border-radius: 6px; padding: 8px 10px;">
                  <div style="font-size: 11px; font-weight: 700; color: ${meta.c};">${meta.t} (${p.count || 0} عميل)</div>
                  <div style="margin-top: 4px; font-size: 10px; color: #475569;">متوسط السعر المقترح:</div>
                  <div style="font-size: 16px; font-weight: 800; color: ${meta.c};">${formatNumber(p.avgSuggestedPrice)} جنيه</div>
                  <div style="font-size: 10.5px; font-weight: 700; color: ${meta.c}; margin-top: 2px;">متوسط الزيادة: +${formatPercent(p.avgMarkup)}</div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- تذييل الصفحة 1 -->
          <div style="position: absolute; bottom: 20px; left: 32px; right: 32px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            <span>محلل الجدوى المالية والتجارية — التقرير التنفيذي</span>
            <span>صفحة 1 من 3</span>
          </div>
        </div>
      `;

      // ═══════════════════════════════════════════
      // الصفحة 2: أعمار الديون + تحليل المبيعات + الرسوم البيانية
      // ═══════════════════════════════════════════
      const aging = summary.totalAging || {};
      const agingTotal = aging.total || 1;
      const agingBuckets = [
        { label: '0 - 30 يوم', amount: aging.current || 0, color: '#059669' },
        { label: '31 - 60 يوم', amount: aging.days60 || 0, color: '#d97706' },
        { label: '61 - 90 يوم', amount: aging.days90 || 0, color: '#f97316' },
        { label: '> 90 يوم', amount: aging.over90 || 0, color: '#dc2626' }
      ];

      const page2HTML = `
        <div class="pdf-page" style="width: 794px; height: 1123px; padding: 28px 32px; box-sizing: border-box; background: #ffffff; position: relative; overflow: hidden;">
          <div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 14px;">
            <h2 style="margin: 0; font-size: 17px; color: #0f172a; font-weight: 800;">4. هيكل أعمار الديون وتحليل الفئات والرسوم البيانية</h2>
          </div>

          <!-- جدول أعمار الديون -->
          <h4 style="margin: 0 0 6px 0; font-size: 12.5px; color: #0369a1;">أعمار الديون المستحقة بالسوق (Aging Structure)</h4>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px;">
            ${agingBuckets.map(b => `
              <div style="border: 1px solid #e2e8f0; border-top: 3px solid ${b.color}; border-radius: 4px; padding: 6px 8px; background: #f8fafc;">
                <div style="font-size: 10px; color: #64748b;">${b.label}</div>
                <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 2px 0;">${formatNumber(b.amount)} جنيه</div>
                <div style="font-size: 9.5px; color: ${b.color}; font-weight: 700;">${formatPercent((b.amount / agingTotal) * 100)}</div>
              </div>
            `).join('')}
          </div>

          <!-- جدول تحليل المبيعات والمديونية حسب الفئات -->
          <h4 style="margin: 0 0 6px 0; font-size: 12.5px; color: #0369a1;">تحليل المحفظة والسيولة حسب تصنيف السداد</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 14px;">
            <thead>
              <tr style="background: #f1f5f9; color: #334155; text-align: right; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 6px 8px;">التصنيف</th>
                <th style="padding: 6px 8px;">عدد العملاء</th>
                <th style="padding: 6px 8px;">المتحصلات</th>
                <th style="padding: 6px 8px;">المديونية المتبقية</th>
                <th style="padding: 6px 8px;">متوسط DSO</th>
              </tr>
            </thead>
            <tbody>
              ${['good', 'average', 'poor'].map(k => {
                const d = salesByClass[k] || {};
                const labels = { good: 'A ممتاز', average: 'B عادي', poor: 'C بطيء' };
                const colors = { good: '#059669', average: '#d97706', poor: '#dc2626' };
                return `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 6px 8px; font-weight: 700; color: ${colors[k]};">${labels[k]}</td>
                    <td style="padding: 6px 8px;">${formatNumber(d.count || 0)}</td>
                    <td style="padding: 6px 8px; color: #059669; font-weight: 600;">${formatNumber(d.totalCashSales || 0)} جنيه</td>
                    <td style="padding: 6px 8px; color: #d97706; font-weight: 600;">${formatNumber(d.totalCreditSales || 0)} جنيه</td>
                    <td style="padding: 6px 8px;">${formatNumber(d.avgDSO || 0, 0)} يوم</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- الرسوم البيانية الأربعة (شبكة 2x2) -->
          <h4 style="margin: 0 0 6px 0; font-size: 12.5px; color: #0369a1;">الرسوم البيانية التحليلية</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #ffffff;">
              <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">أيام التحصيل لأعلى العملاء تأخيراً</div>
              ${dsoChartImg ? `<img src="${dsoChartImg}" style="width: 100%; height: 160px; object-fit: contain;">` : '<div style="height:160px; display:flex; align-items:center; justify-content:center; color:#94a3b8;">رسم DSO</div>'}
            </div>
            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #ffffff;">
              <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">مؤشر الجودة والجدوى مقابل DSO</div>
              ${scatterChartImg ? `<img src="${scatterChartImg}" style="width: 100%; height: 160px; object-fit: contain;">` : '<div style="height:160px; display:flex; align-items:center; justify-content:center; color:#94a3b8;">رسم الجدوى</div>'}
            </div>
            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #ffffff;">
              <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">أعمار الديون حسب التصنيف</div>
              ${agingChartImg ? `<img src="${agingChartImg}" style="width: 100%; height: 160px; object-fit: contain;">` : '<div style="height:160px; display:flex; align-items:center; justify-content:center; color:#94a3b8;">رسم الأعمار</div>'}
            </div>
            <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #ffffff;">
              <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">مقارنة نقاط الجدوى مع حد الأمان (50)</div>
              ${barChartImg ? `<img src="${barChartImg}" style="width: 100%; height: 160px; object-fit: contain;">` : '<div style="height:160px; display:flex; align-items:center; justify-content:center; color:#94a3b8;">رسم المقارنة</div>'}
            </div>
          </div>

          <!-- تذييل الصفحة 2 -->
          <div style="position: absolute; bottom: 20px; left: 32px; right: 32px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            <span>محلل الجدوى المالية والتجارية — التقرير التنفيذي</span>
            <span>صفحة 2 من 3</span>
          </div>
        </div>
      `;

      // ═══════════════════════════════════════════
      // الصفحة 3: جدول أولويات الإدارة وكبار الحسابات
      // ═══════════════════════════════════════════
      const page3HTML = `
        <div class="pdf-page" style="width: 794px; height: 1123px; padding: 28px 32px; box-sizing: border-box; background: #ffffff; position: relative; overflow: hidden;">
          <div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px;">
            <h2 style="margin: 0; font-size: 17px; color: #0f172a; font-weight: 800;">5. جدول أولويات الإدارة وكبار العملاء (أعلى الحسابات تأثيراً)</h2>
            <p style="margin: 2px 0 0 0; font-size: 10.5px; color: #64748b;">قائمة أولويات المتابعة الائتمانية والتسعير المقترح لأهم الحسابات</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 16px;">
            <thead>
              <tr style="background: #0f172a; color: #ffffff; text-align: right;">
                <th style="padding: 5px 6px; border-radius: 0 4px 0 0;">م</th>
                <th style="padding: 5px 6px;">اسم العميل</th>
                <th style="padding: 5px 6px;">التصنيف</th>
                <th style="padding: 5px 6px;">الجدوى</th>
                <th style="padding: 5px 6px;">إجمالي المبيعات</th>
                <th style="padding: 5px 6px;">متوسط المدينين</th>
                <th style="padding: 5px 6px;">DSO</th>
                <th style="padding: 5px 6px;">نسبة الزيادة</th>
                <th style="padding: 5px 6px; border-radius: 4px 0 0 0;">السعر المقترح</th>
              </tr>
            </thead>
            <tbody>
              ${topClients.map((c, idx) => {
                const isCash = (!c.avgReceivables || c.avgReceivables === 0 || c.dso === 0 || c.dso < 1 || c.annualizedTurnover >= 365 || c.isCredit);
                const classColors = { good: '#059669', average: '#d97706', poor: '#dc2626' };
                const cColor = classColors[c.classification] || '#475569';
                const bgRow = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                const priceVal = (c.suggestedPrice && c.suggestedPrice > 0) ? c.suggestedPrice : (c.cashPrice || cashPrice);
                return `
                  <tr style="background: ${bgRow}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 4px 6px; color: #64748b;">${idx + 1}</td>
                    <td style="padding: 4px 6px; font-weight: 700; color: #0f172a; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.clientName}</td>
                    <td style="padding: 4px 6px;"><span style="color: ${cColor}; font-weight: 700;">${c.classLabel}</span></td>
                    <td style="padding: 4px 6px;"><span style="color: ${c.isFeasible ? '#059669' : '#dc2626'}; font-weight: 700;">${c.isFeasible ? 'مُجدي' : 'غير مُجدي'}</span></td>
                    <td style="padding: 4px 6px;">${formatNumber(c.totalSales)}</td>
                    <td style="padding: 4px 6px;">${formatNumber(c.avgReceivables)}</td>
                    <td style="padding: 4px 6px;">${isCash ? '0' : formatNumber(c.dso, 0)} يوم</td>
                    <td style="padding: 4px 6px; color: ${cColor}; font-weight: 700;">${isCash ? '0.0%' : '+' + formatPercent(c.totalMarkupPct || 0)}</td>
                    <td style="padding: 4px 6px; color: ${cColor}; font-weight: 800;">${formatNumber(priceVal)} ج</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- صندوق الاعتماد والتوقيع -->
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; background: #f8fafc; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 10.5px; color: #334155; line-height: 1.6;">
              <div><strong>ملاحظة إدارية:</strong> البيانات التفصيلية الكاملة لجميع الـ <strong>${formatNumber(totalClients)}</strong> عميل متوفرة في ملف Excel الشامل المرفق.</div>
              <div style="color: #64748b; font-size: 9.5px;">تم استخراج هذا التقرير وتدقيقه آلياً وفقاً لقواعد التحليل المالي والائتماني المعتمدة.</div>
            </div>
            <div style="border: 1px dashed #94a3b8; border-radius: 4px; padding: 8px 16px; text-align: center; min-width: 140px; background: #ffffff;">
              <div style="font-size: 10px; color: #64748b;">اعتماد الإدارة المالية</div>
              <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-top: 14px;">التوقيع: .....................</div>
            </div>
          </div>

          <!-- تذييل الصفحة 3 -->
          <div style="position: absolute; bottom: 20px; left: 32px; right: 32px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            <span>محلل الجدوى المالية والتجارية — التقرير التنفيذي</span>
            <span>صفحة 3 من 3</span>
          </div>
        </div>
      `;

      container.innerHTML = page1HTML + page2HTML + page3HTML;
      document.body.appendChild(container);

      // استدعاء jsPDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = container.querySelectorAll('.pdf-page');

      // معالجة كل صفحة كلقطة مستقلة تماماً لحماية المتصفح من التجمد ومنع تقطيع النصوص
      for (let i = 0; i < pages.length; i++) {
        const pageCanvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      // إزالة الحاوية المؤقتة وحفظ الملف
      document.body.removeChild(container);

      const fileName = `تقرير_الجدوى_التنفيذي_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      showToast('تم تصدير التقرير التنفيذي PDF بنجاح (3 صفحات فائقة الوضوح)', 'success');
    } catch (error) {
      console.error('PDF export error:', error);
      const tempTarget = document.getElementById('pdf-report-render-target');
      if (tempTarget) document.body.removeChild(tempTarget);
      showToast('حدث خطأ أثناء تصدير PDF: ' + error.message, 'error');
    }
  }
};
