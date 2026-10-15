/* ============================================
   Pricing Engine — محرك التسعير الديناميكي
   القسم الثالث: التسعير حسب سرعة السداد
   ============================================ */

const PricingEngine = {

  /**
   * حساب السعر المقترح لعميل واحد
   * المعادلة: customer_price = cash_price × [1 + ((annual_rate / 365) × DSO) + risk_premium]
   *
   * @param {number} cashPrice - السعر النقدي للوحدة
   * @param {number} annualLendingRate - سعر الإقراض السنوي (نسبة مئوية)
   * @param {number} customerDSO - متوسط أيام التحصيل الفعلي للعميل
   * @param {number} riskPremiumPct - علاوة المخاطر حسب تصنيف العميل (نسبة مئوية)
   * @returns {Object} تفاصيل السعر
   */
  calculateCustomerPrice(cashPrice, annualLendingRate, customerDSO, riskPremiumPct) {
    const dailyRate = (annualLendingRate / 100) / 365;
    const financingCostPct = dailyRate * customerDSO * 100; // كنسبة مئوية
    const riskPremium = riskPremiumPct || 0;
    const totalMarkupPct = financingCostPct + riskPremium;
    const multiplier = 1 + (totalMarkupPct / 100);
    const suggestedPrice = cashPrice * multiplier;
    const priceDifference = suggestedPrice - cashPrice;

    return {
      cashPrice: roundTo(cashPrice, 2),
      financingCostPct: roundTo(financingCostPct, 2),
      riskPremiumPct: roundTo(riskPremium, 2),
      totalMarkupPct: roundTo(totalMarkupPct, 2),
      suggestedPrice: roundTo(suggestedPrice, 2),
      priceDifference: roundTo(priceDifference, 2),
      multiplier: roundTo(multiplier, 4)
    };
  },

  /**
   * تحديد علاوة المخاطر بناءً على تصنيف العميل
   * @param {string} classification - تصنيف العميل (good/average/poor)
   * @param {Object} riskPremiums - علاوات المخاطر القابلة للتعديل
   * @returns {number} علاوة المخاطر كنسبة مئوية
   */
  getRiskPremium(classification, riskPremiums) {
    const defaults = {
      good: 0.5,    // 0% – 1%
      average: 2.0, // ~2%
      poor: 4.5     // 4% – 5%
    };
    const premiums = riskPremiums || defaults;
    return premiums[classification] !== undefined ? premiums[classification] : defaults.poor;
  },

  /**
   * حساب تكلفة التمويل الفعلية لعميل
   * @param {number} avgReceivables - متوسط رصيد المديونية
   * @param {number} annualLendingRate - سعر الإقراض السنوي %
   * @param {number} dso - متوسط أيام التحصيل
   * @returns {number} تكلفة التمويل بالجنيه
   */
  calculateFinancingCost(avgReceivables, annualLendingRate, periodDays = 365) {
    return roundTo(avgReceivables * (annualLendingRate / 100) * (periodDays / 365), 2);
  },

  /**
   * حساب تكلفة الفرصة البديلة (ما كان يمكن كسبه من الإيداع البنكي)
   * @param {number} avgReceivables - متوسط رصيد المديونية
   * @param {number} depositRate - سعر عائد الإيداع %
   * @param {number} periodDays - أيام فترة التحليل (الافتراضي 365)
   * @returns {number} تكلفة الفرصة البديلة بالجنيه
   */
  calculateOpportunityCost(avgReceivables, depositRate, periodDays = 365) {
    return roundTo(avgReceivables * (depositRate / 100) * (periodDays / 365), 2);
  },

  /**
   * توليد تقرير تسعير كامل لجميع العملاء
   * @param {Array} classifiedClients - العملاء المصنفون
   * @param {Object} settings - الإعدادات الكلية
   * @returns {Array} تقرير التسعير
   */
  generatePricingReport(classifiedClients, settings) {
    const {
      cashPricePerTon = 0,
      depositRate = 0 // الاعتماد الكلي على نسبة الإيداع التي يدخلها المستخدم
    } = settings;

    return classifiedClients.map(client => {
      // بناءً على طلب المستخدم الحرفي:
      // نسبة الزيادة = فائدة البنك (على الإيداع) ÷ معدل الدوران السنوي للعميل
      let markupPct = 0;
      if (!client.avgReceivables || client.avgReceivables === 0 || client.dso === 0 || client.dso < 1 || client.annualizedTurnover >= 365 || client.isCredit) {
        markupPct = 0; // عميل كاش فوري أو دائن (له رصيد)
      } else if (client.annualizedTurnover > 0) {
        markupPct = depositRate / client.annualizedTurnover;
      } else if (client.dso > 0) {
        markupPct = depositRate * (client.dso / 365);
      }

      // إلغاء كل علاوات المخاطر والإضافات الأخرى كما طلب
      const totalMarkupPct = markupPct;
      const multiplier = 1 + (totalMarkupPct / 100);
      const suggestedPrice = cashPricePerTon * multiplier;
      const priceDifference = suggestedPrice - cashPricePerTon;

      return {
        clientName: client.clientName,
        classification: client.classification,
        classLabel: client.classLabel,
        dso: client.dso,
        riskPremiumPct: 0, // تم التصفير بناء على الطلب
        cashPrice: roundTo(cashPricePerTon, 2),
        financingCostPct: roundTo(totalMarkupPct, 2),
        totalMarkupPct: roundTo(totalMarkupPct, 2),
        suggestedPrice: roundTo(suggestedPrice, 2),
        priceDifference: roundTo(priceDifference, 2),
        financingCostEGP: 0 // تم الإلغاء
      };
    });
  },

  /**
   * حساب ملخص التسعير لكل فئة
   * @param {Array} pricingReport - تقرير التسعير
   * @returns {Object} ملخص حسب الفئة
   */
  generatePricingSummary(pricingReport) {
    const groups = { good: [], average: [], poor: [] };

    pricingReport.forEach(item => {
      if (groups[item.classification]) {
        groups[item.classification].push(item);
      }
    });

    const summary = {};
    for (const [key, items] of Object.entries(groups)) {
      if (items.length === 0) {
        summary[key] = {
          count: 0,
          avgDSO: 0,
          avgSuggestedPrice: 0,
          avgMarkup: 0,
          totalFinancingCost: 0
        };
        continue;
      }

      summary[key] = {
        count: items.length,
        avgDSO: roundTo(items.reduce((s, i) => s + i.dso, 0) / items.length, 1),
        avgSuggestedPrice: roundTo(items.reduce((s, i) => s + i.suggestedPrice, 0) / items.length, 2),
        avgMarkup: roundTo(items.reduce((s, i) => s + i.totalMarkupPct, 0) / items.length, 2),
        totalFinancingCost: roundTo(items.reduce((s, i) => s + i.financingCostEGP, 0), 2)
      };
    }

    return summary;
  }
};
