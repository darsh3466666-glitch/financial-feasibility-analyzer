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
 * مبني على معايير إدارة الائتمان وأعمار الديون (IFRS 9 Aging Matrix) وسرعة التحصيل
 */
function classifyClient(result, thresholds = DEFAULT_THRESHOLDS) {
  const dso = result.dso || 0;
  const isCash = (!result.avgReceivables || result.avgReceivables === 0 || dso === 0 || dso < 1 || result.annualizedTurnover >= 365 || result.isCredit);

  // عميل السداد النقدي الفوري والعميل الدائن دائماً في الفئة الممتازة
  if (isCash) return 'good';

  const aging = result.agingBuckets || {};
  const totalDebt = result.closingBalance > 0 ? result.closingBalance : (aging.total || 0);

  // حالة العميل الذي سدد كامل رصيده الختامي لكن كان له تاريخ ائتماني خلال الفترة
  if (totalDebt <= 0) {
    if (dso <= (thresholds?.good?.maxDSO || 30)) return 'good';
    if (dso <= (thresholds?.average?.maxDSO || 60)) return 'average';
    return 'poor';
  }

  // نسب شرائح أعمار الديون من إجمالي الرصيد القائم
  const over90Ratio = (aging.over90 || 0) / totalDebt;
  const lateRatio = ((aging.days90 || 0) + (aging.over90 || 0)) / totalDebt;
  const currentRatio = (aging.current || 0) / totalDebt;

  // 1. فئة (C - بطيء / عالي المخاطر):
  // ديون راكدة تجاوزت 90 يوماً بنسبة ≥ 20%، أو ديون متأخرة > 60 يوماً بنسبة ≥ 50%، أو متوسط أيام التحصيل تجاوز 90 يوماً
  if (over90Ratio >= 0.20 || lateRatio >= 0.50 || dso > 90) {
    return 'poor';
  }

  // 2. فئة (A - ممتاز / منخفض المخاطر):
  // الديون الجارية (0-30 يوماً) تمثل 70% فأكثر، مع انعدام الديون المتأخرة (>90 يوم < 5%)، وسرعة سداد عالية
  const goodDsoLimit = Math.max(45, (thresholds?.good?.maxDSO || 30));
  if (currentRatio >= 0.70 && over90Ratio < 0.05 && dso <= goodDsoLimit) {
    return 'good';
  }

  // 3. فئة (B - عادي / متوسط المخاطر):
  // باقي الحالات المعتدلة التي تتركز في (31 - 60 يوماً) ولا تتجاوز الحدود الخطرة
  return 'average';
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
  const isCash = (!client.avgReceivables || client.avgReceivables === 0 || client.dso === 0 || client.dso < 1 || client.annualizedTurnover >= 365 || client.isCredit);
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
