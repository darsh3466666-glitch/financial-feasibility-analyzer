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
      const isCash = (!c.avgReceivables || c.avgReceivables === 0 || c.dso === 0 || c.dso < 1 || c.annualizedTurnover >= 365);
      return {
        'اسم العميل': c.clientName,
        'التصنيف': c.classLabel,
        'الجدوى': c.isFeasible ? 'مُجدي' : 'غير مُجدي',
        'إجمالي المبيعات': c.totalSales,
        'رصيد أول المدة': c.openingBalance,
        'رصيد آخر المدة': c.closingBalance,
        'متوسط المدينين': c.avgReceivables,
        'معدل الدوران السنوي': isCash ? 'نقدي ∞' : c.annualizedTurnover,
        'أيام التحصيل (DSO)': isCash ? '0 (سداد فوري)' : c.dso,
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
   * تصدير التقرير كملف PDF
   */
  async exportPDF() {
    showToast('جاري إنشاء ملف PDF...', 'info');

    try {
      const content = document.getElementById('results-area');
      if (!content) return;

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
        scrollY: -window.scrollY,
        logging: false
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = 277;
      let position = 10;
      let heightLeft = imgHeight;

      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(14);

      const imgData = canvas.toDataURL('image/png');

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `تقرير_الجدوى_التجارية_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      showToast('تم تصدير التقرير بنجاح', 'success');
    } catch (error) {
      console.error('PDF export error:', error);
      showToast('حدث خطأ أثناء التصدير', 'error');
    }
  }
};
