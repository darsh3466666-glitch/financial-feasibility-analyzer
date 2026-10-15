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
    
    // استبعاد الحسابات الصفرية الخاملة (مبيعات = 0 وبدون أي رصيد مدين أو دائن)
    if (!result || (result.totalSales <= 0 && (!result.closingBalance || Math.abs(result.closingBalance) === 0))) {
      continue;
    }

    results.push(result);
  }

  return results;
}

/**
 * حساب المؤشرات المالية لعميل واحد — الأقسام الثلاثة
 */
function calculateClientMetrics(clientName, records, settings) {
  // ترتيب السجلات حسب التاريخ
  const sorted = [...records].sort((a, b) => a.date - b.date);

  // حساب الفترة
  // الصواب في التحليل المالي هو استخدام فترة التحليل الإجمالية (Period) الثابتة لجميع العملاء
  // لكي تكون مقارنة أيام التحصيل (DSO) ومعدل الدوران صحيحة وموحدة.
  const periodDays = settings.defaultPeriodDays || 365;
  
  let startDate = settings.globalStartDate || null;
  let endDate = settings.globalEndDate || null;
  
  const validRecordsWithDate = sorted.filter(r => r.date instanceof Date && !isNaN(r.date));
  if (validRecordsWithDate.length >= 2) {
    if (!startDate) startDate = validRecordsWithDate[0].date;
    if (!endDate) endDate = validRecordsWithDate[validRecordsWithDate.length - 1].date;
  }

  // ═══════════════════════════════════════════════
  // القسم الأول: دوران المديونية وDSO وCollection Rate
  // ═══════════════════════════════════════════════

  // إجمالي المبيعات الآجلة (مجموع الفواتير)
  const totalSales = records.reduce((sum, r) => sum + (r.invoiceAmount || 0), 0);

  // رصيد أول المدة وآخر المدة
  const openingBalance = getOpeningBalance(sorted);
  const closingBalance = getClosingBalance(sorted);

  // تحديد ما إذا كان العميل دائناً (له رصيد / دفعات مقدمة)
  // يعتمد حصرياً على رصيد الإغلاق الصافي — حركة دائنة تاريخية واحدة لا تجعل العميل "دائناً"
  const isCreditClient = (closingBalance < 0);

  // إجمالي المحصلات (مجموع المدفوعات)
  let totalPayments = records.reduce((sum, r) => sum + (r.paymentAmount || 0), 0);

  // إذا كانت المدفوعات صفر ورصيد الإغلاق صفر أو أقل، فالعميل سدد مبيعاته فوراً كاش
  if (totalPayments === 0) {
    const inferred = Math.max(0, openingBalance) + totalSales - Math.max(0, closingBalance);
    if (inferred > 0) totalPayments = inferred;
  }

  // متوسط المدينين وفق المعايير المالية الحديثة (متوسط الرصيد اليومي المرجح بالزمن)
  // العميل الدائن رصيد مديونيته للمنشأة = 0
  const avgReceivables = isCreditClient ? 0 : calculateAverageReceivables(
    sorted,
    Math.max(0, openingBalance),
    Math.max(0, closingBalance),
    totalSales,
    periodDays,
    settings.globalStartDate,
    settings.globalEndDate
  );

  // حساب أيام التحصيل (DSO) ومعدل الدوران وفق المعايير المالية المعتمدة:
  let arTurnover = 365;
  let dso = 0;
  let annualizedTurnover = 365;

  if (!isCreditClient && totalSales > 0 && avgReceivables > 0) {
    arTurnover = totalSales / avgReceivables;
    dso = periodDays / arTurnover;

    // المعايير المالية: إذا كانت فترة التحصيل أقل من يوم واحد (dso < 1)،
    // فهذا سداد نقدي فوري بالكامل (DSO = 0، والدوران نقدي فوري):
    if (dso < 1) {
      dso = 0;
      arTurnover = 365;
      annualizedTurnover = 365;
    } else {
      dso = roundTo(dso, 1);
      annualizedTurnover = roundTo(365 / dso, 1);
    }
  } else if (!isCreditClient && totalSales === 0 && (closingBalance > 0 || openingBalance > 0)) {
    // عميل خامل عليه مديونية قديمة بدون مشتريات جديدة — ليس كاشاً
    // DSO يساوي كامل فترة التحليل لأن الدين ظل معلقاً طوال الفترة
    dso = roundTo(periodDays, 1);
    arTurnover = 0;
    annualizedTurnover = 0;
  } else {
    // بيع نقدي فوري بالكامل أو عميل دائن
    dso = 0;
    arTurnover = 365;
    annualizedTurnover = 365;
  }

  // معدل التحصيل (Collection Rate)
  // Collection_Rate % = (إجمالي المحصّل / إجمالي المستحق) × 100
  // إجمالي المستحق = رصيد أول المدة + المبيعات الآجلة
  const totalDue = Math.max(0, openingBalance) + totalSales;
  let collectionRate = isCreditClient ? 100 : 0;
  if (totalDue > 0) {
    collectionRate = Math.min(100, Math.round(((totalPayments / totalDue) * 100) * 10) / 10);
    if (isCreditClient) collectionRate = 100;
  }

  // تحليل أعمار الديون (Aging Buckets) - العميل الدائن ليس عليه ديون معمرة
  const agingReferenceDate = settings.globalEndDate || new Date();
  const agingBuckets = isCreditClient 
    ? { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 }
    : calculateAgingBuckets(sorted, agingReferenceDate, Math.max(0, closingBalance));

  // ═══════════════════════════════════════════════
  // القسم الثاني: الجدوى وتكلفة الفرصة البديلة
  // ═══════════════════════════════════════════════

  // استخراج الإعدادات الموسعة
  const depositRate = settings.depositRate || settings.interestRate || 19; // الافتراضي 19%
  const lendingRate = settings.lendingRate || settings.interestRate || 24; // الافتراضي 24%
  const profitMargin = settings.profitMargin || 0; // للحفاظ على التوافق مع بيانات التسعير القديمة

  // Hurdle Rate = سعر الإيداع + علاوة مخاطر الإدارة
  const riskPremiumMgmt = settings.riskPremiumPct || 0;
  const hurdleRate = depositRate + riskPremiumMgmt;

  // 1. حساب "الخسارة الخفية" (تكلفة الأموال المعطلة كنسبة من المبيعات)
  // النسبة = (أيام التحصيل / 365) × سعر الفائدة البنكي (تكلفة الفرصة البديلة)
  const hiddenLossPct = isCreditClient ? 0 : ((dso / 365) * depositRate);

  // الخسارة الخفية كمبلغ (قيمة الفرصة البديلة الضائعة عن فترة التحليل بالكامل)
  const opportunityCost = isCreditClient ? 0 : (avgReceivables * (depositRate / 100) * (periodDays / 365));
  // تكلفة التمويل الفعلية (في حال الاقتراض عن فترة التحليل بالكامل)
  const financingCost = isCreditClient ? 0 : (avgReceivables * (lendingRate / 100) * (periodDays / 365));

  // حسابات الجدوى القديمة للتوافق مع الرسوم البيانية والتصدير
  const grossMargin = profitMargin;
  const returnOnAR = grossMargin * annualizedTurnover;
  const feasibilityIndex = returnOnAR - hurdleRate;

  // 2. حساب "نقاط الجودة الشاملة" (من 100 نقطة)
  // أ. نقاط معدل التحصيل (الحد الأقصى 35 نقطة)
  const scoreCollection = (Math.min(100, collectionRate) / 100) * 35;
  
  // ب. نقاط سرعة السداد DSO (الحد الأقصى 40 نقطة)
  // العميل يحصل على صفر إذا تجاوز 120 يوم (4 شهور)
  const scoreDSO = Math.max(0, 40 - (dso / 120) * 40);
  
  // ج. نقاط معدل دوران المديونية (الحد الأقصى 25 نقطة)
  // العميل المثالي يدور ماله 12 مرة سنوياً (شهرياً)
  const scoreTurnover = Math.min(25, (annualizedTurnover / 12) * 25);
  
  const qualityScore = isCreditClient ? 100 : (scoreCollection + scoreDSO + scoreTurnover);
  
  // تقييم الجدوى المالية والاقتصادية الشاملة (مُجدي / غير مُجدي):
  // 1. عميل الكاش الفوري والعميل الدائن دائماً مُجدي 100% لعدم وجود مخاطر أو تكلفة انتظار
  // 2. العميل الآجل يعتبر مُجدياً إذا كانت تكلفة انتظاره مغطاة بهامش الربح، ومتوسط ديونه الراكدة (>90 يوم) لا تتجاوز 40%، ونسبة تحصيله لا تقل عن 30%
  const isInstantCash = isCreditClient || (!avgReceivables || avgReceivables === 0 || dso === 0 || dso < 1 || annualizedTurnover >= 365);
  let isFeasible = false;
  if (isInstantCash) {
    isFeasible = true;
  } else {
    const totalRemainingDebt = closingBalance > 0 ? closingBalance : (agingBuckets?.total || 0);
    const over90Ratio = totalRemainingDebt > 0 ? ((agingBuckets?.over90 || 0) / totalRemainingDebt) : 0;
    
    // نسبة تكلفة التمويل/الفرصة البديلة لفترة الائتمان
    const carryingCostPct = (dso / 365) * depositRate;
    const isProfitable = (grossMargin > carryingCostPct) || (dso <= 60);
    const hasHealthyAging = over90Ratio <= 0.40;
    const hasBasicCollection = collectionRate >= 30;

    isFeasible = (isProfitable && hasHealthyAging && hasBasicCollection && dso <= 120);
  }

  // ═══════════════════════════════════════════════
  // القسم الثالث: بيانات التسعير (الحساب الفعلي في pricing-engine.js)
  // ═══════════════════════════════════════════════

  // نسبة الزيادة المطلوبة (تكلفة التمويل كنسبة مئوية)
  const financingCostPct = isCreditClient ? 0 : ((lendingRate / 365) * dso);

  // فجوة الجدوى القديمة (للتوافق مع الواجهة الحالية)
  const requiredMarkup = (isCreditClient || annualizedTurnover <= 0) ? 0 : (lendingRate / annualizedTurnover);
  const feasibilityGap = profitMargin - requiredMarkup;

  return {
    clientName,

    // القسم الأول — دوران المديونية
    totalSales: roundTo(totalSales, 2),
    totalPayments: roundTo(totalPayments, 2),
    openingBalance: roundTo(openingBalance, 2),
    closingBalance: roundTo(closingBalance, 2),
    avgReceivables: roundTo(avgReceivables, 2),
    arTurnover: roundTo(arTurnover, 2),
    annualizedTurnover: roundTo(annualizedTurnover, 2),
    dso: roundTo(dso, 1),
    collectionRate: roundTo(collectionRate, 1),
    agingBuckets,
    isCredit: isCreditClient,
    creditAmount: isCreditClient ? Math.abs(closingBalance) : 0,
    statusLabel: isCreditClient ? 'دائن (له رصيد)' : 'مدين (عليه مديونية)',

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

    // بيانات الفترة
    periodDays,
    startDate,
    endDate,
    transactionCount: records.length
  };
}

