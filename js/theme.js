/* ============================================
   Theme — Dark / Light Mode
   ============================================ */

const ThemeManager = {
  STORAGE_KEY: 'feasibility-analyzer-theme',

  /**
   * تهيئة الثيم
   */
  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');

    this.apply(theme);
    this.bindToggle();

    // الاستماع لتغيير تفضيل النظام
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.apply(e.matches ? 'dark' : 'light');
      }
    });
  },

  /**
   * تطبيق الثيم
   */
  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.updateIcon(theme);
    this.currentTheme = theme;
  },

  /**
   * تبديل الثيم
   */
  toggle() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.apply(newTheme);
    localStorage.setItem(this.STORAGE_KEY, newTheme);
  },

  /**
   * تحديث أيقونة الزر
   */
  updateIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const sunIcon = btn.querySelector('.icon-sun');
    const moonIcon = btn.querySelector('.icon-moon');

    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
      } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
      }
    }
  },

  /**
   * ربط زر التبديل
   */
  bindToggle() {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  }
};
