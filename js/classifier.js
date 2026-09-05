/* ============================================
   Classifier — تصنيف العملاء مع علاوات المخاطر
   القسم الثالث: تصنيف A/B/C حسب سرعة السداد
   ============================================ */

/**
 * معايير التصنيف الافتراضية
 */
const DEFAULT_THRESHOLDS = {
  good: {
    maxDSO: 30,        // ≤ 30 يوم تحصيل — فئة A ممتاز
    minTurnover: 12    // ≥ 12 مرة دوران سنوي
  },
  average: {
    maxDSO: 60,        // 31-60 يوم تحصيل — فئة B عادي
    minTurnover: 6     // 6-12 مرة دوران سنوي
  }
  // poor: > 60 يوم أو < 6 دوران — فئة C بطيء/متعثر
};

/**
 * علاوات المخاطر الافتراضية لكل فئة (نسبة مئوية)
 * من التقرير الفني — القسم الثالث
 */
const DEFAULT_RISK_PREMIUMS = {
  good: 0.5,     // A: 0% – 1%
  average: 2.0,  // B: ~2%
  poor: 4.5      // C: 4% – 5%
};

/**
 * بيانات التصنيفات (metadata)
 */
const CLASSIFICATION_META = {
  good: {
    label: 'ممتاز (A)',
    shortLabel: 'A',
    color: 'var(--accent-success)',
    bgColor: 'var(--accent-success-light)',
    surfaceColor: 'var(--accent-success-surface)',
    icon: 'check-circle',
    emoji: '🟢',
    policy: 'يمكن منح خصم تفضيلي كمكافأة التزام'
  },
  average: {
    label: 'عادي (B)',
    shortLabel: 'B',
    color: 'var(--accent-warning)',
    bgColor: 'var(--accent-warning-light)',
    surfaceColor: 'var(--accent-warning-surface)',
    icon: 'alert-circle',
    emoji: '🟡',
    policy: 'السعر القياسي + تكلفة التمويل'
  },
  poor: {
    label: 'بطيء (C)',
    shortLabel: 'C',
    color: 'var(--accent-danger)',
    bgColor: 'var(--accent-danger-light)',
    surfaceColor: 'var(--accent-danger-surface)',
    icon: 'x-circle',
    emoji: '🔴',
    policy: 'تسعير أعلى، أو تحويل لسياسة دفع مقدم/نقدي فقط'
  }
};

/**
 * تصنيف جميع العملاء مع إضافة علاوة المخاطر
 * @param {Array} results - نتائج التحليل المالي
 * @param {Object} thresholds - معايير التصنيف
 * @param {Object} riskPremiums - علاوات المخاطر القابلة للتعديل
 * @returns {Array} العملاء مع التصنيف وعلاوة المخاطر
 */
function classifyClients(results, thresholds = null, riskPremiums = null) {
  const t = thresholds || DEFAULT_THRESHOLDS;
  const rp = riskPremiums || DEFAULT_RISK_PREMIUMS;

  return results.map(result => {
    const classification = classifyClient(result, t);
    const meta = CLASSIFICATION_META[classification];
    const riskPremium = rp[classification] !== undefined ? rp[classification] : DEFAULT_RISK_PREMIUMS[classification];

    return {
      ...result,
      classification,
      classLabel: meta.label,
      classShortLabel: meta.shortLabel,
      classColor: meta.color,
      classBgColor: meta.bgColor,
      classSurfaceColor: meta.surfaceColor,
      classIcon: meta.icon,
      classPolicy: meta.policy,
      riskPremium: roundTo(riskPremium, 2)
    };
  });
}

/**
 * تصنيف عميل واحد
 * بناءً على متوسط أيام التحصيل ومعدل الدوران السنوي
 */
