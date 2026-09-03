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

    const feasiblePct = summary.totalClients > 0 ? (summary.feasibleCount / summary.totalClients) * 100 : 0;
    const notFeasiblePct = summary.totalClients > 0 ? (summary.notFeasibleCount / summary.totalClients) * 100 : 0;
    
    let dsoEval = '';
    if (summary.avgDSO <= 30) dsoEval = 'جيد جداً (دورة سريعة)';
    else if (summary.avgDSO <= 60) dsoEval = 'متوسط (مقبول)';
    else dsoEval = 'ضعيف (تأخير عالي)';

    container.innerHTML = `
      <div class="kpi-card kpi-card--primary animate-in">
        <div class="kpi-icon">
          <svg class="icon"><use href="#users"></use></svg>
        </div>
        <span class="kpi-label">إجمالي العملاء</span>
        <span class="kpi-value">${formatNumber(summary.totalClients)}</span>
        <span class="kpi-sub">${formatNumber(summary.feasibleCount)} مُجدي (${formatPercent(feasiblePct)}) — ${formatNumber(summary.notFeasibleCount)} غير مُجدي (${formatPercent(notFeasiblePct)})</span>
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
        <span class="kpi-label">متوسط رصيد المديونية</span>
        <span class="kpi-value">${formatNumber(summary.totalReceivables)}</span>
        <span class="kpi-sub">إجمالي متوسط المديونيات خلال الفترة (جنيه)</span>
      </div>

      <div class="kpi-card kpi-card--success animate-in">
        <div class="kpi-icon">
          <svg class="icon"><use href="#refresh"></use></svg>
        </div>
        <span class="kpi-label">متوسط معدل الدوران</span>
        <span class="kpi-value">${formatNumber(summary.avgTurnover, 1)}</span>
        <span class="kpi-sub">مرة سنوياً</span>
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
    if (!container) return;

    const aging = summary.totalAging;
    const total = aging.total || 1; // تجنب القسمة على صفر

    const buckets = [
      { label: '0 - 30 يوم', amount: aging.current, pct: (aging.current / total * 100), color: 'var(--accent-success)' },
      { label: '31 - 60 يوم', amount: aging.days60, pct: (aging.days60 / total * 100), color: 'var(--accent-warning)' },
      { label: '61 - 90 يوم', amount: aging.days90, pct: (aging.days90 / total * 100), color: 'var(--accent-danger)' },
      { label: '> 90 يوم', amount: aging.over90, pct: (aging.over90 / total * 100), color: '#7C3AED' }
    ];

    let html = `
      <div class="card">
        <div class="aging-summary">
          <div class="aging-total">
            <span class="aging-total-label">إجمالي المبالغ المستحقة</span>
            <span class="aging-total-value">${formatNumber(aging.total)} جنيه</span>
          </div>
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
              <th>المبيعات (المسددة)</th>
              <th>النسبة</th>
              <th>إجمالي المديونية المتبقية</th>
              <th>النسبة</th>
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
          <td class="num-cell" style="color: var(--accent-success);">${formatNumber(data.totalCashSales)}</td>
          <td class="num-cell" style="color: var(--accent-success);">${formatPercent(data.cashSalesPercentage)}</td>
          <td class="num-cell" style="color: var(--accent-warning);">${formatNumber(data.totalCreditSales)}</td>
          <td class="num-cell" style="color: var(--accent-warning);">${formatPercent(data.creditSalesPercentage)}</td>
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

        if (typeof valA === 'string') {
          return sortConfig.dir === 'asc'
            ? valA.localeCompare(valB, 'ar')
            : valB.localeCompare(valA, 'ar');
        }

        return sortConfig.dir === 'asc' ? valA - valB : valB - valA;
      });
    }

    container.innerHTML = sorted.map((client, index) => `
      <tr class="animate-in" style="animation-delay: ${Math.min(index * 30, 300)}ms">
        <td class="client-name" data-client="${escapeHTML(client.clientName)}" onclick="App.showClientDetail('${escapeHTML(client.clientName)}')" title="اضغط لعرض التفاصيل">
          ${escapeHTML(client.clientName)}
        </td>
        <td class="num-cell">${formatNumber(client.totalSales)}</td>
        <td class="num-cell">${formatNumber(client.avgReceivables)}</td>
        <td class="num-cell">${formatNumber(client.annualizedTurnover, 1)}</td>
        <td class="num-cell">${formatNumber(client.dso, 0)} يوم</td>
        <td class="num-cell" style="color: ${client.qualityScore >= 50 ? 'var(--accent-success)' : 'var(--accent-danger)'}">${formatNumber(client.qualityScore, 1)}</td>
        <td class="num-cell" style="color: var(--accent-danger)">${formatPercent(client.hiddenLossPct)}</td>
        <td>
          <span class="badge badge-${client.classification}">${client.classLabel}</span>
        </td>
        <td>
          <span class="badge ${client.isFeasible ? 'badge-feasible' : 'badge-not-feasible'}">
            ${client.isFeasible ? 'مُجدي' : 'غير مُجدي'}
          </span>
        </td>
      </tr>
    `).join('');
  },

  /* ═══════════════════════════════════════════
     Client Detail Modal — بطاقة تفصيلية مُوسّعة
     ═══════════════════════════════════════════ */
  renderClientDetail(client) {
    const modal = document.getElementById('client-modal');
    if (!modal) return;

    const recommendations = generateRecommendation(client);
    const aging = client.agingBuckets || {};

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
          <span class="detail-value">${formatNumber(client.closingBalance)} جنيه</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">متوسط المدينين</span>
          <span class="detail-value">${formatNumber(client.avgReceivables)} جنيه</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">معدل الدوران السنوي</span>
          <span class="detail-value">${formatNumber(client.annualizedTurnover, 1)} مرة</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">متوسط أيام التحصيل (DSO)</span>
          <span class="detail-value">${formatNumber(client.dso, 0)} يوم</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">معدل التحصيل</span>
          <span class="detail-value">${formatPercent(client.collectionRate)}</span>
        </div>

        <!-- القسم الثاني: الجدوى وجودة العميل -->
        <div class="client-detail-item">
          <span class="detail-label">نقاط الجودة الشاملة</span>
          <span class="detail-value" style="color: ${client.qualityScore >= 50 ? 'var(--accent-success)' : 'var(--accent-danger)'}">${formatNumber(client.qualityScore, 1)} / 100</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">الخسارة الخفية (من المبيعات)</span>
          <span class="detail-value" style="color: var(--accent-danger)">${formatPercent(client.hiddenLossPct)}</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">تكلفة الأموال المعطلة (قيمة)</span>
          <span class="detail-value" style="color: var(--accent-warning)">${formatNumber(client.opportunityCost)} جنيه</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">تقييم الجدوى</span>
          <span class="detail-value" style="color: ${client.isFeasible ? 'var(--accent-success)' : 'var(--accent-danger)'}">
            ${client.isFeasible ? 'مُجدي' : 'غير مُجدي'}
          </span>
        </div>

        <!-- القسم الثالث: التسعير -->
        <div class="client-detail-item">
          <span class="detail-label">علاوة المخاطر</span>
          <span class="detail-value">${formatPercent(client.riskPremium)}</span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">التصنيف</span>
          <span class="detail-value">
            <span class="badge badge-${client.classification}">${client.classLabel}</span>
          </span>
        </div>
        <div class="client-detail-item">
          <span class="detail-label">فترة التحليل</span>
          <span class="detail-value">${formatNumber(client.periodDays)} يوم</span>
        </div>
      </div>

      <h4 style="margin-bottom: var(--space-3); font-size: var(--text-base);">التوصيات</h4>
      <div class="client-recommendations">
        ${recommendations.map(r => `<div class="recommendation-item">${r}</div>`).join('')}
      </div>
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
