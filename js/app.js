/* ============================================
   App — Entry Point + State Management
   يربط الأقسام الثلاثة: الدوران + الجدوى + التسعير
   ============================================ */

const App = {
  // حالة التطبيق
  state: {
    files: [],
    sheetsData: null,
    parsedData: null,
    results: null,
    classifiedClients: null,
    salesByClass: null,
    summary: null,
    pricingReport: null,
    pricingSummary: null,
    columnMapping: null,
    sortConfig: { key: 'dso', dir: 'desc' },
    filterClass: 'all',
    searchTerm: ''
  },

  /**
   * تهيئة التطبيق
   */
  init() {
    ThemeManager.init();
    this.bindEvents();
    this.updateHurdleRate();
    Renderer.hideResults();
  },

  /**
   * تحديث الحد الأدنى المقبول للعائد تلقائياً
   */
  updateHurdleRate() {
    const depositRate = parseFloat(document.getElementById('deposit-rate')?.value) || 0;
    const riskPremium = 5; // علاوة مخاطر ثابتة/ديناميكية
    const hurdleEl = document.getElementById('hurdle-rate');
    if (hurdleEl) {
      hurdleEl.value = (depositRate + riskPremium).toFixed(2);
    }
  },

  /**
   * ربط الأحداث
   */
  bindEvents() {
    // رفع الملفات
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');

    if (uploadZone && fileInput) {
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
      });

      uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
      });

      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          this.handleFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFiles(e.target.files);
        }
      });
    }

    // تحديث Hurdle Rate تلقائياً (بناءً على الإيداع وعلاوة افتراضية 5%)
    const depositEl = document.getElementById('deposit-rate');
    if (depositEl) {
      depositEl.addEventListener('input', () => this.updateHurdleRate());
    }

    // إظهار/إخفاء حقول التواريخ المخصصة
    const periodSelect = document.getElementById('period-type');
    const customDatesContainer = document.getElementById('custom-dates-container');
    if (periodSelect && customDatesContainer) {
      periodSelect.addEventListener('change', (e) => {
        customDatesContainer.style.display = e.target.value === 'custom' ? 'flex' : 'none';
      });
    }



    // زر التحليل
    const analyzeBtn = document.getElementById('btn-analyze');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => this.runAnalysis());
    }

    // أزرار التصدير
    const exportExcelBtn = document.getElementById('btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => this.exportExcel());
    }

    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => Exporter.exportPDF());
    }

    // إغلاق الـ Modal
    const modalClose = document.getElementById('modal-close');
    const modalBackdrop = document.getElementById('client-modal');
    if (modalClose) {
      modalClose.addEventListener('click', () => this.closeModal());
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.closeModal();
      });
    }

    // البحث في الجدول
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchTerm = e.target.value.trim();
        this.refreshTable();
      });
    }

    // فلترة التصنيف
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.filterClass = btn.dataset.filter;
        this.refreshTable();
      });
    });

    // الفرز
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (this.state.sortConfig.key === key) {
          this.state.sortConfig.dir = this.state.sortConfig.dir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortConfig = { key, dir: 'desc' };
        }
        this.updateSortIndicators();
        this.refreshTable();
      });
    });

    // مراقبة تغيير الثيم لتحديث الرسوم البيانية
    const observer = new MutationObserver(() => {
      ChartsManager.updateTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // اختصارات لوحة المفاتيح
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });
  },

  /**
   * قراءة الإعدادات الكلية (Macro Settings) من واجهة المستخدم
   */
  readSettings() {
    const depositRate = parseFloat(document.getElementById('deposit-rate')?.value) || 19;
    
    // استخراج فترة التحليل
    const periodType = document.getElementById('period-type')?.value || 'auto';
    let defaultPeriodDays = 365;
    let isCustomPeriod = false;

    if (periodType === 'custom') {
      isCustomPeriod = true;
      const startDateVal = document.getElementById('custom-start-date')?.value;
      const endDateVal = document.getElementById('custom-end-date')?.value;
      if (startDateVal && endDateVal) {
        const startD = new Date(startDateVal);
        const endD = new Date(endDateVal);
        if (!isNaN(startD) && !isNaN(endD)) {
          const diffTime = Math.abs(endD - startD);
          defaultPeriodDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);
        } else {
          defaultPeriodDays = 30;
        }
      } else {
        defaultPeriodDays = 30;
      }
    } else if (periodType === 'auto') {
      isCustomPeriod = false;
      defaultPeriodDays = 365;
    } else {
      isCustomPeriod = true;
      defaultPeriodDays = parseInt(periodType, 10) || 365;
    }

    // قيم السعر النقدي والفائدة والمخاطر
    const cashPricePerTon = parseFloat(document.getElementById('cash-price')?.value) || 20000;
    const lendingRate = 20;
    const riskPremiumPct = 5;
    const profitMargin = 10;

    // حدود التصنيف
    const thresholds = {
      good: {
        maxDSO: parseFloat(document.getElementById('threshold-good-dso')?.value) || 30,
        minTurnover: parseFloat(document.getElementById('threshold-good-turnover')?.value) || 12
      },
      average: {
        maxDSO: parseFloat(document.getElementById('threshold-avg-dso')?.value) || 60,
        minTurnover: parseFloat(document.getElementById('threshold-avg-turnover')?.value) || 6
      }
    };

    // علاوات المخاطر لكل فئة
    const riskPremiums = {
      good: parseFloat(document.getElementById('risk-premium-good')?.value) || 0.5,
      average: parseFloat(document.getElementById('risk-premium-average')?.value) || 2.0,
      poor: parseFloat(document.getElementById('risk-premium-poor')?.value) || 4.5
    };

    return {
      depositRate,
      lendingRate,
      riskPremiumPct,
      profitMargin,
      cashPricePerTon,
      thresholds,
      riskPremiums,
      periodType,
      isCustomPeriod,
      defaultPeriodDays,
      interestRate: lendingRate
    };
  },

  /**
   * معالجة الملفات المرفوعة
   */
  async handleFiles(files) {
    const validFiles = Array.from(files).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')
    );

    if (validFiles.length === 0) {
      showToast('يرجى رفع ملفات Excel (.xlsx, .xls) أو CSV', 'error');
      return;
    }

    this.state.files = [...this.state.files, ...validFiles];
    this.renderFileChips();

    try {
      showToast(`جاري قراءة ${validFiles.length} ملف...`, 'info');

      const result = await parseExcelFiles(this.state.files);
      this.state.sheetsData = result;

      if (result.sheets.length === 0 || result.totalRows === 0) {
        showToast('لم يتم العثور على بيانات في الملفات', 'error');
        return;
      }

      document.getElementById('mapping-section').classList.remove('section-hidden');
      Renderer.renderFileSpecificMapping(result.sheets);

      showToast(`تم قراءة ${formatNumber(result.totalRows)} صف من ${result.sheets.length} شيت`, 'success');
    } catch (error) {
      console.error('File parsing error:', error);
      showToast('حدث خطأ أثناء قراءة الملف', 'error');
    }
  },

  /**
   * عرض chips الملفات
   */
  renderFileChips() {
    const container = document.getElementById('file-chips');
    if (!container) return;

    container.innerHTML = this.state.files.map((f, i) => `
      <span class="file-chip">
        <svg class="icon" style="width:14px;height:14px;"><use href="#file-spreadsheet"></use></svg>
        ${escapeHTML(f.name)}
        <svg class="remove-file" onclick="App.removeFile(${i})" style="width:14px;height:14px;">
          <use href="#x"></use>
        </svg>
      </span>
    `).join('');
  },

  /**
   * إزالة ملف
   */
  removeFile(index) {
    this.state.files.splice(index, 1);
    this.renderFileChips();

    if (this.state.files.length === 0) {
      this.state.sheetsData = null;
      document.getElementById('mapping-section').classList.add('section-hidden');
      Renderer.hideResults();
    } else {
      this.handleFiles([]);
    }
  },

  /**
   * تشغيل التحليل الشامل — الأقسام الثلاثة
   */
  runAnalysis() {
    // قراءة جميع الإعدادات
    const settings = this.readSettings();

    // قراءة كل الربط اليدوي لجميع الشيتات
    const sheetMappings = {};
    document.querySelectorAll('.mapping-select').forEach(select => {
      const sheetIndex = select.dataset.sheetIndex;
      const field = select.dataset.field;
      if (!sheetMappings[sheetIndex]) sheetMappings[sheetIndex] = {};
      if (select.value) {
        sheetMappings[sheetIndex][field] = select.value;
      }
    });

    // التحقق المبدئي: يجب أن يكون هناك على الأقل شيت واحد فيه اسم العميل ومبلغ (فاتورة أو رصيد)
    let hasValidMapping = false;
    for (const mapping of Object.values(sheetMappings)) {
      if (mapping.clientName && (mapping.invoiceAmount || mapping.closingBalance || mapping.openingBalance)) {
        hasValidMapping = true;
        break;
      }
    }

    if (!hasValidMapping) {
      showToast('يرجى ربط "اسم العميل" مع قيمة مالية (فاتورة أو رصيد) في شيت واحد على الأقل للبدء.', 'error');
      return;
    }

    this.state.columnMapping = sheetMappings;

    if (!this.state.sheetsData) {
      showToast('يرجى رفع ملف إكسل أولاً', 'error');
      return;
    }

    try {
      // ═══ تطبيق الربط ═══
      const parsedData = applyMapping(this.state.sheetsData.sheets, sheetMappings);
      this.state.parsedData = parsedData;

      if (parsedData.clientCount === 0) {
        showToast('لم يتم العثور على بيانات عملاء', 'error');
        return;
      }

      // ═══ القسم الأول + الثاني: حساب المؤشرات المالية ═══
      const results = calculateAll(parsedData, settings);
      this.state.results = results;

      // ═══ التصنيف مع علاوات المخاطر ═══
      const classifiedClients = classifyClients(results, settings.thresholds, settings.riskPremiums);
      this.state.classifiedClients = classifiedClients;

      // حفظ للرسوم البيانية
      window._lastClassifiedClients = classifiedClients;

      // تحليل المبيعات حسب التصنيف
      const salesByClass = calculateSalesByClassification(classifiedClients);
      this.state.salesByClass = salesByClass;
      window._lastSalesByClass = salesByClass;

      // الملخص الشامل
      const summary = calculateSummary(results, settings);
      this.state.summary = summary;
      window._lastSummary = summary;

      // ═══ القسم الثالث: محرك التسعير ═══
      const pricingReport = PricingEngine.generatePricingReport(classifiedClients, {
        cashPricePerTon: settings.cashPricePerTon,
        depositRate: settings.depositRate, // تمرير نسبة الإيداع
        lendingRate: settings.lendingRate
      });
      this.state.pricingReport = pricingReport;

      // ربط بيانات التسعير الفردية الخاصة بكل عميل في بياناته مباشرة
      classifiedClients.forEach((client, idx) => {
        const p = pricingReport[idx];
        if (p) {
          client.suggestedPrice = p.suggestedPrice;
          client.totalMarkupPct = p.totalMarkupPct;
          client.priceDifference = p.priceDifference;
          client.cashPrice = p.cashPrice;
        }
      });

      const pricingSummary = PricingEngine.generatePricingSummary(pricingReport);
      this.state.pricingSummary = pricingSummary;

      // ═══ عرض جميع النتائج ═══
      Renderer.showResults();
      Renderer.renderKPIs(summary, salesByClass);
      Renderer.renderFeasibilityDashboard(summary, salesByClass);
      Renderer.renderAgingReport(summary);
      Renderer.renderPricingTable(pricingReport, pricingSummary, settings.cashPricePerTon);
      Renderer.renderSalesAnalysis(salesByClass);
      this.refreshTable();
      ChartsManager.renderAll(classifiedClients, salesByClass, summary);

      // تمرير إلى النتائج
      document.getElementById('results-area').scrollIntoView({ behavior: 'smooth' });

      showToast(`تم تحليل ${formatNumber(parsedData.clientCount)} عميل بنجاح — الأقسام الثلاثة`, 'success');
    } catch (error) {
      console.error('Analysis error:', error);
      showToast('حدث خطأ أثناء التحليل: ' + error.message, 'error');
    }
  },

  /**
   * تحديث الجدول (فلترة + بحث + فرز)
   */
  refreshTable() {
    if (!this.state.classifiedClients) return;

    let filtered = [...this.state.classifiedClients];

    // فلترة التصنيف والجدوى
    if (this.state.filterClass !== 'all') {
      if (this.state.filterClass === 'feasible') {
        filtered = filtered.filter(c => c.isFeasible);
      } else if (this.state.filterClass === 'not-feasible') {
        filtered = filtered.filter(c => !c.isFeasible);
      } else {
        filtered = filtered.filter(c => c.classification === this.state.filterClass);
      }
    }

    // البحث
    if (this.state.searchTerm) {
      const term = this.state.searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.clientName.toLowerCase().includes(term)
      );
    }

    Renderer.renderClientsTable(filtered, this.state.sortConfig);

    // تحديث عدد النتائج
    const countEl = document.getElementById('results-count');
    if (countEl) {
      countEl.textContent = `${formatNumber(filtered.length)} من ${formatNumber(this.state.classifiedClients.length)} عميل`;
    }
  },

  /**
   * تحديث مؤشرات الفرز
   */
  updateSortIndicators() {
    document.querySelectorAll('[data-sort]').forEach(th => {
      th.classList.remove('sorted');
      const indicator = th.querySelector('.sort-indicator');
      if (indicator) {
        indicator.innerHTML = '<svg style="width:12px;height:12px"><use href="#arrow-down"></use></svg>';
      }
    });

    const activeTh = document.querySelector(`[data-sort="${this.state.sortConfig.key}"]`);
    if (activeTh) {
      activeTh.classList.add('sorted');
      const indicator = activeTh.querySelector('.sort-indicator');
      if (indicator) {
        const icon = this.state.sortConfig.dir === 'asc' ? 'arrow-up' : 'arrow-down';
        indicator.innerHTML = `<svg style="width:12px;height:12px"><use href="#${icon}"></use></svg>`;
      }
    }
  },

  /**
   * عرض تفاصيل عميل
   */
  showClientDetail(clientName) {
    const client = this.state.classifiedClients.find(c => c.clientName === clientName);
    if (client) {
      Renderer.renderClientDetail(client);
    }
  },

  /**
   * إغلاق الـ Modal
   */
  closeModal() {
    const modal = document.getElementById('client-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  /**
   * تصدير Excel الشامل
   */
  exportExcel() {
    if (!this.state.classifiedClients) {
      showToast('لا توجد بيانات للتصدير', 'error');
      return;
    }
    Exporter.exportExcel(
      this.state.classifiedClients,
      this.state.salesByClass,
      this.state.summary,
      this.state.pricingReport,
      this.state.pricingSummary,
      this.readSettings()
    );
  }
};

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', () => App.init());
