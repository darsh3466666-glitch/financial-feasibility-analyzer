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
            if (c.classification === 'good') return colors.good;
            if (c.classification === 'average') return colors.average;
            return colors.poor;
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
              label: (ctx) => `${ctx.parsed.x.toFixed(0)} يوم`
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
    const hurdleRate = summary ? summary.hurdleRate : 0;

    // تجهيز البيانات لكل فئة
    const goodData = clients.filter(c => c.classification === 'good').map(c => ({ x: c.dso, y: c.returnOnAR, label: c.clientName }));
    const avgData = clients.filter(c => c.classification === 'average').map(c => ({ x: c.dso, y: c.returnOnAR, label: c.clientName }));
    const poorData = clients.filter(c => c.classification === 'poor').map(c => ({ x: c.dso, y: c.returnOnAR, label: c.clientName }));

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
              label: (ctx) => `DSO: ${ctx.raw.x.toFixed(0)} يوم | عائد AR: ${ctx.raw.y.toFixed(1)}%`
            }
          },
          annotation: undefined
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
            title: {
              display: true,
              text: 'العائد على المديونية %',
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
        // رسم خط الحد الأدنى (Hurdle Rate)
        id: 'hurdleLine',
        afterDraw: (chart) => {
          if (hurdleRate <= 0) return;
          const yScale = chart.scales.y;
          const yPixel = yScale.getPixelForValue(hurdleRate);
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
          ctx.fillText(`الحد الأدنى ${hurdleRate}%`, chart.chartArea.left + 5, yPixel - 8);
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
    const agingLabels = ['0-30 يوم', '31-60 يوم', '61-90 يوم', '> 90 يوم'];
    const agingColors = [colors.good, colors.average, '#F97316', colors.poor];

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
   * رسم بياني - مقارنة العائد على المديونية مع الحد الأدنى
   */
  renderFeasibilityBar(clients) {
    const ctx = document.getElementById('chart-feasibility');
    if (!ctx) return;

    const colors = this.getChartColors();

    const top = [...clients]
      .sort((a, b) => b.requiredMarkup - a.requiredMarkup)
      .slice(0, 15);

    this.instances.feasibility = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(c => c.clientName.substring(0, 20)),
        datasets: [
          {
            label: 'العائد على المديونية %',
            data: top.map(c => c.returnOnAR),
            backgroundColor: colors.good,
            borderRadius: 4,
            maxBarThickness: 20
          },
          {
            label: 'الحد الأدنى المطلوب %',
            data: top.map(c => c.hurdleRate),
            backgroundColor: colors.poor,
            borderRadius: 4,
            maxBarThickness: 20
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
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
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
            grid: { color: colors.grid },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text,
              callback: (v) => v + '%'
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
