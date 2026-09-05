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
    const minFeasibleScore = 50; // الحد الأدنى لنقاط الجودة والجدوى

    // تجهيز البيانات لكل فئة بالاعتماد على نقاط الجودة الشاملة (من 100)
    const goodData = clients.filter(c => c.classification === 'good').map(c => ({ 
      x: c.dso, 
      y: c.qualityScore, 
      label: c.clientName,
      feasible: c.isFeasible 
    }));
    const avgData = clients.filter(c => c.classification === 'average').map(c => ({ 
      x: c.dso, 
      y: c.qualityScore, 
      label: c.clientName,
      feasible: c.isFeasible 
    }));
    const poorData = clients.filter(c => c.classification === 'poor').map(c => ({ 
      x: c.dso, 
      y: c.qualityScore, 
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
              label: (ctx) => `أيام التحصيل: ${ctx.raw.x.toFixed(0)} يوم | نقاط الجودة: ${ctx.raw.y.toFixed(1)}/100 | ${ctx.raw.feasible ? 'مُجدي ✅' : 'غير مُجدي ⚠️'}`
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
              text: 'نقاط الجودة والجدوى المالية (من 100)',
              font: { family: "'IBM Plex Sans Arabic'", size: 12 },
              color: colors.text
            },
            grid: { color: colors.grid },
            ticks: {
              font: { family: "'IBM Plex Sans Arabic'", size: 11 },
              color: colors.text,
              callback: (v) => v + ' نقطة'
            }
          }
        }
      },
      plugins: [{
        // رسم خط حد الجدوى الأدنى (50 نقطة)
        id: 'hurdleLine',
        afterDraw: (chart) => {
          const yScale = chart.scales.y;
          const yPixel = yScale.getPixelForValue(minFeasibleScore);
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
          ctx.fillText(`حد الجدوى الأدنى (50 نقطة)`, chart.chartArea.left + 5, yPixel - 8);
          ctx.restore();
        }
      }]
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
