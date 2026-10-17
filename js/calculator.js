/* ============================================
   Calculator — المعادلات المالية الشاملة
   يغطي الأقسام الثلاثة من التقرير الفني:
   1. دوران المديونية وDSO وCollection Rate
   2. الجدوى وتكلفة الفرصة البديلة (Return on AR, Feasibility Index)
   3. بيانات الإدخال لمحرك التسعير
   ============================================ */

/**
 * حساب كل المؤشرات المالية لكل عميل
 * @param {Object} parsedData - البيانات المحللة { clients: Map<string, records[]> }
 * @param {Object} settings - الإعدادات الموسعة
 * @returns {Array} نتائج التحليل لكل عميل
 */
function calculateAll(parsedData, settings) {
  const results = [];

  // 1. حساب الفترة الزمنية العامة تلقائياً من تواريخ كل الحركات (فواتير وسدادات)
  let globalStartDate = null;
  let globalEndDate = null;

  for (const [, records] of parsedData.clients) {
    for (const r of records) {
      if (r.date instanceof Date && !isNaN(r.date)) {
        if (!globalStartDate || r.date < globalStartDate) globalStartDate = r.date;
        if (!globalEndDate || r.date > globalEndDate) globalEndDate = r.date;
      }
    }
  }

  let autoPeriodDays = 365;
  if (globalStartDate && globalEndDate && globalEndDate > globalStartDate) {
    const diffDays = Math.ceil((globalEndDate - globalStartDate) / (1000 * 60 * 60 * 24));
    if (diffDays >= 1) {
      autoPeriodDays = diffDays;
    }
  }

  // إذا كانت الفترة محددة كـ auto أو غير مخصصة، نستخدم الفترة التلقائية المحسوبة من البيانات
  const effectivePeriodDays = (settings.periodType === 'auto' || !settings.isCustomPeriod) 
    ? autoPeriodDays 
    : (settings.defaultPeriodDays || 365);

  const effectiveSettings = {
    ...settings,
    defaultPeriodDays: effectivePeriodDays,
    detectedPeriodDays: autoPeriodDays,
    globalStartDate,
    globalEndDate
  };

  for (const [clientName, records] of parsedData.clients) {
    if (!records || records.length === 0) continue;
    
    // استبعاد فقط صفوف الإجماليات العامة في شيت الإكسل
    const nameLower = clientName.toLowerCase().trim();
    const isExcludedName = 
      nameLower === 'اجمالي عام' || 
      nameLower === 'إجمالي عام' || 
      nameLower === 'الاجمالي' || 
      nameLower === 'الإجمالي' || 
      nameLower === 'total' || 
      nameLower === 'grand total';

    if (isExcludedName) {
      continue;
    }

    const result = calculateClientMetrics(clientName, records, effectiveSettings);
    
    // استبعاد فقط الحسابات الصفرية الخاملة بالكامل (مبيعات = 0، وأرصدة = 0، وبدون أي سدادات)
    if (!result || (
      result.totalSales <= 0 &&
      (!result.closingBalance || Math.abs(result.closingBalance) === 0) &&
      (!result.openingBalance || Math.abs(result.openingBalance) === 0) &&
      (!result.totalPayments || Math.abs(result.totalPayments) === 0)
    )) {
      continue;
    }

    results.push(result);
  }

  return results;
}

/**
 * حساب المؤشرات المالية لعميل واحد — الأقسام الثلاثة
 * يعتمد كلياً على محرك التسوية الزمنية FIFO بين الفواتير والسدادات
 */
