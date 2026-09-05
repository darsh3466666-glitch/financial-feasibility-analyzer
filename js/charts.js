/* ============================================
   Charts — الرسوم البيانية الشاملة
   يشمل: التصنيف, DSO, الجدوى, أعمار الديون
   ============================================ */

const ChartsManager = {
  instances: {},

  /**
   * تهيئة جميع الرسوم البيانية
   */
  renderAll(classifiedClients, salesByClass, summary) {
    if (window.Chart) {
      Chart.defaults.font.family = "'Alexandria', 'IBM Plex Sans Arabic', sans-serif";
    }
    this.destroyAll();
    this.renderDSOBar(classifiedClients);
    this.renderFeasibilityScatter(classifiedClients, summary);
    this.renderAgingBar(salesByClass, classifiedClients);
    this.renderFeasibilityBar(classifiedClients);
  },

  /**
   * ألوان الرسوم البيانية
   */
  getChartColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      good: style.getPropertyValue('--chart-good').trim(),
      average: style.getPropertyValue('--chart-average').trim(),
      poor: style.getPropertyValue('--chart-poor').trim(),
      primary: style.getPropertyValue('--accent-primary').trim(),
      text: style.getPropertyValue('--chart-text').trim(),
      grid: style.getPropertyValue('--chart-grid').trim()
    };
  },

  /**
   * رسم بياني دائري - توزيع العملاء حسب التصنيف
   */
  renderClassificationPie(salesByClass) {
    const ctx = document.getElementById('chart-classification');
    if (!ctx) return;

    const colors = this.getChartColors();

    this.instances.classification = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['A ممتاز', 'B عادي', 'C بطيء'],
        datasets: [{
          data: [
            salesByClass.good.count,
            salesByClass.average.count,
            salesByClass.poor.count
          ],
          backgroundColor: [colors.good, colors.average, colors.poor],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            rtl: true,
            labels: {
              font: { family: "'IBM Plex Sans Arabic'", size: 13 },
              color: colors.text,
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            rtl: true,
            titleFont: { family: "'IBM Plex Sans Arabic'" },
            bodyFont: { family: "'IBM Plex Sans Arabic'" },
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                return `${context.label}: ${context.parsed} عميل (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * رسم بياني عمودي - أيام التحصيل لكل عميل
   */
  renderDSOBar(clients) {
    const ctx = document.getElementById('chart-dso');
    if (!ctx) return;

    const colors = this.getChartColors();

    const top = [...clients]
      .sort((a, b) => b.dso - a.dso)
      .slice(0, 15);

    this.instances.dso = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(c => c.clientName.substring(0, 20)),
        datasets: [{
          label: 'أيام التحصيل',
          data: top.map(c => c.dso),
          backgroundColor: top.map(c => {
            if (c.dso > 60) return colors.poor;     // تأخير مرتفع - خطر مالي
            if (c.dso > 30) return colors.average;  // فترة مقبولة / متوسطة
            return colors.good;                     // تحصيل سريع وآمن
          }),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            titleFont: { family: "'IBM Plex Sans Arabic'" },
            bodyFont: { family: "'IBM Plex Sans Arabic'" },
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.x;
                const status = val > 60 ? 'تأخير عالي ⚠️' : (val > 30 ? 'فترة متوسطة ⏱️' : 'تحصيل سريع ✅');
                return `أيام التحصيل: ${val.toFixed(0)} يوم (${status})`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.grid },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text
            }
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text
            }
          }
        }
      }
    });
  },

  /**
   * رسم بياني نقطي - مؤشر الجدوى مقابل DSO
   * القسم الثاني: يوضح العلاقة بين سرعة السداد والجدوى الاقتصادية
   */
  renderFeasibilityScatter(clients, summary) {
    const ctx = document.getElementById('chart-feasibility-scatter');
    if (!ctx) return;

    const colors = this.getChartColors();
    const minCollectionRate = 50; // الحد الأدنى لنسبة التحصيل والالتزام (50%)

    // تجهيز البيانات لكل فئة بالاعتماد على نسبة التحصيل الفعلية وأيام التحصيل DSO
    const goodData = clients.filter(c => c.classification === 'good').map(c => ({ 
      x: c.dso, 
      y: c.collectionRate, 
      label: c.clientName,
      feasible: c.isFeasible 
    }));
    const avgData = clients.filter(c => c.classification === 'average').map(c => ({ 
      x: c.dso, 
      y: c.collectionRate, 
      label: c.clientName,
      feasible: c.isFeasible 
    }));
    const poorData = clients.filter(c => c.classification === 'poor').map(c => ({ 
      x: c.dso, 
      y: c.collectionRate, 
      label: c.clientName,
      feasible: c.isFeasible 
    }));

    this.instances.feasibilityScatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'A ممتاز',
            data: goodData,
            backgroundColor: colors.good + 'CC',
            borderColor: colors.good,
            pointRadius: 7,
            pointHoverRadius: 10
          },
          {
            label: 'B عادي',
            data: avgData,
            backgroundColor: colors.average + 'CC',
            borderColor: colors.average,
            pointRadius: 7,
            pointHoverRadius: 10
          },
          {
            label: 'C بطيء',
            data: poorData,
            backgroundColor: colors.poor + 'CC',
            borderColor: colors.poor,
            pointRadius: 7,
            pointHoverRadius: 10
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            rtl: true,
            labels: {
              font: { family: "'IBM Plex Sans Arabic'", size: 12 },
              color: colors.text,
              usePointStyle: true,
              pointStyleWidth: 10,
              padding: 16
            }
          },
          tooltip: {
            rtl: true,
            titleFont: { family: "'IBM Plex Sans Arabic'" },
            bodyFont: { family: "'IBM Plex Sans Arabic'" },
            callbacks: {
              title: (ctx) => ctx[0].raw.label || '',
              label: (ctx) => `أيام التحصيل: ${ctx.raw.x.toFixed(0)} يوم | نسبة التحصيل: ${ctx.raw.y.toFixed(1)}% | ${ctx.raw.feasible ? 'مُجدي ائتمانياً ✅' : 'غير مُجدي ⚠️'}`
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'أيام التحصيل (DSO)',
              font: { family: "'IBM Plex Sans Arabic'", size: 12 },
              color: colors.text
            },
            grid: { color: colors.grid },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text
            }
          },
          y: {
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'نسبة التحصيل والالتزام بالسداد (%)',
              font: { family: "'IBM Plex Sans Arabic'", size: 12 },
              color: colors.text
            },
            grid: { color: colors.grid },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text,
              callback: (v) => v + '%'
            }
          }
        }
      },
      plugins: [{
        // رسم خط حد التحصيل الأدنى (50%)
        id: 'hurdleLine',
        afterDraw: (chart) => {
          const yScale = chart.scales.y;
          const yPixel = yScale.getPixelForValue(minCollectionRate);
          if (yPixel === undefined || isNaN(yPixel)) return;

          const ctx = chart.ctx;
          ctx.save();
          ctx.strokeStyle = colors.poor;
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(chart.chartArea.left, yPixel);
          ctx.lineTo(chart.chartArea.right, yPixel);
          ctx.stroke();

          ctx.fillStyle = colors.poor;
          ctx.font = "12px 'IBM Plex Sans Arabic'";
          ctx.textAlign = 'left';
          ctx.fillText(`حد التحصيل الأدنى المقبول (50%)`, chart.chartArea.left + 5, yPixel - 8);
          ctx.restore();
        }
      }]
    });
  },

  /**
   * رسم بياني شريطي مكدس - أعمار الديون حسب التصنيف
   */
  renderAgingBar(salesByClass, classifiedClients) {
    const ctx = document.getElementById('chart-aging');
    if (!ctx) return;

    const colors = this.getChartColors();
    const groups = { good: [], average: [], poor: [] };
    classifiedClients.forEach(c => {
      if (groups[c.classification]) groups[c.classification].push(c);
    });

    const labels = ['A ممتاز', 'B عادي', 'C بطيء'];
    const agingLabels = [
      '0-30 يوم (آمن)',
      '31-60 يوم (مقبول)',
      '61-90 يوم (تحذير)',
      '> 90 يوم (خطر متعثر)'
    ];
    // ألوان حرارية دلالية متدرجة تعبر بدقة عن مستوى خطورة عمر الدين
    const agingColors = [
      '#10B981', // أخضر زمردي - دين حالي آمن
      '#F59E0B', // كهرماني - مستحق قريباً
      '#EA580C', // برتقالي داكن - مرحلة تأخير وتحذير
      '#EF4444'  // قرمزي - ديون قديمة متعثرة / خطر ائتماني
    ];

    const getSum = (arr, key) => arr.reduce((s, c) => s + (c.agingBuckets?.[key] || 0), 0);

    const datasets = [
      { label: agingLabels[0], data: [getSum(groups.good, 'current'), getSum(groups.average, 'current'), getSum(groups.poor, 'current')], backgroundColor: agingColors[0] },
      { label: agingLabels[1], data: [getSum(groups.good, 'days60'), getSum(groups.average, 'days60'), getSum(groups.poor, 'days60')], backgroundColor: agingColors[1] },
      { label: agingLabels[2], data: [getSum(groups.good, 'days90'), getSum(groups.average, 'days90'), getSum(groups.poor, 'days90')], backgroundColor: agingColors[2] },
      { label: agingLabels[3], data: [getSum(groups.good, 'over90'), getSum(groups.average, 'over90'), getSum(groups.poor, 'over90')], backgroundColor: agingColors[3] }
    ];

    this.instances.aging = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: datasets.map(d => ({ ...d, borderRadius: 3, maxBarThickness: 50 })) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            rtl: true,
            labels: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text,
              usePointStyle: true,
              pointStyleWidth: 10,
              padding: 12
            }
          },
          tooltip: {
            rtl: true,
            titleFont: { family: "'IBM Plex Sans Arabic'" },
            bodyFont: { family: "'IBM Plex Sans Arabic'" },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${new Intl.NumberFormat('en-US').format(Math.round(ctx.parsed.y))} جنيه`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 12 },
              color: colors.text
            }
          },
          y: {
            stacked: true,
            grid: { color: colors.grid },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text,
              callback: (v) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(v)
            }
          }
        }
      }
    });
  },

  /**
   * رسم بياني - مقارنة أيام التحصيل الفعلية مع الحد الأقصى للائتمان (60 يوماً)
   */
  renderFeasibilityBar(clients) {
    const ctx = document.getElementById('chart-feasibility');
    if (!ctx) return;

    const colors = this.getChartColors();

    const top = [...clients]
      .sort((a, b) => b.dso - a.dso)
      .slice(0, 15);

    this.instances.feasibility = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(c => c.clientName.substring(0, 20)),
        datasets: [
          {
            label: 'أيام التحصيل الفعلية (DSO)',
            data: top.map(c => c.dso),
            backgroundColor: top.map(c => c.dso <= 60 ? colors.good : colors.poor),
            borderRadius: 4,
            maxBarThickness: 24
          },
          {
            label: 'الحد الأقصى للائتمان المقبول (60 يوماً)',
            data: top.map(() => 60),
            type: 'line',
            borderColor: colors.poor,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            rtl: true,
            labels: {
              font: { family: "'IBM Plex Sans Arabic'", size: 12 },
              color: colors.text,
              usePointStyle: true,
              pointStyleWidth: 10,
              padding: 16
            }
          },
          tooltip: {
            rtl: true,
            titleFont: { family: "'IBM Plex Sans Arabic'" },
            bodyFont: { family: "'IBM Plex Sans Arabic'" },
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.type === 'line') return ctx.dataset.label;
                const dso = ctx.parsed.y;
                const isPass = dso <= 60;
                return `أيام التحصيل: ${dso.toFixed(0)} يوم — ${isPass ? 'ملتزم بالحد الائتماني المقبول ✅' : 'تجاوز فترة الائتمان (تأخير) ❌'}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 10 },
              color: colors.text,
              maxRotation: 45
            }
          },
          y: {
            min: 0,
            grid: { color: colors.grid },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text,
              callback: (v) => v + ' يوم'
            }
          }
        }
      }
    });
  },

  /**
   * رسم بياني - نسبة المبيعات حسب التصنيف
   */
  renderSalesDistribution(salesByClass) {
    const ctx = document.getElementById('chart-sales-dist');
    if (!ctx) return;

    const colors = this.getChartColors();

    this.instances.salesDist = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['A ممتاز', 'B عادي', 'C بطيء'],
        datasets: [{
          data: [
            salesByClass.good.totalSales,
            salesByClass.average.totalSales,
            salesByClass.poor.totalSales
          ],
          backgroundColor: [colors.good, colors.average, colors.poor],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            rtl: true,
            labels: {
              font: { family: "'IBM Plex Sans Arabic'", size: 13 },
              color: colors.text,
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            rtl: true,
            titleFont: { family: "'IBM Plex Sans Arabic'" },
            bodyFont: { family: "'IBM Plex Sans Arabic'" },
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                return `${context.label}: ${new Intl.NumberFormat('en-US').format(Math.round(context.parsed))} جنيه (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * تحديث الألوان عند تغيير الثيم
   */
  updateTheme() {
    this.destroyAll();
    if (window._lastClassifiedClients && window._lastSalesByClass) {
      this.renderAll(window._lastClassifiedClients, window._lastSalesByClass, window._lastSummary);
    }
  },

  /**
   * حذف جميع الرسوم
   */
  destroyAll() {
    Object.values(this.instances).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.instances = {};
  }
};