function classifyClient(result, thresholds) {
  const dso = result.dso;
  const collectionRate = result.collectionRate || 0;
  const isCash = (!result.avgReceivables || result.avgReceivables === 0 || dso === 0 || dso < 1 || result.annualizedTurnover >= 365 || result.isCredit || (result.closingBalance !== null && result.closingBalance <= 0));

  // عميل السداد النقدي الفوري والعميل الدائن دائماً في الفئة الممتازة
  if (isCash) return 'good';

  // نظام التسجيل المالي المتوازن: يجمع بين سرعة السداد والالتزام بنسبة التحصيل
  let score = 0;

  // 1. تقييم سرعة السداد (أيام التحصيل DSO) — حد أقصى نقطتان
  if (dso <= thresholds.good.maxDSO) {
    score += 2;  // سريع جداً (≤ 30 يوم)
  } else if (dso <= thresholds.average.maxDSO) {
    score += 1;  // سرعة مقبولة (31 - 60 يوم)
  }
  // > 60 يوم = 0 (تأخير عالي)

  // 2. تقييم نسبة التحصيل والالتزام (Collection Rate) — حد أقصى نقطتان (بدلاً من تكرار مؤشر الدوران)
  if (collectionRate >= 80) {
    score += 2;  // التزام ممتاز (سدد 80% فأكثر من مديونيته)
  } else if (collectionRate >= 50) {
    score += 1;  // التزام متوسط (سدد من 50% إلى 79%)
  }
  // أقل من 50% = 0 (معظم المديونية معلقة بالسوق)

  // التصنيف النهائي:
  // 3 أو 4 نقاط = ممتاز (A)
  // 1 أو 2 نقاط = عادي (B)
  // 0 نقاط = بطيء/متأخر (C)
  if (score >= 3) return 'good';
  if (score >= 1) return 'average';
  return 'poor';
}

/**
 * الحصول على معايير التصنيف الافتراضية
 */
function getDefaultThresholds() {
  return JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));
}

/**
 * الحصول على علاوات المخاطر الافتراضية
 */
function getDefaultRiskPremiums() {
  return JSON.parse(JSON.stringify(DEFAULT_RISK_PREMIUMS));
}

/**
 * الحصول على بيانات التصنيف
 */
function getClassificationMeta(classification) {
  return CLASSIFICATION_META[classification] || CLASSIFICATION_META.poor;
}

/**
 * توليد توصية شاملة للعميل — الأقسام الثلاثة
 */
function generateRecommendation(client) {
  const recommendations = [];

  // ═══════ توصيات التحصيل وشروط الائتمان ═══════
  if (client.classification === 'poor') {
    recommendations.push(
      `🔴 تصنيف السداد: ${client.classLabel} — متوسط أيام التحصيل ${formatNumber(client.dso, 0)} يوم (تأخير مرتفع)`
    );
    recommendations.push(
      `📋 يُنصح بمراجعة شروط الدفع أو تقليل سقف الائتمان والتحويل للدفع النقدي الفوري عند الاستلام.`
    );
  } else if (client.classification === 'average') {
    recommendations.push(
      `🟡 تصنيف السداد: ${client.classLabel} — متوسط أيام التحصيل ${formatNumber(client.dso, 0)} يوم`
    );
    recommendations.push(
      `📋 يُنصح بمتابعة التحصيل الدوري وتقديم خصم تعجيل دفع لتشجيع السداد المبكر.`
    );
  } else {
    recommendations.push(
      `🟢 تصنيف السداد: ${client.classLabel} — متوسط أيام التحصيل ${formatNumber(client.dso, 0)} يوم فقط (سداد سريع)`
    );
    recommendations.push(
      `⭐ عميل ملتزم بالسداد، يستحق الحفاظ عليه وتفضيله في المعاملات.`
    );
  }

  // ═══════ تسعير العميل المقترح الخاص بحالته ═══════
  const isCash = (!client.avgReceivables || client.avgReceivables === 0 || client.dso === 0 || client.dso < 1 || client.annualizedTurnover >= 365);
  const priceVal = (client.suggestedPrice && client.suggestedPrice > 0) ? client.suggestedPrice : (client.cashPrice || 0);

  if (isCash) {
    recommendations.push(
      `💵 التسعير المقترح: يُباع له بسعر الكاش الأساسي (${formatNumber(priceVal)} جنيه/وحدة) بدون أي زيادة لالتزامه بالسداد الفوري.`
    );
  } else if (client.totalMarkupPct > 0) {
    recommendations.push(
      `🏷️ التسعير المقترح: السعر العادل للبيع له هو ${formatNumber(priceVal)} جنيه/وحدة (بزيادة +${formatPercent(client.totalMarkupPct)}) لتعويض تكلفة انتظار أموال الشركة لمدة ${formatNumber(client.dso, 0)} يوم.`
    );
  }

  // ═══════ تقييم الجدوى ═══════
  if (client.isFeasible) {
    recommendations.push(`✅ الجدوى العامة: العميل مُجدي استثمارياً وائتمانياً للشركة.`);
  } else {
    recommendations.push(`⚠️ الجدوى العامة: العميل غير مُجدي ائتمانياً (تأخير السداد أو ضعف التحصيل يستنزف أموال الشركة، ويُنصح بالتحول للدفع النقدي الفوري معه).`);
  }

  return recommendations;
}