function calculateClientMetrics(clientName, records, settings) {
  const periodDays = settings.defaultPeriodDays || 365;
  let startDate = settings.globalStartDate || null;
  let endDate = settings.globalEndDate || null;

  const validRecordsWithDate = records.filter(r => r.date instanceof Date && !isNaN(r.date));
  if (validRecordsWithDate.length >= 2) {
    if (!startDate) startDate = validRecordsWithDate[0].date;
    if (!endDate) endDate = validRecordsWithDate[validRecordsWithDate.length - 1].date;
  }

  // استخراج رصيد آخر المدة ورصيد أول المدة الصريحين من السجلات
  const explicitClosing = getExplicitClosingBalance(records);
  let openingBalance = getOpeningBalance(records);

  // إذا لم يتوفر رصيد أول المدة (أو كان صفر) بينما يتوفر رصيد آخر مدة صريح من شيت الأرصدة / تقرير ERP:
  // نستنتج رصيد أول المدة بالمعادلة المحاسبية المعتمدة: رصيد أول المدة = رصيد آخر المدة + السدادات - المبيعات الصافية
  if ((!openingBalance || openingBalance === 0) && explicitClosing !== null) {
    let rawSales = 0;
    let rawReturns = 0;
    let rawPayments = 0;
    for (const r of records) {
      const inv = Number(r.invoiceAmount) || 0;
      const pay = Number(r.paymentAmount) || 0;
      if (inv > 0) rawSales += inv;
      else if (inv < 0) rawReturns += Math.abs(inv);
      if (pay > 0) rawPayments += pay;
    }
    const netSales = Math.max(0, rawSales - rawReturns);
    const impliedOp = roundTo(explicitClosing + rawPayments - netSales, 2);
    if (impliedOp > 0.01) {
      openingBalance = impliedOp;
    }
  }

  // ═══════════════════════════════════════════════
  // تشغيل المحرك الزمني لتسوية الفواتير والمقبوضات
  // ═══════════════════════════════════════════════
  const timeline = reconcileClientTimeline(records, openingBalance, settings);

  const totalSales = timeline.totalSales;
  const totalPayments = timeline.totalPayments;
  const closingBalance = timeline.closingBalance;
  const isCreditClient = timeline.isCreditClient;
  const actualCollectionDays = timeline.actualCollectionDays;
  const collectionRate = timeline.collectionRate;
  const agingBuckets = timeline.agingBuckets;

  // 1. بيان الأيام الخاص بالعميل (من تاريخ أول حركة حتى تاريخ نهاية الفترة) دون توحيد الفترة
  let clientPeriodDays = periodDays;
  const clientFirstDate = timeline.clientFirstDate || startDate;
  const asOfDate = endDate || settings.globalEndDate || timeline.clientLastDate;
  if (clientFirstDate && asOfDate) {
    const tenureDiff = (asOfDate.getTime() - clientFirstDate.getTime()) / (1000 * 60 * 60 * 24);
    if (tenureDiff > 0) {
      clientPeriodDays = roundTo(tenureDiff, 2);
    }
  }
  clientPeriodDays = Math.max(1, clientPeriodDays);

  // 2. متوسط رصيد العميل وفق معادلة الشيت الدقيقة: (أول المدة + آخر المدة) / 2
  let avgReceivables = 0;
  if (!isCreditClient && (openingBalance > 0 || closingBalance > 0)) {
    avgReceivables = roundTo((Math.max(0, openingBalance) + Math.max(0, closingBalance)) / 2, 2);
  }

  // 3. دوران العميل عن فترة تعامله الخاصة فقط (بدون تحويل سنوي 365)
  let arTurnover = 0;
  if (totalSales > 0 && avgReceivables > 0) {
    arTurnover = roundTo(totalSales / avgReceivables, 2);
  }

  // 4. معدل دوران العميل بالأيام (DSO) = بيان الأيام الخاصة بالعميل ÷ دوران العميل
  let dso = 0;
  if (isCreditClient || (closingBalance <= 0 && openingBalance <= 0)) {
    dso = 0;
  } else if (arTurnover > 0) {
    dso = roundTo(clientPeriodDays / arTurnover, 2);
  } else if (closingBalance > 0) {
    dso = roundTo(clientPeriodDays, 1);
  }
  const annualizedTurnover = arTurnover; // للتوافق بدون مضاعفة دبلجة

  // ═══════════════════════════════════════════════
  // القسم الثاني: الجدوى وتكلفة الفرصة البديلة
  // ═══════════════════════════════════════════════
  const depositRate = settings.depositRate || settings.interestRate || 19;
  const lendingRate = settings.lendingRate || settings.interestRate || 24;
  const profitMargin = settings.profitMargin || 0;

  const riskPremiumMgmt = settings.riskPremiumPct || 0;
  const hurdleRate = depositRate + riskPremiumMgmt;

  // الخسارة الخفية وتكلفة التمويل
  const isSettledOrCash = isCreditClient || closingBalance <= 0 || avgReceivables === 0 || dso === 0 || dso < 1;
  const hiddenLossPct = isSettledOrCash ? 0 : ((dso / 365) * depositRate);
  const opportunityCost = isSettledOrCash ? 0 : (avgReceivables * (depositRate / 100) * (periodDays / 365));
  const financingCost = isSettledOrCash ? 0 : (avgReceivables * (lendingRate / 100) * (periodDays / 365));

  const grossMargin = profitMargin;
  const returnOnAR = grossMargin * annualizedTurnover;
  const feasibilityIndex = returnOnAR - hurdleRate;

  // نقاط الجودة الشاملة (من 100 نقطة)
  const scoreCollection = (Math.min(100, collectionRate) / 100) * 35;
  const scoreDSO = Math.max(0, 40 - (dso / 120) * 40);
  const scoreTurnover = Math.min(25, (annualizedTurnover / 12) * 25);
  const qualityScore = (isCreditClient || isSettledOrCash) ? 100 : (scoreCollection + scoreDSO + scoreTurnover);

  // تقييم الجدوى الاقتصادية
  const isInstantCash = isCreditClient || isSettledOrCash || (!avgReceivables || avgReceivables === 0 || dso === 0 || dso < 1 || annualizedTurnover >= 365);
  let isFeasible = false;
  if (isInstantCash) {
    isFeasible = true;
  } else {
    const totalRemainingDebt = closingBalance > 0 ? closingBalance : (agingBuckets?.total || 0);
    const over90Ratio = totalRemainingDebt > 0 ? ((agingBuckets?.over90 || 0) / totalRemainingDebt) : 0;
    const carryingCostPct = (dso / 365) * depositRate;
    const isProfitable = (grossMargin > carryingCostPct) || (dso <= 60);
    const hasHealthyAging = over90Ratio <= 0.40;
    const hasBasicCollection = collectionRate >= 30;

    isFeasible = (isProfitable && hasHealthyAging && hasBasicCollection && dso <= 120);
  }

  // ═══════════════════════════════════════════════
  // القسم الثالث: بيانات التسعير
  // ═══════════════════════════════════════════════
  const financingCostPct = isCreditClient ? 0 : ((lendingRate / 365) * dso);
  const requiredMarkup = (isCreditClient || annualizedTurnover <= 0) ? 0 : (lendingRate / annualizedTurnover);
  const feasibilityGap = profitMargin - requiredMarkup;

  return {
    clientName,

    // القسم الأول — دوران المديونية ومؤشرات النمط الزمني
    totalSales: roundTo(totalSales, 2),
    totalGrossSales: roundTo(timeline.totalGrossSales, 2),
    totalReturns: roundTo(timeline.totalReturns, 2),
    totalPayments: roundTo(totalPayments, 2),
    openingBalance: roundTo(openingBalance, 2),
    closingBalance: roundTo(closingBalance, 2),
    avgReceivables: roundTo(avgReceivables, 2),
    arTurnover: roundTo(arTurnover, 2),
    annualizedTurnover: roundTo(annualizedTurnover, 2),
    dso: roundTo(dso, 1),
    actualCollectionDays: roundTo(actualCollectionDays, 1),
    collectionRate: roundTo(collectionRate, 1),
    periodSalesCollectionRate: roundTo(timeline.periodSalesCollectionRate, 1),
    agingBuckets,
    isCredit: isCreditClient,
    creditAmount: isCreditClient ? Math.abs(closingBalance) : 0,
    statusLabel: isCreditClient ? 'دائن (له رصيد)' : 'مدين (عليه مديونية)',

    // الحقول الرقابية ومؤشرات كفاية البيانات
    matchedPaidAmount: timeline.matchedPaidAmount,
    unappliedPayments: timeline.unappliedPayments,
    overdueAmount: timeline.overdueAmount,
    oldestOpenInvoiceDays: timeline.oldestOpenInvoiceDays,
    clientTenureDays: timeline.clientTenureDays,
    dataCoverage: timeline.dataCoverage,
    creditExposure: timeline.creditExposure,
    peakExposure: timeline.peakExposure,
    statementLedger: timeline.statementLedger,

    // القسم الثاني — الجدوى وجودة العميل
    hurdleRate: roundTo(hurdleRate, 2),
    grossMargin: roundTo(grossMargin, 2),
    returnOnAR: roundTo(returnOnAR, 2),
    feasibilityIndex: roundTo(feasibilityIndex, 2),
    qualityScore: roundTo(qualityScore, 1),
    hiddenLossPct: roundTo(hiddenLossPct, 2),
    isFeasible,
    opportunityCost: roundTo(opportunityCost, 2),
    financingCost: roundTo(financingCost, 2),

    // القسم الثالث — بيانات التسعير
    financingCostPct: roundTo(financingCostPct, 2),
    requiredMarkup: roundTo(requiredMarkup, 2),
    currentMargin: roundTo(profitMargin, 2),
    feasibilityGap: roundTo(feasibilityGap, 2),

    // بيانات الفترة الخاصة بالعميل
    periodDays: clientPeriodDays,
    clientPeriodDays,
    startDate: clientFirstDate || startDate,
    endDate: asOfDate || endDate,
    transactionCount: records.length
  };
}