/**
 * حساب أعمار الديون (Aging Buckets)
 * تصنيف الفواتير غير المسددة حسب عمرها
 */
function calculateAgingBuckets(sortedRecords, today, remainingDebt) {
  const buckets = {
    current: 0,       // 0-30 يوم
    days30: 0,        // محفوظ للتوافق مع الإصدارات السابقة
    days60: 0,        // 31-60 يوم
    days90: 0,        // 61-90 يوم
    over90: 0,        // > 90 يوم
    total: 0
  };

  if (!remainingDebt || remainingDebt <= 0) {
    return buckets; // No debt to age
  }

  // Extract all invoices (with dates)
  const invoices = sortedRecords
    .filter(r => r.invoiceAmount > 0)
    .map(r => ({
      amount: r.invoiceAmount,
      date: (r.date && !isNaN(r.date)) ? r.date : today // Fallback to today if no date
    }))
    .sort((a, b) => b.date - a.date); // Sort newest to oldest

  // Allocate remaining debt to invoices (FIFO: newest invoices are unpaid first)
  for (const inv of invoices) {
    if (remainingDebt <= 0) break;
    
    const amountToAllocate = Math.min(inv.amount, remainingDebt);
    remainingDebt -= amountToAllocate;
    
    const daysSince = Math.floor((today - inv.date) / (1000 * 60 * 60 * 24));

    if (daysSince <= 30) {
      buckets.current += amountToAllocate;
    } else if (daysSince <= 60) {
      buckets.days60 += amountToAllocate;
    } else if (daysSince <= 90) {
      buckets.days90 += amountToAllocate;
    } else {
      buckets.over90 += amountToAllocate;
    }
  }

  // If there is STILL remaining debt (e.g. from opening balance without invoices)
  if (remainingDebt > 0) {
    // Put it in the oldest bucket because it predates our invoice records
    buckets.over90 += remainingDebt;
  }

  buckets.total = buckets.current + buckets.days30 + buckets.days60 + buckets.days90 + buckets.over90;

  // تحويل لنسب مئوية
  if (buckets.total > 0) {
    buckets.currentPct = roundTo((buckets.current / buckets.total) * 100, 1);
    buckets.days30Pct = roundTo((buckets.days30 / buckets.total) * 100, 1);
    buckets.days60Pct = roundTo((buckets.days60 / buckets.total) * 100, 1);
    buckets.days90Pct = roundTo((buckets.days90 / buckets.total) * 100, 1);
    buckets.over90Pct = roundTo((buckets.over90 / buckets.total) * 100, 1);
  } else {
    buckets.currentPct = 0;
    buckets.days30Pct = 0;
    buckets.days60Pct = 0;
    buckets.days90Pct = 0;
    buckets.over90Pct = 0;
  }

  // تقريب المبالغ
  buckets.current = roundTo(buckets.current, 2);
  buckets.days30 = roundTo(buckets.days30, 2);
  buckets.days60 = roundTo(buckets.days60, 2);
  buckets.days90 = roundTo(buckets.days90, 2);
  buckets.over90 = roundTo(buckets.over90, 2);
  buckets.total = roundTo(buckets.total, 2);

  return buckets;
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
 * حساب متوسط رصيد المدينين وفق المعايير المالية الحديثة (CMA / IFRS / البنوك)
 * يستخدم متوسط الرصيد اليومي المرجح بالزمن (Time-Weighted Daily Average Balance)
 * لتفادي تشوه النسب عند تصفية الحسابات في نهاية الفترة أو وجود مبالغ فكة متبقية.
 */
function calculateAverageReceivables(sortedRecords, openingBalance, closingBalance, totalSales, periodDays, startDate, endDate) {
  // تصفية السجلات ذات التواريخ الصالحة
  const validDated = sortedRecords.filter(r => r.date instanceof Date && !isNaN(r.date.getTime()));

  if (validDated.length > 0 && startDate && endDate && periodDays > 0) {
    let currentBalance = openingBalance;
    let totalWeightedBalance = 0;
    let lastTime = (startDate instanceof Date ? startDate : new Date(startDate)).getTime();
    const endTime = (endDate instanceof Date ? endDate : new Date(endDate)).getTime();

    // فرز المعاملات زمنياً
    const dateSorted = [...validDated].sort((a, b) => a.date - b.date);

    for (const r of dateSorted) {
      const txTime = Math.min(Math.max(r.date.getTime(), lastTime), endTime);
      const daysDiff = (txTime - lastTime) / (1000 * 60 * 60 * 24);

      if (daysDiff > 0) {
        totalWeightedBalance += Math.max(0, currentBalance) * daysDiff;
        lastTime = txTime;
      }

      // تحديث الرصيد بعد الحركة (معاملة الرصيد الدائن السالب كمديونية صفرية)
      if (r.balance !== null && r.balance !== undefined && !isNaN(r.balance)) {
        currentBalance = Math.max(0, r.balance);
      } else {
        const inv = r.invoiceAmount || 0;
        const pay = r.paymentAmount || 0;
        currentBalance = Math.max(0, currentBalance + inv - pay);
      }
    }

    // الفترة من تاريخ آخر حركة حتى نهاية الفترة المالية
    const remainingDays = Math.max(0, (endTime - lastTime) / (1000 * 60 * 60 * 24));
    totalWeightedBalance += Math.max(0, currentBalance) * remainingDays;

    const timeWeightedAvg = totalWeightedBalance / periodDays;
    if (timeWeightedAvg > 0) {
      return roundTo(timeWeightedAvg, 2);
    }
  }

  // إذا لم تتوفر تواريخ دقيقة ولكن توجد معاملات متعددة:
  if (sortedRecords.length > 1) {
    let running = openingBalance;
    let sumRunning = 0;
    let count = 0;

    for (const r of sortedRecords) {
      if (r.balance !== null && r.balance !== undefined && !isNaN(r.balance)) {
        running = Math.max(0, r.balance);
      } else {
        running = Math.max(0, running + (r.invoiceAmount || 0) - (r.paymentAmount || 0));
      }
      sumRunning += running;
      count++;
    }

    if (count > 0 && (sumRunning / count) > 0) {
      return roundTo(sumRunning / count, 2);
    }
  }

  // الطريقة التقليدية (متوسط رصيد أول وآخر المدة):
  return roundTo((openingBalance + closingBalance) / 2, 2);
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
  // معدل الدوران السنوي الإجمالي الحقيقي (معادل لـ 365 يوم) ليتطابق رياضياً مع أيام التحصيل:
  const avgTurnover = avgDSO > 0 ? (365 / avgDSO) : (periodTurnover > 0 ? periodTurnover * (365 / periodDays) : 0);
  
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
