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
 * بناءً على متوسط أيام التحصيل (DSO) المباشرة
 */
function classifyClient(result, thresholds) {
  const dso = result.dso || 0;

  // التصنيف المباشر والمنطقي بناءً على سرعة سداد العميل
  if (dso <= thresholds.good.maxDSO) {
    return 'good';     // ممتاز (A)
  } else if (dso <= thresholds.average.maxDSO) {
    return 'average';  // عادي (B)
  } else {
    return 'poor';     // بطيء (C)
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

  // ═══════ القسم الأول: التحصيل ═══════
  if (client.classification === 'poor') {
    recommendations.push(
      `🔴 تصنيف السداد: ${client.classLabel} — متوسط أيام التحصيل ${formatNumber(client.dso, 0)} يوم (مرتفع)`
    );
    recommendations.push(
      `📋 يُنصح بمراجعة شروط الدفع أو تقليل حد الائتمان`
    );
  } else if (client.classification === 'average') {
    recommendations.push(
      `🟡 تصنيف السداد: ${client.classLabel} — ${formatNumber(client.dso, 0)} يوم تحصيل`
    );
    recommendations.push(
      `📋 يمكن تحسين أداء العميل بمتابعة التحصيل وتقديم خصم سداد مبكر`
    );
  } else {
    recommendations.push(
      `🟢 تصنيف السداد: ${client.classLabel} — ${formatNumber(client.dso, 0)} يوم فقط`
    );
    recommendations.push(
      `⭐ يستحق مكافأة الالتزام بخصم تفضيلي أو زيادة حد ائتماني`
    );
  }

  // ═══════ القسم الثاني: الجدوى ═══════
  if (client.isFeasible) {
    recommendations.push(
      `✅ الجدوى: مُجدي — العائد على المديونية (${formatPercent(client.returnOnAR)}) يفوق الحد الأدنى (${formatPercent(client.hurdleRate)}) بفائض ${formatPercent(client.feasibilityIndex)}`
    );
  } else {
    recommendations.push(
      `⚠️ الجدوى: غير مُجدي — العائد على المديونية (${formatPercent(client.returnOnAR)}) أقل من الحد الأدنى (${formatPercent(client.hurdleRate)}) بعجز ${formatPercent(Math.abs(client.feasibilityIndex))}`
    );
    recommendations.push(
      `💰 تكلفة الفرصة البديلة: ${formatNumber(client.opportunityCost)} جنيه — إيداع نفس المبلغ بالبنك كان سيحقق هذا العائد`
    );
  }

  // ═══════ القسم الثالث: التسعير ═══════
  recommendations.push(
    `🏷️ علاوة المخاطر المطبقة: ${formatPercent(client.riskPremium)} — تكلفة التمويل: ${formatPercent(client.financingCostPct)}`
  );

  if (!client.isFeasible) {
    recommendations.push(
      `💡 لتحقيق الجدوى: يُنصح بزيادة سعر البيع بنسبة ${formatPercent(client.requiredMarkup)} على الأقل أو تقصير مدة الائتمان`
    );
  }

  return recommendations;
}