/**
 * المحرك الزمني لتسوية الفواتير والمقبوضات (Chronological FIFO Matching & Ledger)
 * يعتمد المعايير المحاسبية الدقيقة لقطاع التجارة وتجارة الأعلاف:
 * 1. تخصيص كل دفعة لأقدم دين مفتوح (FIFO) مع دعم السداد الجزئي
 * 2. احتساب أيام التحصيل الفعلية المرجحة للمبالغ المسددة المرتبطة بالفواتير
 * 3. تصنيف أعمار الديون الحقيقية للفواتير المتبقية من تاريخ صدور الفاتورة الأصلية
 * 4. ترحيل رصيد أول المدة غير المسدد إلى شريحة الديون القديمة (>90 يوم)
 * 5. فصل المرتجعات والإشعارات الدائنة عن التحصيل النقدي
 * 6. قياس مدة تعامل العميل الفعلية (clientTenureDays) دون معاقبة العميل الجديد
 */
function reconcileClientTimeline(records, openingBalance, periodSettings) {
  const globalStart = periodSettings.globalStartDate || null;
  const globalEnd = periodSettings.globalEndDate || new Date();
  const periodDays = periodSettings.defaultPeriodDays || 365;

  let totalSales = 0;
  let totalReturns = 0;
  let totalPayments = 0;
  const chronologicalEvents = [];

  for (const r of records) {
    const rawInv = Number(r.invoiceAmount) || 0;
    const rawPay = Number(r.paymentAmount) || 0;
    const date = (r.date instanceof Date && !isNaN(r.date.getTime())) ? r.date : null;

    // تمييز المرتجعات والإشعارات الدائنة عن المبيعات العادية
    if (rawInv < 0) {
      totalReturns += Math.abs(rawInv);
      chronologicalEvents.push({
        type: 'return',
        amount: Math.abs(rawInv),
        date: date,
        source: r
      });
    } else if (rawInv > 0) {
      totalSales += rawInv;
      chronologicalEvents.push({
        type: 'invoice',
        amount: rawInv,
        date: date,
        source: r
      });
    }

    if (rawPay > 0) {
      totalPayments += rawPay;
      chronologicalEvents.push({
        type: 'payment',
        amount: rawPay,
        date: date,
        source: r
      });
    }
  }

  // فرز الحركات زمنياً بالكامل
  chronologicalEvents.sort((a, b) => {
    const timeA = a.date ? a.date.getTime() : 0;
    const timeB = b.date ? b.date.getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    // في نفس اليوم: الفواتير أولاً ثم السدادات ثم المرتجعات
    if (a.type === 'invoice' && b.type !== 'invoice') return -1;
    if (a.type !== 'invoice' && b.type === 'invoice') return 1;
    return 0;
  });

  // تحديد أول وآخر تاريخ حركة للعميل
  const validDates = chronologicalEvents
    .filter(e => e.date instanceof Date)
    .map(e => e.date.getTime())
    .sort((a, b) => a - b);

  let clientFirstDate = validDates.length > 0 ? new Date(validDates[0]) : globalStart;
  let clientLastDate = validDates.length > 0 ? new Date(validDates[validDates.length - 1]) : globalEnd;

  // إذا وُجد رصيد أول مدة، فتاريخ بداية علاقة العميل بالفترة هو بداية الفترة العامة
  if (openingBalance > 0 && globalStart) {
    clientFirstDate = globalStart;
  }

  // مدة تعامل العميل الفعلية (clientTenureDays)
  let clientTenureDays = periodDays;
  if (clientFirstDate && globalEnd) {
    const tenureDiff = Math.ceil((globalEnd - clientFirstDate) / (1000 * 60 * 60 * 24));
    if (tenureDiff > 0) {
      clientTenureDays = Math.min(periodDays, tenureDiff);
    }
  }
  clientTenureDays = Math.max(1, clientTenureDays);

  // طابور الالتزامات (FIFO Obligations Queue)
  const obligations = [];

  // 1. رصيد أول المدة: التزام مرحل مستقل بتاريخ البداية
  if (openingBalance > 0) {
    obligations.push({
      id: 'opening_balance',
      type: 'opening',
      date: globalStart || clientFirstDate,
      originalAmount: openingBalance,
      remainingAmount: openingBalance,
      isOpening: true
    });
  }

  // 2. فواتير البيع تباعاً في طابور الالتزامات
  let invCounter = 1;
  for (const event of chronologicalEvents) {
    if (event.type === 'invoice') {
      const docNo = event.source?.docNo || `فاتورة #${invCounter}`;
      obligations.push({
        id: `inv_${invCounter++}`,
        docNo: docNo,
        type: 'invoice',
        date: event.date || clientFirstDate,
        originalAmount: event.amount,
        remainingAmount: event.amount,
        isOpening: false
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // بناء خريطة كشف الحساب المتزامن اللحظي (Detailed Synchronized Ledger)
  // ══════════════════════════════════════════════════════════════
  let runningLedgerBal = roundTo(openingBalance || 0, 2);
  let peakExposure = Math.max(0, runningLedgerBal);
  const statementLedger = [];

  if (openingBalance !== 0) {
    statementLedger.push({
      date: globalStart || clientFirstDate,
      type: 'opening',
      typeLabel: 'رصيد أول المدة',
      docNo: 'افتتاحي',
      details: 'رصيد مرحّل من فترات سابقة',
      debit: openingBalance > 0 ? openingBalance : 0,
      credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      balance: runningLedgerBal,
      speedText: 'رصيد مرحّل'
    });
  }

  // تسوية السدادات والمرتجعات بنظام FIFO مع احتساب التزامن بالساعات والأيام
  const settlements = [];
  let totalMatchedPaid = 0;
  let unappliedPayments = 0;

  for (const event of chronologicalEvents) {
    const docNo = event.source?.docNo || '';
    const details = event.source?.details || '';

    if (event.type === 'return') {
      runningLedgerBal = roundTo(runningLedgerBal - event.amount, 2);
      let returnRem = event.amount;
      for (let i = obligations.length - 1; i >= 0 && returnRem > 0; i--) {
        const ob = obligations[i];
        if (ob.remainingAmount > 0) {
          const deduction = Math.min(ob.remainingAmount, returnRem);
          ob.remainingAmount -= deduction;
          returnRem -= deduction;
        }
      }
      statementLedger.push({
        date: event.date,
        type: 'return',
        typeLabel: 'مرتجع مبيعات',
        docNo: docNo || 'مرتجع',
        details: details || 'مرتجع بضاعة / إشعار دائن',
        debit: 0,
        credit: event.amount,
        balance: runningLedgerBal,
        speedText: 'تسوية مرتجع'
      });
    } else if (event.type === 'invoice') {
      runningLedgerBal = roundTo(runningLedgerBal + event.amount, 2);
      if (runningLedgerBal > peakExposure) peakExposure = runningLedgerBal;
      statementLedger.push({
        date: event.date,
        type: 'invoice',
        typeLabel: 'فاتورة بيع',
        docNo: docNo || `فاتورة #${invCounter}`,
        details: details || 'فاتورة بيع آجل',
        debit: event.amount,
        credit: 0,
        balance: runningLedgerBal,
        speedText: '—'
      });
    } else if (event.type === 'payment') {
      runningLedgerBal = roundTo(runningLedgerBal - event.amount, 2);
      let payRem = event.amount;
      const payDate = event.date || clientLastDate || globalEnd || new Date();
      const currentPaySettles = [];

      for (const ob of obligations) {
        if (payRem <= 0) break;
        if (ob.remainingAmount <= 0) continue;

        const settleAmount = Math.min(ob.remainingAmount, payRem);
        ob.remainingAmount -= settleAmount;
        payRem -= settleAmount;
        totalMatchedPaid += settleAmount;

        // حساب فارق الوقت الدقيق بين الفاتورة والسداد (ساعات وأيام)
        const diffMs = (payDate && ob.date) ? Math.max(0, payDate.getTime() - ob.date.getTime()) : 0;
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
        // إذا سدد خلال نفس اليوم (أقل من 24 ساعة): أيام التحصيل = كسر دقيق أو 0
        const daysToPay = (diffHours < 24) ? roundTo(diffDays, 1) : Math.round(diffDays);

        const sItem = {
          obligationId: ob.id,
          docNo: ob.docNo,
          isOpening: ob.isOpening,
          settleAmount: settleAmount,
          invoiceDate: ob.date,
          paymentDate: payDate,
          diffHours: diffHours,
          daysToPay: daysToPay
        };
        settlements.push(sItem);
        currentPaySettles.push(sItem);
      }

      if (payRem > 0) {
        unappliedPayments += payRem;
      }

      // نص سرعة السداد المتزامن في كشف الحساب
      let speedText = 'دفعة مقدمة / رصيد دائن';
      if (currentPaySettles.length > 0) {
        const avgHours = currentPaySettles.reduce((s, item) => s + item.diffHours, 0) / currentPaySettles.length;
        const avgDays = currentPaySettles.reduce((s, item) => s + item.daysToPay, 0) / currentPaySettles.length;

        if (avgHours <= 2) {
          speedText = 'سداد فوري (خلال ساعتين)';
        } else if (avgHours < 24) {
          speedText = `سداد نفس اليوم (${Math.round(avgHours)} ساعة)`;
        } else if (avgDays <= 1.5) {
          speedText = 'سداد اليوم التالي';
        } else {
          speedText = `سداد بعد ${roundTo(avgDays, 1)} يوم`;
        }
      }

      statementLedger.push({
        date: event.date,
        type: 'payment',
        typeLabel: 'سند قبض / تحصيل',
        docNo: docNo || 'سند قبض',
        details: details || 'تحصيل نقدي / بنكي',
        debit: 0,
        credit: event.amount,
        balance: runningLedgerBal,
        speedText: speedText
      });
    }
  }

  // حساب أعمار الديون للمبالغ المتبقية غير المسددة حتى نهاية الفترة
  const asOfDate = globalEnd || new Date();
  const agingBuckets = {
    current: 0,   // 0 - 30 يوم
    days30: 0,    // للتوافق مع الواجهات
    days60: 0,    // 31 - 60 يوم
    days90: 0,    // 61 - 90 يوم
    over90: 0,    // > 90 يوم (شامل الديون السابقة المرحلة)
    total: 0
  };

  let overdueAmount = 0; // مديونيات متأخرة تجاوزت 30 يوماً
  let oldestOpenInvoiceDays = 0;

  for (const ob of obligations) {
    if (ob.remainingAmount > 0.005) {
      if (ob.isOpening) {
        // رصيد أول المدة غير المسدد: دين قديم مرحل من فترات سابقة -> شريحة > 90 يوم
        agingBuckets.over90 += ob.remainingAmount;
        overdueAmount += ob.remainingAmount;
        const opDays = ob.date ? Math.max(91, Math.floor((asOfDate - ob.date) / (1000 * 60 * 60 * 24))) : 91;
        if (opDays > oldestOpenInvoiceDays) oldestOpenInvoiceDays = opDays;
      } else {
        const invAge = ob.date ? Math.max(0, Math.floor((asOfDate - ob.date) / (1000 * 60 * 60 * 24))) : 0;
        if (invAge > oldestOpenInvoiceDays) oldestOpenInvoiceDays = invAge;

        if (invAge <= 30) {
          agingBuckets.current += ob.remainingAmount;
        } else if (invAge <= 60) {
          agingBuckets.days60 += ob.remainingAmount;
          overdueAmount += ob.remainingAmount;
        } else if (invAge <= 90) {
          agingBuckets.days90 += ob.remainingAmount;
          overdueAmount += ob.remainingAmount;
        } else {
          agingBuckets.over90 += ob.remainingAmount;
          overdueAmount += ob.remainingAmount;
        }
      }
    }
  }

  // تقريب مبالغ أعمار الديون وحساب النسب
  agingBuckets.days30 = agingBuckets.current;
  agingBuckets.total = agingBuckets.current + agingBuckets.days60 + agingBuckets.days90 + agingBuckets.over90;
  if (agingBuckets.total > 0) {
    agingBuckets.currentPct = roundTo((agingBuckets.current / agingBuckets.total) * 100, 1);
    agingBuckets.days30Pct = agingBuckets.currentPct;
    agingBuckets.days60Pct = roundTo((agingBuckets.days60 / agingBuckets.total) * 100, 1);
    agingBuckets.days90Pct = roundTo((agingBuckets.days90 / agingBuckets.total) * 100, 1);
    agingBuckets.over90Pct = roundTo((agingBuckets.over90 / agingBuckets.total) * 100, 1);
  } else {
    agingBuckets.currentPct = 0; agingBuckets.days30Pct = 0; agingBuckets.days60Pct = 0; agingBuckets.days90Pct = 0; agingBuckets.over90Pct = 0;
  }
  agingBuckets.current = roundTo(agingBuckets.current, 2);
  agingBuckets.days30 = roundTo(agingBuckets.days30, 2);
  agingBuckets.days60 = roundTo(agingBuckets.days60, 2);
  agingBuckets.days90 = roundTo(agingBuckets.days90, 2);
  agingBuckets.over90 = roundTo(agingBuckets.over90, 2);
  agingBuckets.total = roundTo(agingBuckets.total, 2);

  // الرصيد الختامي الصافي
  const grossRemainingDebt = obligations.reduce((sum, ob) => sum + Math.max(0, ob.remainingAmount), 0);

  // فحص ما إذا كان هناك رصيد إقفال صريح أو إشارة دائن صريحة من شيت معتمد
  const explicitClosing = getExplicitClosingBalance(records);
  const hasExplicitCredit = records.some(r => r.isCredit === true || (r.closingBalance !== null && r.closingBalance < -0.005) || (r.balance !== null && r.balance < -0.005));

  let closingBalance = 0;
  let isCreditClient = false;

  if (explicitClosing !== null) {
    // 1. إذا توفر رصيد آخر المدة صراحة من كشف أرصدة أو تقرير ERP
    closingBalance = roundTo(explicitClosing, 2);
    isCreditClient = (closingBalance < -0.005);
  } else if (hasExplicitCredit) {
    // 2. إذا تم تأكيد أن العميل دائن (له رصيد / دفعة مقدمة) من خلال شيت الأرصدة أو عمود الحالة
    closingBalance = roundTo(grossRemainingDebt - unappliedPayments, 2);
    isCreditClient = (closingBalance < -0.005);
  } else if ((!openingBalance || openingBalance === 0) && (unappliedPayments > grossRemainingDebt)) {
    // 3. في حال غياب رصيد أول المدة وسداد العميل مبالغ أكبر من فواتير الفترة الحالية:
    // هذه المبالغ كانت تسوية لمديونيات سنوات سابقة (مثل 2025)، وليست سداداً مقدماً وهمياً.
    // لذا يكون حسابه مصفياً (رصيد = 0) دون اعتباره عميلاً دائناً.
    closingBalance = 0;
    isCreditClient = false;
  } else {
    // 4. الحساب الطبيعي
    closingBalance = roundTo(grossRemainingDebt - unappliedPayments, 2);
    isCreditClient = (closingBalance < -0.005);
  }

  // أيام التحصيل الفعلية المرجحة للمبالغ المسددة
  let actualCollectionDays = 0;
  if (totalMatchedPaid > 0) {
    const weightedSum = settlements.reduce((sum, s) => sum + (s.settleAmount * s.daysToPay), 0);
    actualCollectionDays = roundTo(weightedSum / totalMatchedPaid, 1);
  }

  // احتساب DSO المعتمد:
  let dso = 0;
  if (isCreditClient) {
    dso = 0;
  } else if (closingBalance <= 0) {
    // عميل مصفّي حسابه بالكامل: سرعة تحصيله هي أيامه الفعلية المسددة (0 إن كان كاش فوري، أو 12 إن سدد بعد 12 يوم)
    dso = actualCollectionDays;
  } else {
    // عميل لديه مديونية معلقة متبقية:
    // مزيج مرجح بين المبالغ المسددة بأيامها، والمبالغ المتبقية المفتوحة بأعمارها الحالية
    const weightedPaid = settlements.reduce((sum, s) => sum + (s.settleAmount * s.daysToPay), 0);
    let weightedOpen = 0;
    for (const ob of obligations) {
      if (ob.remainingAmount > 0.005) {
        const age = ob.isOpening 
          ? (ob.date ? Math.max(91, Math.floor((asOfDate - ob.date) / (1000 * 60 * 60 * 24))) : 91)
          : (ob.date ? Math.max(0, Math.floor((asOfDate - ob.date) / (1000 * 60 * 60 * 24))) : 0);
        weightedOpen += ob.remainingAmount * age;
      }
    }
    const totalExposure = totalMatchedPaid + grossRemainingDebt;
    dso = totalExposure > 0 ? roundTo((weightedPaid + weightedOpen) / totalExposure, 1) : 0;
  }

  // نسب التحصيل
  const netSales = Math.max(0, totalSales - totalReturns);
  const totalDue = Math.max(0, openingBalance) + netSales;
  let collectionRate = isCreditClient ? 100 : 0;
  if (totalDue > 0) {
    collectionRate = Math.min(100, roundTo((totalPayments / totalDue) * 100, 1));
  } else if (closingBalance <= 0) {
    collectionRate = 100;
  }

  // نسبة تحصيل مبيعات الفترة الحالية وحدها
  let periodSalesCollectionRate = 100;
  if (netSales > 0) {
    const periodMatched = settlements.filter(s => !s.isOpening).reduce((s, item) => s + item.settleAmount, 0);
    periodSalesCollectionRate = Math.min(100, roundTo((periodMatched / netSales) * 100, 1));
  }

  // تقييم كفاية البيانات (dataCoverage)
  let dataCoverage = 'full';
  if (openingBalance === 0 && clientTenureDays < (periodDays * 0.5)) {
    dataCoverage = 'new_client';
  } else if (records.length < 3) {
    dataCoverage = 'partial';
  }

  return {
    totalSales: roundTo(netSales, 2),
    totalGrossSales: roundTo(totalSales, 2),
    totalReturns: roundTo(totalReturns, 2),
    totalPayments: roundTo(totalPayments, 2),
    matchedPaidAmount: roundTo(totalMatchedPaid, 2),
    unappliedPayments: roundTo(unappliedPayments, 2),
    closingBalance,
    isCreditClient,
    actualCollectionDays,
    dso,
    collectionRate,
    periodSalesCollectionRate,
    agingBuckets,
    overdueAmount: roundTo(overdueAmount, 2),
    oldestOpenInvoiceDays,
    clientTenureDays,
    dataCoverage,
    creditExposure: Math.max(0, closingBalance),
    peakExposure: roundTo(peakExposure, 2),
    statementLedger,
    chronologicalEvents,
    clientFirstDate,
    clientLastDate
  };
}

/**
 * حساب متوسط المديونية اليومية المرجحة بالزمن
 * Average Receivables = (مجموع الأرصدة الختامية لكل يوم من أيام الفترة N) ÷ N
 */
function calculateDailyAverageReceivables(chronologicalEvents, openingBalance, startDate, endDate, periodDays) {
  if (!periodDays || periodDays <= 0) return 0;
  if (!startDate || !endDate) return roundTo(Math.max(0, openingBalance), 2);

  const startMs = (startDate instanceof Date ? startDate : new Date(startDate)).getTime();
  const endMs = (endDate instanceof Date ? endDate : new Date(endDate)).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const numDays = Math.max(1, Math.round((endMs - startMs) / dayMs) + 1);

  let currentBal = Math.max(0, openingBalance);
  let totalDailyBalance = 0;
  let lastTime = startMs;

  for (const ev of chronologicalEvents) {
    if (!ev.date) continue;
    const evTime = Math.min(Math.max(ev.date.getTime(), startMs), endMs);
    const daysInterval = Math.max(0, (evTime - lastTime) / dayMs);

    if (daysInterval > 0) {
      totalDailyBalance += currentBal * daysInterval;
      lastTime = evTime;
    }

    if (ev.type === 'invoice') {
      currentBal += ev.amount;
    } else if (ev.type === 'payment' || ev.type === 'return') {
      currentBal = Math.max(0, currentBal - ev.amount);
    }
  }

  // الفترة من آخر حركة حتى نهاية التقرير
  const remainingDays = Math.max(0, (endMs - lastTime) / dayMs);
  totalDailyBalance += currentBal * remainingDays;

  const totalPeriodToDivide = Math.max(numDays, periodDays);
  return roundTo(totalDailyBalance / totalPeriodToDivide, 2);
}

/**
 * استخراج رصيد أول المدة (أقدم رصيد)
 */
function getOpeningBalance(sortedRecords) {
  for (const record of sortedRecords) {
    if (record.openingBalance !== null && record.openingBalance !== undefined && !isNaN(record.openingBalance)) {
      return roundTo(record.openingBalance, 2);
    }
    if (record.balance !== null && record.balance !== undefined && !isNaN(record.balance)) {
      return roundTo(record.balance, 2);
    }
  }
  return 0;
}

/**
 * استخراج رصيد آخر المدة الصريح (من كشف أرصدة أو عمود معتمد)
 * يُرجع null في حال عدم وجود عمود أو قيمة صريحة لرصيد الإقفال
 */
function getExplicitClosingBalance(sortedRecords) {
  for (let i = sortedRecords.length - 1; i >= 0; i--) {
    const record = sortedRecords[i];
    if (record.closingBalance !== null && record.closingBalance !== undefined && !isNaN(record.closingBalance)) {
      return roundTo(record.closingBalance, 2);
    }
  }
  return null;
}

/**
 * استخراج رصيد آخر المدة (أحدث رصيد)
 */
function getClosingBalance(sortedRecords) {
  for (let i = sortedRecords.length - 1; i >= 0; i--) {
    const record = sortedRecords[i];
    if (record.closingBalance !== null && record.closingBalance !== undefined && !isNaN(record.closingBalance)) {
      return roundTo(record.closingBalance, 2);
    }
    if (record.balance !== null && record.balance !== undefined && !isNaN(record.balance)) {
      return roundTo(record.balance, 2);
    }
  }
  return 0;
}

/**
 * حساب الملخص الإجمالي لكل العملاء — مُوسّع
 */
function calculateSummary(results, settings) {
  if (!results || results.length === 0) {
    return {
      totalClients: 0,
      totalSales: 0,
      totalReceivables: 0,
      totalDebt: 0,
      avgDSO: 0,
      avgTurnover: 0,
      avgRequiredMarkup: 0,
      avgCollectionRate: 0,
      avgReturnOnAR: 0,
      avgFeasibilityIndex: 0,
      avgQualityScore: 0,
      avgHiddenLossPct: 0,
      feasibleCount: 0,
      notFeasibleCount: 0,
      totalOpportunityCost: 0,
      totalFinancingCost: 0,
      hurdleRate: 0,
      // أعمار الديون الإجمالية
      totalAging: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 }
    };
  }

  const totalClients = results.length;
  const totalImportedClients = settings?.totalImportedClients || totalClients;
  const dormantClientsCount = Math.max(0, totalImportedClients - totalClients);
  const totalSales = results.reduce((s, r) => s + r.totalSales, 0);
  const totalReceivables = results.reduce((s, r) => s + r.avgReceivables, 0);
  
  // حساب المديونيات والأرصدة الدائنة وصافي رصيد السوق بدقة مطلقة
  const grossReceivables = results.filter(r => r.closingBalance > 0).reduce((s, r) => s + r.closingBalance, 0);
  const creditBalances = results.filter(r => r.closingBalance < 0).reduce((s, r) => s + Math.abs(r.closingBalance), 0);
  const creditClientsCount = results.filter(r => r.closingBalance < 0).length;
  const netMarketBalance = grossReceivables - creditBalances; // صافي رصيد السوق مطابق لمعادلة ERP (مدين - دائن)
  const totalDebt = netMarketBalance;
  
  const periodDays = results.length > 0 ? results[0].periodDays : 365;
  const periodTurnover = totalReceivables > 0 ? totalSales / totalReceivables : 0;
  const avgDSO = periodTurnover > 0 ? periodDays / periodTurnover : 0;
  // معدل دوران المحفظة الإجمالي عن الفترة:
  const avgTurnover = periodTurnover > 0 ? roundTo(periodTurnover, 2) : 0;
  
  const avgRequiredMarkup = results.reduce((s, r) => s + r.requiredMarkup, 0) / totalClients;
  
  // معدل التحصيل المرجح للمحفظة بالكامل (وزن نسبي بالمبالغ):
  const totalAllPayments = results.reduce((s, r) => s + (r.totalPayments || 0), 0);
  const totalAllDue = results.reduce((s, r) => s + (Math.max(0, r.openingBalance || 0) + (r.totalSales || 0)), 0);
  const avgCollectionRate = totalAllDue > 0 ? roundTo((totalAllPayments / totalAllDue) * 100, 1) : 100;
  
  // توافق مع الإصدارات السابقة والرسوم البيانية
  const totalProfit = totalSales * (settings.profitMargin / 100);
  const avgReturnOnAR = totalReceivables > 0 ? (totalProfit / totalReceivables) * 100 : 0;
  const hurdleRate = results.length > 0 ? results[0].hurdleRate : 0;
  const avgFeasibilityIndex = avgReturnOnAR - hurdleRate;
  
  const avgQualityScore = results.reduce((s, r) => s + r.qualityScore, 0) / totalClients;
  const avgHiddenLossPct = results.reduce((s, r) => s + r.hiddenLossPct, 0) / totalClients;
  const feasibleCount = results.filter(r => r.isFeasible).length;
  const notFeasibleCount = totalClients - feasibleCount;
  const totalOpportunityCost = results.reduce((s, r) => s + r.opportunityCost, 0);
  const totalFinancingCost = results.reduce((s, r) => s + r.financingCost, 0);

  // أعمار الديون الإجمالية
  const totalAging = {
    current: roundTo(results.reduce((s, r) => s + (r.agingBuckets?.current || 0), 0), 2),
    days30: roundTo(results.reduce((s, r) => s + (r.agingBuckets?.days30 || 0), 0), 2),
    days60: roundTo(results.reduce((s, r) => s + (r.agingBuckets?.days60 || 0), 0), 2),
    days90: roundTo(results.reduce((s, r) => s + (r.agingBuckets?.days90 || 0), 0), 2),
    over90: roundTo(results.reduce((s, r) => s + (r.agingBuckets?.over90 || 0), 0), 2),
    grossReceivables: roundTo(grossReceivables, 2),
    creditBalances: roundTo(creditBalances, 2),
    netBalance: roundTo(netMarketBalance, 2),
    total: 0
  };
  totalAging.total = roundTo(totalAging.current + totalAging.days30 + totalAging.days60 + totalAging.days90 + totalAging.over90, 2);

  return {
    totalClients,
    totalImportedClients,
    dormantClientsCount,
    totalSales: roundTo(totalSales, 2),
    totalReceivables: roundTo(totalReceivables, 2),
    totalDebt: roundTo(totalDebt, 2),
    grossReceivables: roundTo(grossReceivables, 2),
    creditBalances: roundTo(creditBalances, 2),
    creditClientsCount,
    netMarketBalance: roundTo(netMarketBalance, 2),
    avgDSO: roundTo(avgDSO, 1),
    avgTurnover: roundTo(avgTurnover, 2),
    avgRequiredMarkup: roundTo(avgRequiredMarkup, 2),
    avgCollectionRate: roundTo(avgCollectionRate, 1),
    hurdleRate: roundTo(hurdleRate, 2),
    avgReturnOnAR: roundTo(avgReturnOnAR, 2),
    avgFeasibilityIndex: roundTo(avgFeasibilityIndex, 2),
    avgQualityScore: roundTo(avgQualityScore, 1),
    avgHiddenLossPct: roundTo(avgHiddenLossPct, 2),
    feasibleCount,
    notFeasibleCount,
    totalOpportunityCost: roundTo(totalOpportunityCost, 2),
    totalFinancingCost: roundTo(totalFinancingCost, 2),
    hurdleRate: roundTo(hurdleRate, 2),
    totalAging
  };
}

/**
 * حساب تحليل المبيعات حسب التصنيف — مُوسّع
 */
function calculateSalesByClassification(classifiedClients) {
  const groups = { good: [], average: [], poor: [] };

  classifiedClients.forEach(client => {
    if (groups[client.classification]) {
      groups[client.classification].push(client);
    }
  });

  const totalSales = classifiedClients.reduce((s, c) => s + c.totalSales, 0);
  const totalReceivables = classifiedClients.reduce((s, c) => s + c.avgReceivables, 0);
  const totalAllDebt = classifiedClients.filter(c => c.closingBalance > 0).reduce((s, c) => s + c.closingBalance, 0);
  const totalAllPayments = classifiedClients.reduce((s, c) => s + c.totalPayments, 0);

  const result = {};
  for (const [key, clients] of Object.entries(groups)) {
    const groupSales = clients.reduce((s, c) => s + c.totalSales, 0);
    const groupReceivables = clients.reduce((s, c) => s + c.avgReceivables, 0);
    const groupRemainingDebt = clients.filter(c => c.closingBalance > 0).reduce((s, c) => s + c.closingBalance, 0);
    const groupCreditBalance = clients.filter(c => c.closingBalance < 0).reduce((s, c) => s + Math.abs(c.closingBalance), 0);
    const groupProfit = clients.reduce((s, c) => s + (c.totalSales * (c.currentMargin / 100)), 0);
    const groupCashSales = clients.reduce((s, c) => s + c.totalPayments, 0);
    
    const avgTurnover = groupReceivables > 0 ? groupSales / groupReceivables : 0;
    const periodDays = clients.length > 0 ? clients[0].periodDays : 365;
    
    const avgDSO = avgTurnover > 0 ? periodDays / avgTurnover : 0;
    const avgReturnOnAR = groupReceivables > 0 ? (groupProfit / groupReceivables) * 100 : 0;
    
    const feasibleInGroup = clients.filter(c => c.isFeasible).length;

    result[key] = {
      count: clients.length,
      totalSales: roundTo(groupSales, 2),
      totalReceivables: roundTo(groupReceivables, 2),
      totalCashSales: roundTo(groupCashSales, 2),
      totalCreditSales: roundTo(groupRemainingDebt, 2), // المديونية المتبقية الفعلية الموجبة
      creditBalance: roundTo(groupCreditBalance, 2), // أرصدة العملاء الدائنين (دفعات مقدمة)
      cashSalesPercentage: totalAllPayments > 0 ? roundTo((groupCashSales / totalAllPayments) * 100, 1) : 0,
      creditSalesPercentage: totalAllDebt > 0 ? roundTo((groupRemainingDebt / totalAllDebt) * 100, 1) : 0,
      salesPercentage: totalSales > 0 ? roundTo((groupSales / totalSales) * 100, 1) : 0,
      receivablesPercentage: totalReceivables > 0 ? roundTo((groupReceivables / totalReceivables) * 100, 1) : 0,
      avgDSO: roundTo(avgDSO, 1),
      avgReturnOnAR: roundTo(avgReturnOnAR, 2),
      feasibleCount: feasibleInGroup
    };
  }

  return result;
}

/**
 * تقريب الأرقام
 */
function roundTo(num, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * تنسيق الأرقام بالإنجليزية
 */
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

/**
 * تنسيق النسب المئوية بالإنجليزية
 */
function formatPercent(num, decimals = 1) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num) + '%';
}
