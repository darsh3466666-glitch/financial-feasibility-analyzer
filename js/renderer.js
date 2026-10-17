/* ============================================
   Renderer — عرض النتائج الشاملة
   يغطي: KPIs, الجدوى, أعمار الديون, التسعير, الجدول, التفاصيل
   ============================================ */

const Renderer = {

  /* ═══════════════════════════════════════════
     KPI Dashboard — لوحة المؤشرات الرئيسية
     ═══════════════════════════════════════════ */
  renderKPIs(summary, salesByClass) {
    const container = document.getElementById('kpi-grid');
    if (!container) return;

    const totalClients = summary.totalClients || 0;
    const feasiblePct = totalClients > 0 ? (summary.feasibleCount / totalClients) * 100 : 0;
    const notFeasiblePct = totalClients > 0 ? (summary.notFeasibleCount / totalClients) * 100 : 0;

    const goodCount = salesByClass?.good?.count || 0;
    const avgCount = salesByClass?.average?.count || 0;
    const poorCount = salesByClass?.poor?.count || 0;

    const goodPct = totalClients > 0 ? (goodCount / totalClients) * 100 : 0;
    const avgPct = totalClients > 0 ? (avgCount / totalClients) * 100 : 0;
    const poorPct = totalClients > 0 ? (poorCount / totalClients) * 100 : 0;
    
    let dsoEval = '';
    if (summary.avgDSO <= 30) dsoEval = 'جيد جداً (دورة سريعة)';
    else if (summary.avgDSO <= 60) dsoEval = 'متوسط (مقبول)';
    else dsoEval = 'ضعيف (تأخير عالي)';

    container.innerHTML = `
      <div class="kpi-card kpi-card--primary animate-in">
        <div class="kpi-icon">
          <svg class="icon"><use href="#users"></use></svg>
        </div>
        <span class="kpi-label">${summary.dormantClientsCount > 0 ? 'العملاء النشطين خلال الفترة' : 'إجمالي العملاء'}</span>
        <span class="kpi-value">${formatNumber(totalClients)}</span>
        ${summary.dormantClientsCount > 0 ? `
          <div style="font-size: 0.73rem; color: var(--text-secondary); margin-top: 2px;">
            من أصل ${formatNumber(summary.totalImportedClients)} عميل بالـ ERP (${formatNumber(summary.dormantClientsCount)} خامل بدون حركة)
          </div>
        ` : ''}
        <div style="margin-top: 8px; width: 100%; border-top: 1px solid var(--border-default); padding-top: 6px; font-size: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="color: var(--accent-success); font-weight: 600;">مُجدي: ${formatNumber(summary.feasibleCount)} (${formatPercent(feasiblePct)})</span>
            <span style="color: var(--accent-danger); font-weight: 600;">غير مُجدي: ${formatNumber(summary.notFeasibleCount)} (${formatPercent(notFeasiblePct)})</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-secondary); font-size: 0.72rem;">
            <span><strong style="color: var(--accent-success);">A:</strong> ${formatNumber(goodCount)} (${formatPercent(goodPct)})</span>
            <span><strong style="color: var(--accent-warning);">B:</strong> ${formatNumber(avgCount)} (${formatPercent(avgPct)})</span>
            <span><strong style="color: var(--accent-danger);">C:</strong> ${formatNumber(poorCount)} (${formatPercent(poorPct)})</span>
          </div>
        </div>
      </div>

      <div class="kpi-card kpi-card--gold animate-in">
        <div class="kpi-icon">
          <svg class="icon"><use href="#banknotes"></use></svg>
        </div>
        <span class="kpi-label">إجمالي المبيعات</span>
        <span class="kpi-value">${formatNumber(summary.totalSales)}</span>
        <span class="kpi-sub">صافي إجمالي المبيعات (بالجنيه)</span>
      </div>

      <div class="kpi-card kpi-card--warning animate-in">
        <div class="kpi-icon">
          <svg class="icon"><use href="#clock"></use></svg>
        </div>
        <span class="kpi-label">متوسط أيام التحصيل (DSO)</span>
        <span class="kpi-value">${formatNumber(summary.avgDSO, 0)}</span>
        <span class="kpi-sub">يوم — ${dsoEval} (معدل أيام التحصيل)</span>
      </div>

      <div class="kpi-card kpi-card--danger animate-in">
        <div class="kpi-icon">
          <svg class="icon"><use href="#wallet"></use></svg>
        </div>
        <span class="kpi-label">إجمالي متوسط حسابات المدينين</span>
        <span class="kpi-value">${formatNumber(summary.totalReceivables)}</span>
        <span class="kpi-sub">إجمالي متوسط رصيد السوق لكافة العملاء (جنيه)</span>
      </div>

      <div class="kpi-card kpi-card--success animate-in">
        <div class="kpi-icon">
          <svg class="icon"><use href="#refresh"></use></svg>
        </div>
        <span class="kpi-label">معدل دوران المديونية السنوي</span>
        <span class="kpi-value">${formatNumber(summary.avgTurnover, 1)}</span>
        <span class="kpi-sub">مرة سنوياً (متوافق مع متوسط سداد ${formatNumber(summary.avgDSO, 0)} يوم)</span>
      </div>

      <div class="kpi-card animate-in" style="border-top: 3px solid ${summary.avgCollectionRate >= 75 ? 'var(--accent-success)' : summary.avgCollectionRate >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)'};">
        <div class="kpi-icon" style="color: ${summary.avgCollectionRate >= 75 ? 'var(--accent-success)' : summary.avgCollectionRate >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)'};">
          <svg class="icon"><use href="#shield"></use></svg>
        </div>
        <span class="kpi-label">معدل التحصيل الإجمالي للمحفظة</span>
        <span class="kpi-value" style="color: ${summary.avgCollectionRate >= 75 ? 'var(--accent-success)' : summary.avgCollectionRate >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)'};">${formatPercent(summary.avgCollectionRate)}</span>
        <span class="kpi-sub">نسبة المحصّل نقداً من إجمالي المستحق</span>
      </div>

    `;
  },

  /* ═══════════════════════════════════════════
     Feasibility Dashboard — مؤشر الجدوى
     القسم الثاني من التقرير
     ═══════════════════════════════════════════ */
  renderFeasibilityDashboard(summary, salesByClass) {
    const container = document.getElementById('feasibility-content');
    if (!container) return;

    const classLabels = {
      good: { label: 'A ممتاز', badge: 'badge-good' },
      average: { label: 'B عادي', badge: 'badge-average' },
      poor: { label: 'C بطيء', badge: 'badge-poor' }
    };

    let html = `
      <div class="feasibility-grid">
        <!-- مؤشرات الجدوى الكلية -->
        <div class="feasibility-card card animate-in">
          <div class="feasibility-header">
            <span class="feasibility-title">متوسط نقاط الجودة الشاملة</span>
            <span class="feasibility-value" style="color: ${summary.avgQualityScore >= 50 ? 'var(--accent-success)' : 'var(--accent-danger)'}">${formatNumber(summary.avgQualityScore, 1)} / 100</span>
          </div>
          <div class="feasibility-bar-container">
            <div class="feasibility-bar feasibility-bar--hurdle" style="width: ${Math.min(summary.avgQualityScore, 100)}%; background-color: ${summary.avgQualityScore >= 50 ? 'var(--accent-success)' : 'var(--accent-danger)'}"></div>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-light);">
            <strong>المعادلة:</strong> نقاط التحصيل (35) + نقاط سرعة السداد (40) + معدل الدوران (25)
          </div>
        </div>

        <div class="feasibility-card card animate-in">
          <div class="feasibility-header">
            <span class="feasibility-title">نسبة الخسارة الخفية (من المبيعات)</span>
            <span class="feasibility-value" style="color: var(--accent-danger)">${formatPercent(summary.avgHiddenLossPct)}</span>
          </div>
          <div class="feasibility-bar-container">
            <div class="feasibility-bar feasibility-bar--return" style="width: ${Math.min(summary.avgHiddenLossPct * 5, 100)}%; background-color: var(--accent-danger)"></div>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-light);">
            <strong>المعادلة:</strong> (أيام التحصيل DSO ÷ 365) × نسبة الفائدة البنكية
          </div>
        </div>

        <div class="feasibility-card card animate-in">
          <div class="feasibility-header">
            <span class="feasibility-title">قيمة تكلفة الأموال المعطلة (الفرصة البديلة)</span>
            <span class="feasibility-value" style="color: var(--accent-warning)">${formatNumber(summary.totalOpportunityCost)} جنيه</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-light);">
            <strong>المعادلة:</strong> متوسط المديونية × نسبة الفائدة × (الفترة ÷ 365)
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  /* ═══════════════════════════════════════════
     Aging Report — تقرير أعمار الديون
     ═══════════════════════════════════════════ */
  renderAgingReport(summary) {
    const container = document.getElementById('aging-content');
    if (!container || !summary || !summary.totalAging) return;

    const aging = summary.totalAging;
    const total = aging.total || 1; // تجنب القسمة على صفر
    const netBalance = summary.netMarketBalance !== undefined ? summary.netMarketBalance : (summary.totalDebt ?? aging.total);
    const grossReceivables = summary.grossReceivables || aging.total;
    const creditBalances = summary.creditBalances || 0;
    const creditClientsCount = summary.creditClientsCount || 0;

    const buckets = [
      { label: '0 - 30 يوم', amount: aging.current, pct: (aging.current / total * 100), color: 'var(--accent-success)' },
      { label: '31 - 60 يوم', amount: aging.days60, pct: (aging.days60 / total * 100), color: 'var(--accent-warning)' },
      { label: '61 - 90 يوم', amount: aging.days90, pct: (aging.days90 / total * 100), color: 'var(--accent-danger)' },
      { label: '> 90 يوم', amount: aging.over90, pct: (aging.over90 / total * 100), color: '#7C3AED' }
    ];

    let html = `
      <div class="card">
        <div class="aging-summary" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 16px;">
          <div class="aging-total">
            <span class="aging-total-label">صافي رصيد السوق</span>
            <span class="aging-total-value" style="color: var(--accent-primary); font-size: 1.6rem; font-weight: 800;">${formatNumber(netBalance)} جنيه</span>
            <span style="display: block; font-size: 0.82rem; margin-top: 5px; color: var(--text-secondary);">
              إجمالي المدينين: <strong style="color: var(--text-primary);">${formatNumber(grossReceivables)}</strong> جنيه
              ${creditBalances > 0 ? ` | إجمالي الدائنين (دفعات مقدمة): <strong style="color: var(--accent-success);">${formatNumber(creditBalances)}</strong> جنيه` : ''}
            </span>
          </div>

          ${creditBalances > 0 ? `
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid var(--accent-success); border-radius: var(--radius-md); padding: 8px 16px; text-align: right;">
            <div style="font-size: 0.8rem; color: var(--accent-success); font-weight: 600;">أرصدة العملاء الدائنة (دفعات مقدمة)</div>
            <div style="font-size: 1.15rem; font-weight: 700; color: var(--accent-success);">${formatNumber(creditBalances)} جنيه</div>
            <div style="font-size: 0.72rem; color: var(--text-secondary);">${formatNumber(creditClientsCount)} عميل دائن (سداد مقدم)</div>
          </div>
          ` : ''}
        </div>

        <!-- شريط الأعمار المرئي -->
        <div class="aging-bar-visual">
          ${buckets.map(b => b.pct > 0 ? `<div class="aging-bar-segment" style="width: ${Math.max(b.pct, 2)}%; background-color: ${b.color};" title="${b.label}: ${formatPercent(b.pct)}"></div>` : '').join('')}
        </div>

        <!-- تفاصيل الأعمار -->
        <div class="aging-grid">
          ${buckets.map(b => `
            <div class="aging-bucket">
              <div class="aging-bucket-header">
                <span class="aging-dot" style="background-color: ${b.color};"></span>
                <span class="aging-bucket-label">${b.label}</span>
              </div>
              <span class="aging-bucket-amount">${formatNumber(b.amount)} جنيه</span>
              <span class="aging-bucket-pct">${formatPercent(b.pct)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  /* ═══════════════════════════════════════════
     Pricing Engine — جدول التسعير الديناميكي
     القسم الثالث من التقرير
     ═══════════════════════════════════════════ */
  renderPricingTable(pricingReport, pricingSummary, cashPrice) {
    const container = document.getElementById('pricing-content');
    if (!container) return;

    const classLabels = {
      good: { label: 'A ممتاز', badge: 'badge-good' },
      average: { label: 'B عادي', badge: 'badge-average' },
      poor: { label: 'C بطيء', badge: 'badge-poor' }
    };

    // ملخص التسعير حسب الفئة
    let html = `
      <div class="pricing-summary-grid">
        ${Object.entries(pricingSummary).map(([key, data]) => {
          const meta = classLabels[key];
          return `
            <div class="card pricing-summary-card animate-in">
              <span class="badge ${meta.badge}" style="margin-bottom: var(--space-3);">${meta.label}</span>
              <div class="pricing-summary-item">
                <span class="pricing-summary-label">متوسط السعر المقترح</span>
                <span class="pricing-summary-value">${formatNumber(data.avgSuggestedPrice)} جنيه/وحدة</span>
              </div>
              <div class="pricing-summary-item">
                <span class="pricing-summary-label">متوسط نسبة الزيادة</span>
                <span class="pricing-summary-value">${formatPercent(data.avgMarkup)}</span>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    container.innerHTML = html;
  },

  /* ═══════════════════════════════════════════
     Sales Analysis — تحليل المبيعات حسب التصنيف
     ═══════════════════════════════════════════ */
  renderSalesAnalysis(salesByClass) {
    const container = document.getElementById('sales-analysis-content');
    if (!container) return;

    const classLabels = {
      good: { label: 'A ممتاز', badge: 'badge-good' },
      average: { label: 'B عادي', badge: 'badge-average' },
      poor: { label: 'C بطيء', badge: 'badge-poor' }
    };

    let tableHTML = `
      <div class="data-table-wrapper">
        <table class="data-table sales-analysis-table">
          <thead>
            <tr>
              <th>التصنيف</th>
              <th>عدد العملاء</th>
              <th>إجمالي المبيعات</th>
              <th>نسبة المبيعات</th>
              <th>الرصيد الآجل المتبقي</th>
              <th>نسبة الآجل</th>
              <th>متوسط أيام التحصيل</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const [key, data] of Object.entries(salesByClass)) {
      const meta = classLabels[key];
      tableHTML += `
        <tr>
          <td><span class="badge ${meta.badge}">${meta.label}</span></td>
          <td class="num-cell">${formatNumber(data.count)}</td>
          <td class="num-cell" style="color: var(--accent-primary); font-weight: 600;">${formatNumber(data.totalSales)} جنيه</td>
          <td class="num-cell" style="color: var(--accent-primary); font-weight: 600;">${formatPercent(data.salesPercentage)}</td>
          <td class="num-cell" style="color: var(--accent-warning); font-weight: 600;">${formatNumber(data.totalCreditSales)} جنيه</td>
          <td class="num-cell" style="color: var(--accent-warning); font-weight: 600;">${formatPercent(data.creditSalesPercentage)}</td>
          <td class="num-cell">${formatNumber(data.avgDSO, 0)} يوم</td>
        </tr>
      `;
    }

    tableHTML += '</tbody></table></div>';
    container.innerHTML = tableHTML;
  },

  /* ═══════════════════════════════════════════
     Clients Table — جدول العملاء المُوسّع
     ═══════════════════════════════════════════ */
  renderClientsTable(clients, sortConfig = null) {
    const container = document.getElementById('clients-table-body');
    if (!container) return;

    let sorted = [...clients];

    // الفرز
    if (sortConfig) {
      sorted.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === 'closingBalance') {
          valA = a.closingBalance || 0;
          valB = b.closingBalance || 0;
        }
        if (sortConfig.key === 'annualizedTurnover') {
          valA = a.arTurnover !== undefined ? a.arTurnover : a.annualizedTurnover;
          valB = b.arTurnover !== undefined ? b.arTurnover : b.annualizedTurnover;
          if (!a.avgReceivables || a.avgReceivables === 0 || a.dso === 0 || a.isCredit) valA = Infinity;
          if (!b.avgReceivables || b.avgReceivables === 0 || b.dso === 0 || b.isCredit) valB = Infinity;
        }
        if (sortConfig.key === 'isFeasible') {
          valA = a.isFeasible ? 1 : 0;
          valB = b.isFeasible ? 1 : 0;
        }
        if (sortConfig.key === 'totalMarkupPct') {
          valA = a.totalMarkupPct || 0;
          valB = b.totalMarkupPct || 0;
        }
        if (sortConfig.key === 'suggestedPrice') {
          valA = a.suggestedPrice || 0;
          valB = b.suggestedPrice || 0;
        }

        if (typeof valA === 'string') {
          return sortConfig.dir === 'asc'
            ? valA.localeCompare(valB, 'ar')
            : valB.localeCompare(valA, 'ar');
        }

        return sortConfig.dir === 'asc' ? valA - valB : valB - valA;
      });
    }

    container.innerHTML = sorted.map((client, index) => {
      const isCredit = client.isCredit;
      const isCash = (!client.avgReceivables || client.avgReceivables === 0 || client.dso === 0 || isCredit);
      const turnoverText = isCredit ? 'نقدي (دائن)' : (isCash ? 'نقدي ∞' : formatNumber(client.arTurnover !== undefined ? client.arTurnover : client.annualizedTurnover, 2));
      const dsoText = isCredit ? '0 يوم (دائن)' : (isCash ? '0 يوم (سداد فوري)' : `${formatNumber(client.dso, 1)} يوم`);

      const closingVal = client.closingBalance || 0;
      let closingHtml = '';
      if (closingVal < 0) {
        closingHtml = `<span style="color: var(--accent-success); font-weight: 600;" title="رصيد دائن / دفعة مقدمة">${formatNumber(Math.abs(closingVal))} (دائن)</span>`;
      } else if (closingVal > 0) {
        closingHtml = `<span style="font-weight: 700; color: var(--accent-danger);">${formatNumber(closingVal)}</span>`;
      } else {
        closingHtml = `<span style="color: var(--text-secondary); opacity: 0.5;">0</span>`;
      }

      let classColor = 'var(--accent-success)';
      if (client.classification === 'average') classColor = 'var(--accent-warning)';
      if (client.classification === 'poor') classColor = 'var(--accent-danger)';

      const markupVal = isCash ? 0 : (client.totalMarkupPct || 0);
      const markupContent = isCash ? '0.0% (كاش)' : `+${formatPercent(markupVal)}`;
      const markupText = `<span style="color: ${classColor}; font-weight: 600;">${markupContent}</span>`;

      const priceVal = (client.suggestedPrice && client.suggestedPrice > 0) ? client.suggestedPrice : (client.cashPrice || 0);
      const priceText = `<span style="color: ${classColor}; font-weight: 700;">${formatNumber(priceVal)} جنيه</span>`;

      return `
      <tr class="animate-in" style="animation-delay: ${Math.min(index * 30, 300)}ms">
        <td class="client-name" data-client="${escapeHTML(client.clientName)}" onclick="App.showClientDetail('${escapeHTML(client.clientName)}')" title="اضغط لعرض التفاصيل">
          ${escapeHTML(client.clientName)}
          ${isCredit ? ` <span class="badge badge-good" style="font-size:0.65rem; padding: 2px 6px; margin-right: 4px;" title="رصيد دائن / دفعة مقدمة">دائن</span>` : ''}
        </td>
        <td class="num-cell">${formatNumber(client.totalSales)}</td>
        <td class="num-cell">${closingHtml}</td>
        <td class="num-cell">${formatNumber(client.avgReceivables)}</td>
        <td class="num-cell" style="${isCash ? 'color: var(--accent-success); font-weight: var(--weight-bold);' : ''}">${turnoverText}</td>
        <td class="num-cell" style="${isCash ? 'color: var(--accent-success);' : ''}">${dsoText}</td>
        <td class="num-cell" style="color: ${client.collectionRate >= 80 ? 'var(--accent-success)' : client.collectionRate >= 50 ? 'var(--accent-warning)' : 'var(--accent-danger)'}; font-weight: 600;">${formatPercent(client.collectionRate)}</td>
        <td>
          <span class="badge badge-${client.classification}">${client.classLabel}</span>
        </td>
        <td>
          <span class="badge ${client.isFeasible ? 'badge-feasible' : 'badge-not-feasible'}">
            ${client.isFeasible ? 'مُجدي' : 'غير مُجدي'}
          </span>
        </td>
        <td class="num-cell">${markupText}</td>
        <td class="num-cell">${priceText}</td>
      </tr>
      `;
    }).join('');
  },

  /* ═══════════════════════════════════════════
     Client Detail Modal — بطاقة تفصيلية مُوسّعة
     ═══════════════════════════════════════════ */
  renderClientDetail(client) {
    const modal = document.getElementById('client-modal');
    if (!modal) return;

    const recommendations = generateRecommendation(client);
    const aging = client.agingBuckets || {};
    const isCredit = client.isCredit;
    const isCash = (!client.avgReceivables || client.avgReceivables === 0 || client.dso === 0 || isCredit);
    const turnoverText = isCredit ? 'نقدي (دائن)' : (isCash ? 'نقدي ∞' : `${formatNumber(client.arTurnover !== undefined ? client.arTurnover : client.annualizedTurnover, 2)} مرة`);
    const dsoText = isCredit ? '0 يوم (دائن / دفعة مقدمة)' : (isCash ? '0 يوم (سداد فوري)' : `${formatNumber(client.dso, 1)} يوم`);
    const priceVal = (client.suggestedPrice && client.suggestedPrice > 0) ? client.suggestedPrice : (client.cashPrice || 0);

    let classColor = 'var(--accent-success)';
    if (client.classification === 'average') classColor = 'var(--accent-warning)';
    if (client.classification === 'poor') classColor = 'var(--accent-danger)';

    document.getElementById('modal-client-name').textContent = client.clientName;

    document.getElementById('modal-body').innerHTML = `
      <div class="client-detail-grid">
        <!-- القسم الأول: دوران المديونية -->
        <div class="client-detail-item">
          <span class="detail-label">إجمالي المبيعات</span>
          <span class="detail-value">${formatNumber(client.totalSales)} جنيه</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">عدد الفواتير</span>
          <span class="detail-value">${formatNumber(client.transactionCount)}</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">رصيد أول المدة</span>
          <span class="detail-value">${formatNumber(client.openingBalance)} جنيه</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">رصيد آخر المدة</span>
          <span class="detail-value">${formatNumber(client.closingBalance)} جنيه ${isCredit ? '<span style="color:var(--accent-success); font-weight:600; font-size:0.8rem;"> (دائن - له رصيد)</span>' : ''}</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">متوسط المدينين</span>
          <span class="detail-value">${formatNumber(client.avgReceivables)} جنيه</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">معدل الدوران (عن الفترة)</span>
          <span class="detail-value" style="${isCash ? 'color: var(--accent-success); font-weight: var(--weight-bold);' : ''}">${turnoverText}</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">متوسط أيام التحصيل (DSO)</span>
          <span class="detail-value" style="${isCash ? 'color: var(--accent-success);' : ''}">${dsoText}</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">معدل التحصيل</span>
          <span class="detail-value">${formatPercent(client.collectionRate)}</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">التصنيف</span>
          <span class="detail-value">
            <span class="badge badge-${client.classification}">${client.classLabel}</span>
          </span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">تقييم الجدوى</span>
          <span class="detail-value" style="color: ${client.isFeasible ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-weight: var(--weight-bold);">
            ${client.isFeasible ? 'مُجدي ✅' : 'غير مُجدي ⚠️'}
          </span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">فترة التحليل</span>
          <span class="detail-value">${formatNumber(client.periodDays)} يوم</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">السعر المقترح للوحدة</span>
          <span class="detail-value" style="color: ${classColor}; font-weight: var(--weight-bold);">${formatNumber(priceVal)} جنيه</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">نسبة الزيادة المقترحة</span>
          <span class="detail-value" style="color: ${classColor}; font-weight: 600;">
            ${isCash ? '0.0% (سعر الكاش)' : `+${formatPercent(client.totalMarkupPct)}`}
          </span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">أيام التحصيل المتزامنة</span>
          <span class="detail-value" style="color: var(--accent-success); font-weight: 600;">
            ${formatNumber(client.actualCollectionDays, 1)} يوم ${client.actualCollectionDays <= 1.5 ? '⚡ (سداد فوري)' : ''}
          </span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">أقصى سحب لحظي (Peak)</span>
          <span class="detail-value" style="font-weight: 600;">${formatNumber(client.peakExposure || 0)} جنيه</span>
        </div>
      </div>

      <h4 style="margin-top: var(--space-4); margin-bottom: var(--space-3); font-size: var(--text-base);">التوصيات</h4>
      <div class="client-recommendations">
        ${recommendations.map(r => `<div class="recommendation-item">${r}</div>`).join('')}
      </div>

      <!-- خريطة كشف الحساب المتزامن للعميل -->
      ${(client.statementLedger && client.statementLedger.length > 0) ? `
        <div style="margin-top: var(--space-5); border-top: 2px solid var(--border-default); padding-top: var(--space-4);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-3); flex-wrap: wrap; gap: 8px;">
            <h4 style="margin:0; font-size: var(--text-base); display:flex; align-items:center; gap:8px;">
              <span>📋 خريطة كشف الحساب المتزامن (التسلسل الزمني للفواتير والسدادات)</span>
              <span class="badge badge-good" style="font-size:0.75rem;">${client.statementLedger.length} حركة</span>
            </h4>
            <div style="font-size: var(--text-xs); color: var(--text-secondary);">
              أعلى سقف مديونية: <strong style="color:var(--text-primary); font-size: var(--text-sm);">${formatNumber(client.peakExposure || 0)} جنيه</strong>
            </div>
          </div>

          <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-default); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
            <table class="data-table" style="font-size: var(--text-xs); width: 100%; border-collapse: collapse; min-width: 650px;">
              <thead style="position: sticky; top: 0; background: var(--bg-surface-elevated); z-index: 2; box-shadow: 0 1px 0 var(--border-default);">
                <tr>
                  <th style="padding: 10px 8px; text-align: center;">#</th>
                  <th style="padding: 10px 8px;">التاريخ والوقت</th>
                  <th style="padding: 10px 8px; text-align: center;">نوع الحركة</th>
                  <th style="padding: 10px 8px;">البيان / السند</th>
                  <th style="padding: 10px 8px; text-align: left;">مدين (فاتورة)</th>
                  <th style="padding: 10px 8px; text-align: left;">دائن (سداد)</th>
                  <th style="padding: 10px 8px; text-align: left;">الرصيد اللحظي</th>
                  <th style="padding: 10px 8px;">سرعة التسوية المتزامنة</th>
                </tr>
              </thead>
              <tbody>
                ${client.statementLedger.map((row, idx) => {
                  const dateStr = row.date ? (row.date instanceof Date ? row.date.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short', numberingSystem: 'latn' }) : String(row.date)) : '—';
                  const balColor = row.balance > 0 ? 'var(--accent-danger)' : (row.balance < 0 ? 'var(--accent-success)' : 'var(--text-secondary)');
                  let typeBadgeClass = 'badge-average';
                  if (row.type === 'invoice') typeBadgeClass = 'badge-poor';
                  if (row.type === 'payment') typeBadgeClass = 'badge-good';
                  if (row.type === 'opening') typeBadgeClass = 'badge-average';
                  if (row.type === 'return') typeBadgeClass = 'badge-warning';

                  return `
                    <tr style="border-bottom: 1px solid var(--border-subtle); background-color: ${idx % 2 === 0 ? 'transparent' : 'var(--bg-surface-elevated)'};">
                      <td style="padding: 8px; text-align: center; color: var(--text-tertiary); font-weight: 500;">${idx + 1}</td>
                      <td style="padding: 8px; white-space: nowrap; font-family: monospace;">${dateStr}</td>
                      <td style="padding: 8px; text-align: center;"><span class="badge ${typeBadgeClass}" style="font-size:0.7rem; padding: 2px 6px;">${row.typeLabel || row.type}</span></td>
                      <td style="padding: 8px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(row.details || row.docNo || '')}">
                        ${escapeHTML(row.docNo ? `${row.docNo}: ${row.details}` : (row.details || '—'))}
                      </td>
                      <td style="padding: 8px; text-align: left; font-weight: 600; color: ${row.debit > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)'};">
                        ${row.debit > 0 ? formatNumber(row.debit) : '—'}
                      </td>
                      <td style="padding: 8px; text-align: left; font-weight: 600; color: ${row.credit > 0 ? 'var(--accent-success)' : 'var(--text-tertiary)'};">
                        ${row.credit > 0 ? formatNumber(row.credit) : '—'}
                      </td>
                      <td style="padding: 8px; text-align: left; font-weight: 700; color: ${balColor};">
                        ${formatNumber(row.balance)}
                      </td>
                      <td style="padding: 8px; white-space: nowrap;">
                        ${row.speedText && row.speedText !== '—' ? `<span style="font-size:0.75rem; color: ${row.speedText.includes('فوري') || row.speedText.includes('نفس') || row.speedText.includes('التالي') ? 'var(--accent-success)' : 'var(--accent-warning)'}; font-weight: 600;">⚡ ${escapeHTML(row.speedText)}</span>` : '<span style="color:var(--text-tertiary);">—</span>'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;

    modal.classList.add('active');
  },

  /* ═══════════════════════════════════════════
     Column Mapping — ربط الأعمدة (يدوي وذكي)
     ═══════════════════════════════════════════ */
  renderFileSpecificMapping(sheets) {
    const container = document.getElementById('mapping-content');
    if (!container) return;

    const fields = [
      { key: 'clientName', label: 'اسم العميل', type: 'text' },
      { key: 'date', label: 'التاريخ', type: 'date' },
      { key: 'invoiceAmount', label: 'قيمة الفاتورة / المبيعات', type: 'numeric' },
      { key: 'paymentAmount', label: 'قيمة السداد / التحصيل', type: 'numeric' },
      { key: 'openingBalance', label: 'رصيد أول المدة', type: 'numeric' },
      { key: 'closingBalance', label: 'رصيد آخر المدة', type: 'numeric' }
    ];

    const profiles = sheets.map(sheet => {
      const suggestedMapping = sheet.profile?.suggestedMapping || {};
      return {
        suggestedMapping,
        columnProfiles: sheet.profile?.columnProfiles || []
      };
    });

    let html = `
      <div class="card" style="margin-bottom:16px; border-right:4px solid var(--accent-primary);">
        <strong style="font-size:var(--text-base);">الربط اليدوي المتقدم</strong>
        <p style="margin:6px 0 0; color:var(--text-secondary); font-size:var(--text-sm);">
          تم تجاهل أي عمود فارغ، وأي عمود لا يحتوي على بيانات تتطابق مع الحقل المطلوب لتسهيل ودقة الربط.
        </p>
      </div>
    `;

    sheets.forEach((sheet, sheetIndex) => {
      const profile = profiles[sheetIndex];
      const mapping = profile.suggestedMapping;
      const colProfiles = profile.columnProfiles;

      const selector = field => {
        const detected = mapping[field.key] || '';
        
        // فلترة الأعمدة: تجاهل الفارغة وتجاهل التي لا تطابق نوع البيانات
        const validHeaders = sheet.headers.filter((header, i) => {
          const colProf = colProfiles[i];
          if (!colProf || colProf.nonEmpty === 0) return false; // تجاهل العمود الفارغ
          
          if (field.type === 'date') return colProf.dateRatio > 0;
          if (field.type === 'numeric') return colProf.numericRatio > 0;
          if (field.type === 'text') return colProf.textRatio > 0;
          return true;
        });

        // إضافة المكتشف تلقائياً حتى لو تم استبعاده لتفادي فقدانه
        if (detected && !validHeaders.includes(detected)) {
          validHeaders.push(detected);
        }

        const options = validHeaders.map(header =>
          `<option value="${escapeHTML(header)}" ${header === detected ? 'selected' : ''}>${escapeHTML(header)}</option>`
        ).join('');
        
        return `<div class="mapping-item"><span class="mapping-label">${field.label}</span><select class="form-input form-select mapping-select" data-sheet-index="${sheetIndex}" data-field="${field.key}" id="mapping-${sheetIndex}-${field.key}"><option value="">-- غير موجود --</option>${options}</select></div>`;
      };

      html += `
        <div class="file-mapping-card" style="margin-bottom:12px; padding:14px; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <h4 style="margin:0 0 8px; font-size:var(--text-sm); color:var(--accent-primary);">${escapeHTML(sheet.fileName)} — ${escapeHTML(sheet.sheetName)}</h4>
          <div class="mapping-grid">${fields.map(selector).join('')}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  /* ═══════════════════════════════════════════
     Show/Hide Results
     ═══════════════════════════════════════════ */
  showResults() {
    document.querySelectorAll('.results-section').forEach(el => {
      el.classList.remove('section-hidden');
    });
  },

  hideResults() {
    document.querySelectorAll('.results-section').forEach(el => {
      el.classList.add('section-hidden');
    });
  }
};

/**
 * Escape HTML لمنع XSS
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * عرض Toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <svg class="icon" style="width:18px;height:18px;flex-shrink:0;"><use href="#${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info'}"></use></svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
