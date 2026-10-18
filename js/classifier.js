/* ============================================
   Classifier — تصنيف العملاء مع علاوات المخاطر
   القسم الثالث: تصنيف A/B/C حسب سرعة السداد
   ============================================ */

/**
 * معايير التصنيف الافتراضية
 */
const DEFAULT_THRESHOLDS = {
  good: {
    maxDSO: 30,        // ≤ 30 يوم تحصيل — فئة A ممتاز (جيد)
    minTurnover: 8
  },
  average: {
    maxDSO: 90,        // 31-90 يوم تحصيل — فئة B عادي (متوسط)
    minTurnover: 3
  }
  // poor: > 90 يوم تحصيل — فئة C بطيء (سئ)
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
  const isInstantCash = (result.isCredit || (dso === 0 && (!result.closingBalance || result.closingBalance <= 0)));

  // عميل السداد النقدي الفوري والعميل الدائن دائماً في الفئة الممتازة
  if (isInstantCash) return 'good';

  const maxGood = thresholds?.good?.maxDSO !== undefined ? thresholds.good.maxDSO : 30;
  const maxAvg = thresholds?.average?.maxDSO !== undefined ? thresholds.average.maxDSO : 90;

  // فحص شريحة الأيام الواقعية:
  // <= 30 يوم: ممتاز (A)
  // 31 - 90 يوم: عادي (B)
  // > 90 يوم: بطيء (C)
  if (dso <= maxGood) {
    return 'good';
  } else if (dso <= maxAvg) {
    return 'average';
  } else {
    return 'poor';
  }
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
