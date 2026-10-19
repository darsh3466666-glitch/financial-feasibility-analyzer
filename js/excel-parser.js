/* ============================================
   Excel Parser — قراءة وتحليل ملفات الإكسل
   ============================================ */

/**
 * أنماط أسماء الأعمدة المتوقعة للاكتشاف التلقائي
 */
/**
 * أنماط أسماء الأعمدة المتوقعة للاكتشاف التلقائي مع دعم أوسع لجميع برامج الـ ERP
 */
const COLUMN_PATTERNS = {
  clientName: {
    label: 'اسم العميل',
    patterns: [
      'اسم العميل', 'العميل', 'اسم الزبون', 'الزبون', 'اسم الحساب', 'الحساب',
      'اسم الشريك', 'الشريك', 'اسم العميل/المورد', 'اسم الجهه', 'الجهه',
      'customer', 'client', 'client name', 'customer name', 'account name', 'partner', 'party name',
      'اسم العميل / الحساب', 'اسم العميل/الحساب', 'العميل / الحساب', 'طرف التعامل', 'الطرف الثاني',
      'المتعامل', 'اسم الشركة', 'اسم المنشأة', 'الزبائن', 'العملاء', 'حساب العميل',
      'cust_name', 'customer_name', 'client_name', 'party'
    ]
  },
  date: {
    label: 'التاريخ',
    patterns: [
      'ت السداد', 'ت.السداد', 'تاريخ السداد', 'ت السدادات', 'ت التحصيل', 'ت.التحصيل', 'تاريخ التحصيل',
      'ت الاصدار', 'ت.الاصدار', 'تاريخ الاصدار', 'ت الصدور', 'ت.الصدور',
      'ت الاستحقاق', 'ت.الاستحقاق', 'تاريخ الاستحقاق',
      'ت السند', 'ت.السند', 'تاريخ السند', 'ت القبض', 'ت.القبض', 'ت الصرف', 'ت.الصرف',
      'ت القيد', 'ت.القيد', 'تاريخ القيد', 'ت الحركة', 'ت.الحركة', 'تاريخ الحركة',
      'ت الفاتورة', 'ت.الفاتورة', 'تاريخ الفاتورة', 'ت الدفع', 'ت.الدفع',
      'ت المعاملة', 'ت.المعاملة', 'ت التسليم', 'ت.التسليم', 'ت البيع', 'ت.البيع',
      'التاريخ', 'تاريخ', 'تاريخ المعاملة', 'تاريخ العملية', 'التاريخ الميلادي',
      'تاريخ السند', 'تاريخ الايصال', 'تاريخ الدفعة',
      'payment_date', 'receipt_date', 'due_date', 'issue_date', 'invoice_date', 'transaction_date',
      'doc_date', 'voucher_date', 'trx_date', 'date'
    ]
  },
  invoiceAmount: {
    label: 'قيمة الفاتورة / المبيعات',
    patterns: [
      'حركات مدينة', 'مدين', 'المدين', 'المبيعات', 'مبيعات', 'فواتير', 'الفواتير',
      'قيمة الفاتورة', 'مبلغ الفاتورة', 'قيمة المبيعات', 'اجمالي الفاتورة',
      'debit', 'sales', 'invoice amount', 'invoices', 'invoice'
    ]
  },
  paymentAmount: {
    label: 'المحصّل / السداد (دائن)',
    patterns: [
      'حركات دائنة', 'دائن', 'الدائن', 'المحصل', 'محصل', 'تحصيل', 'التحصيل', 'تحصيلات',
      'سداد', 'السداد', 'سدادات', 'مقبوضات', 'المقبوضات', 'المدفوع', 'دفعة',
      'credit', 'payment', 'receipt', 'collected', 'paid'
    ]
  },
  balance: {
    label: 'الرصيد',
    patterns: [
      'الرصيد', 'رصيد', 'الرصيد الحالي', 'رصيد حالي', 'الرصيد المتبقي',
      'balance', 'current_balance', 'remaining', 'outstanding',
      'رصيد العميل', 'الرصيد المدين', 'المتبقي', 'صافي الرصيد', 'صافي'
    ]
  },
  openingBalance: {
    label: 'رصيد أول المدة',
    patterns: [
      'رصيد أول المدة', 'رصيد اول المدة', 'رصيد سابق', 'الرصيد السابق',
      'رصيد افتتاحي', 'الرصيد الافتتاحي', 'رصيد افتتاح', 'رصيد بداية', 'رصيد مرحل',
      'opening balance', 'beginning balance', 'start balance', 'prior balance', 'initial balance', 'beg balance'
    ]
  },
  closingBalance: {
    label: 'رصيد آخر المدة',
    patterns: [
      'رصيد آخر المدة', 'رصيد اخر المدة', 'الرصيد الحالي', 'رصيد حالي',
      'رصيد ختامي', 'الرصيد الختامي', 'صافي الرصيد', 'الرصيد النهائي', 'رصيد نهائي',
      'الرصيد', 'رصيد', 'closing balance', 'ending balance', 'current balance', 'end balance', 'balance'
    ]
  },
  balanceType: {
    label: 'طبيعة الرصيد (الحالة)',
    patterns: [
      'الحالة', 'حالة', 'طبيعة الرصيد', 'نوع الرصيد', 'طبيعة الحساب', 'نوع الحساب',
      'status', 'balance_type', 'type', 'مدين/دائن', 'دائن/مدين', 'طبيعة', 'ح/الرصيد', 'طبيعة الحركة',
      'بيان الرصيد', 'حالة الحساب', 'طبيعة الرصيد ع.م'
    ]
  }
};

/**
 * قوائم الكلمات السلبية المستبعدة تماماً من كل حقل لمنع اختلاط المعاني
 */
const FIELD_NEGATIVE_PATTERNS = {
  clientName: [
    'كود', 'code', 'id', 'تصنيف', 'فئة', 'نوع', 'شريحة', 'درجة',
    'category', 'class', 'type', 'tier', 'group', 'مجموعة',
    'حالة', 'وضع', 'نشط', 'status', 'active', 'state', 'condition',
    'عنوان', 'منطقة', 'محافظة', 'مدينة', 'مركز', 'بلد', 'شارع',
    'address', 'city', 'region', 'area', 'zone', 'country', 'governorate',
    'هاتف', 'تلفون', 'تليفون', 'موبايل', 'جوال', 'فاكس', 'ايميل', 'بريد', 'phone', 'mobile', 'tel', 'fax', 'email',
    'مندوب', 'بائع', 'فرع', 'مخزن', 'salesman', 'rep', 'branch', 'store', 'warehouse',
    'ملاحظات', 'ملاحظة', 'بيان', 'تفاصيل', 'وصف', 'شرح', 'غرض', 'الغرض', 'purpose', 'notes', 'remarks', 'description', 'details',
    'طريقة', 'طريقة الدفع', 'دفع', 'وسيلة', 'شيك', 'بنك', 'خزينة', 'خزينه', 'صندوق', 'الصندوق', 'عهدة', 'عهده', 'سند', 'حوالة', 'فيزا', 'كاش',
    'رقم', 'مسلسل', 'م', 'no', 'serial', 'seq', 'num',
    'تاريخ', 'date', 'month', 'year', 'يوم', 'شهر', 'سنة',
    'رصيد', 'مدين', 'دائن', 'مبلغ', 'قيمة', 'فاتورة', 'سداد', 'تحصيل',
    'balance', 'debit', 'credit', 'amount', 'total', 'tax', 'ضريبة', 'ضريبه'
  ],

  date: [
    'اسم', 'عميل', 'حساب', 'زبون', 'customer', 'client', 'name',
    'رصيد', 'مدين', 'دائن', 'مبلغ', 'قيمة', 'balance', 'amount', 'total',
    'كود', 'code', 'id', 'هاتف', 'phone', 'عنوان', 'address', 'تصنيف', 'حالة',
    'خزينة', 'خزينه', 'بنك', 'صندوق', 'عهدة', 'ملاحظات', 'بيان', 'غرض'
  ],

  invoiceAmount: [
    'كود', 'code', 'id', 'رقم العميل', 'كود العميل', 'رقم الحساب', 'مسلسل', 'م',
    'هاتف', 'تلفون', 'phone', 'mobile',
    'تاريخ', 'date',
    'اسم', 'عميل', 'حساب', 'زبون', 'name',
    'دائن', 'داين', 'credit', 'المحصل', 'تحصيل', 'سداد', 'مقبوضات', 'receipt', 'payment', 'paid',
    'خزينة', 'خزينه', 'بنك', 'صندوق', 'عهدة', 'ملاحظات', 'بيان', 'غرض'
  ],

  paymentAmount: [
    'كود', 'code', 'id', 'رقم العميل', 'كود العميل', 'رقم الحساب', 'مسلسل', 'م',
    'هاتف', 'تلفون', 'phone', 'mobile',
    'تاريخ', 'date',
    'اسم', 'عميل', 'حساب', 'زبون', 'name',
    'مدين', 'debit', 'فاتورة', 'مبيعات', 'sales', 'invoice',
    'خزينة', 'خزينه', 'بنك', 'صندوق', 'عهدة', 'ملاحظات', 'بيان', 'غرض'
  ],

  openingBalance: [
    'كود', 'code', 'id', 'رقم العميل', 'كود العميل', 'رقم الحساب', 'مسلسل', 'م',
    'هاتف', 'تلفون', 'phone', 'mobile',
    'تاريخ', 'date',
    'اسم', 'عميل', 'حساب', 'زبون', 'name',
    'اخر', 'ختام', 'ختامي', 'حالي', 'نهائي', 'اقفال',
    'closing', 'ending', 'current', 'final', 'end',
    'خزينة', 'خزينه', 'بنك', 'صندوق', 'عهدة', 'ملاحظات', 'بيان', 'غرض'
  ],

  closingBalance: [
    'كود', 'code', 'id', 'رقم العميل', 'كود العميل', 'رقم الحساب', 'مسلسل', 'م',
    'هاتف', 'تلفون', 'phone', 'mobile',
    'تاريخ', 'date',
    'اسم', 'عميل', 'حساب', 'زبون', 'name',
    'اول', 'افتتاح', 'افتتاحي', 'سابق', 'بداية', 'مرحل',
    'opening', 'beginning', 'start', 'prior', 'previous', 'before',
    'خزينة', 'خزينه', 'بنك', 'صندوق', 'عهدة', 'ملاحظات', 'بيان', 'غرض'
  ],

  balance: [
    'كود', 'code', 'id', 'رقم العميل', 'كود العميل', 'رقم الحساب', 'مسلسل', 'م',
    'هاتف', 'تلفون', 'phone', 'mobile',
    'تاريخ', 'date',
    'اسم', 'عميل', 'حساب', 'زبون', 'name',
    'خزينة', 'خزينه', 'بنك', 'صندوق', 'عهدة', 'ملاحظات', 'بيان', 'غرض'
  ]
};

/**
 * تنظيف الكلمة العربية وإزالة أل التعريف للمقارنة الدقيقة
 */
function cleanArabicWord(w) {
  let s = normalizeText(w);
  if (s.startsWith('ال') && s.length > 3) s = s.slice(2);
  return s;
}

/**
 * تحليل كلمات العنوان
 */
function getHeaderWords(header) {
  const norm = normalizeText(header);
  const rawWords = norm.split(' ').filter(Boolean);
  const cleanWords = rawWords.map(cleanArabicWord);
  return { norm, rawWords, cleanWords };
}

/**
 * فحص استبعاد كلمة سلبية بحدود الكلمة لمنع الخلط
 */
function containsNegativeWord(header, negatives) {
  if (!negatives || !negatives.length) return false;
  const headerInfo = getHeaderWords(header);
  
  for (const neg of negatives) {
    const negNorm = normalizeText(neg);
    const cNeg = cleanArabicWord(neg);

    if (!negNorm.includes(' ')) {
      if (headerInfo.cleanWords.includes(cNeg) || headerInfo.rawWords.includes(negNorm)) {
        return true;
      }
    } else {
      if (headerInfo.norm.includes(negNorm)) {
        return true;
      }
    }
  }
  return false;
}

async function parseExcelFiles(files) {
  const allSheets = [];
  
  // الكلمات المفتاحية للبحث عن صف العناوين في مختلف برامج الـ ERP
  const keywords = [
    'اسم', 'عميل', 'زبون', 'حساب', 'جهة', 'customer', 'client', 'account',
    'تاريخ', 'ت سداد', 'ت اصدار', 'ت استحقاق', 'ت قيد', 'ت حركة', 'ت سند', 'ت فاتورة', 'ت قبض', 'ت صرف', 'date',
    'رصيد', 'افتتاح', 'سابق', 'ختام', 'حالي', 'نهائي', 'balance',
    'مبلغ', 'قيمة', 'amount', 'total',
    'فاتورة', 'فواتير', 'مبيعات', 'invoice', 'sales',
    'مدين', 'دائن', 'debit', 'credit',
    'سداد', 'تحصيل', 'مقبوضات', 'صرف', 'payment', 'receipt',
    'رقم', 'كود', 'code', 'id', 'مسلسل',
    'بيان', 'غرض', 'ملاحظات', 'وصف', 'description', 'notes'
  ];

  for (const file of files) {
    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      
      // قراءة الشيت كمصفوفة ثنائية الأبعاد (صفوف وأعمدة)
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
      if (!aoa || aoa.length === 0) continue;

      // البحث عن صف العناوين (في أول 15 صف)
      let headerRowIndex = 0;
      let maxKeywords = 0;

      for (let i = 0; i < Math.min(aoa.length, 15); i++) {
        const row = aoa[i];
        if (!row || !Array.isArray(row)) continue;
        
        let currentKeywords = 0;
        for (const cell of row) {
          if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
            const cellStr = String(cell).trim();
            const { cleanWords, rawWords, norm } = getHeaderWords(cellStr);
            for (const kw of keywords) {
              const kwNorm = normalizeText(kw);
              const kwClean = cleanArabicWord(kw);
              if (cleanWords.includes(kwClean) || rawWords.includes(kwNorm) || norm.includes(kwNorm)) {
                currentKeywords++;
                break;
              }
            }
          }
        }
        
        if (currentKeywords > maxKeywords) {
          maxKeywords = currentKeywords;
          headerRowIndex = i;
        }
      }

      let jsonData = [];
      let finalHeaders = [];

      if (maxKeywords > 0) {
        // تم العثور على صف العناوين
        finalHeaders = aoa[headerRowIndex].map((h, idx) => 
          h && String(h).trim() !== '' ? String(h).trim() : `__EMPTY_${idx}`
        );
        
        // بناء البيانات من الصفوف التي تلي صف العناوين
        for (let i = headerRowIndex + 1; i < aoa.length; i++) {
          const rowArray = aoa[i];
          // تجاهل الصفوف الفارغة بالكامل
          if (rowArray.every(c => c === null || c === undefined || c === '')) continue;
          
          const rowObj = {};
          finalHeaders.forEach((h, idx) => {
            rowObj[h] = rowArray[idx] !== undefined ? rowArray[idx] : null;
          });
          jsonData.push(rowObj);
        }
      } else {
        // الرجوع للطريقة الافتراضية إذا لم يتم العثور على كلمات مفتاحية
        jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: null });
        if (jsonData.length > 0) {
          finalHeaders = Object.keys(jsonData[0]);
        }
      }

      if (jsonData.length > 0) {
        allSheets.push({
          fileName: file.name,
          sheetName,
          headers: finalHeaders,
          data: jsonData,
          rowCount: jsonData.length,
          profile: analyzeSheetStructure(finalHeaders, jsonData, sheetName, file.name)
        });
      }
    }
  }

  return {
    sheets: allSheets,
    totalRows: allSheets.reduce((sum, s) => sum + s.rowCount, 0)
  };
}

/**
 * قراءة ملف كـ ArrayBuffer
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * اكتشاف تلقائي لربط الأعمدة
 * @param {Array<string>} headers - أسماء الأعمدة
 * @returns {Object} الربط المكتشف
 */
/**
 * حساب التشابه والملائمة لرأس العمود مع استبعاد الكلمات السلبية
 */
function getHeaderScore(header, patterns, negativePatterns = []) {
  if (containsNegativeWord(header, negativePatterns)) {
    return 0; // استبعاد تام
  }
  const normalizedHeader = normalizeText(header);
  return patterns.reduce((best, pattern) => Math.max(best, calculateSimilarity(normalizedHeader, normalizeText(pattern))), 0);
}

function isLikelyDateValue(value) {
  if (value instanceof Date) return !isNaN(value.getTime());
  const text = String(value).trim();
  return /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}(?:[ T].*)?$/.test(text)
    || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(text);
}

/**
 * فحص المحتوى الإحصائي والتصنيفي الدقيق للعمود
 */
function profileColumn(header, rows) {
  let nonEmpty = 0;
  let numeric = 0;
  let dates = 0;
  let text = 0;
  let phoneCount = 0;
  let totalLength = 0;
  let treasuryWordCount = 0;
  const uniqueValues = new Set();

  const STATUS_KEYWORDS = new Set([
    'نشط', 'غير نشط', 'موقف', 'معلق', 'ملغي', 'فعال', 'نعم', 'لا',
    'active', 'inactive', 'suspended', 'cancelled', 'yes', 'no', 'true', 'false',
    'مدين', 'داين', 'دائن', 'debit', 'credit', 'cr', 'dr', 'له', 'عليه',
    'أ', 'ب', 'ج', 'د', 'ا', 'a', 'b', 'c', 'd', 'vip', 'عادي', 'ممتاز', 'ضعيف', 'مقبول',
    'قطاعي', 'جملة', 'جمله', 'شركات', 'افراد', 'موزع', 'وكيل'
  ]);

  const TREASURY_REGEX = /خزينة|خزينه|بنك|صندوق|عهدة|عهده|خزنة|خزنه/i;

  let statusWordCount = 0;

  rows.forEach(row => {
    const raw = row[header];
    if (raw === null || raw === undefined) return;
    const str = String(raw).trim();
    if (str === '' || str === 'null' || str === 'undefined') return;

    nonEmpty++;
    uniqueValues.add(str.toLowerCase());

    if (isLikelyDateValue(raw)) {
      dates++;
      return;
    }

    const cleanDigits = str.replace(/[\s\-\+]/g, '');
    if (/^(01[0125]\d{8}|201[0125]\d{8}|05\d{8}|9665\d{8})$/.test(cleanDigits)) {
      phoneCount++;
      numeric++;
      return;
    }

    const num = parseNumber(raw);
    if (num !== null) {
      numeric++;
      return;
    }

    text++;
    totalLength += str.length;
    const norm = normalizeText(str);
    const words = norm.split(' ').map(cleanArabicWord);
    if (words.some(w => STATUS_KEYWORDS.has(w)) || STATUS_KEYWORDS.has(norm)) {
      statusWordCount++;
    }
    if (TREASURY_REGEX.test(str)) {
      treasuryWordCount++;
    }
  });

  const uniqueCount = uniqueValues.size;
  // التصنيف أو الحالة: إما تكرار كلمات الحالة المحاسبية أو رموز تصنيفية بالغة القصر (1-3 أحرف)
  const isStatusOrCategory = (statusWordCount / Math.max(text, 1) >= 0.4) || 
    (text >= 10 && uniqueCount <= 3 && (totalLength / Math.max(text, 1)) <= 4);
  const isLikelyPhone = phoneCount / Math.max(nonEmpty, 1) >= 0.3;
  const isTreasuryOrBank = treasuryWordCount / Math.max(text, 1) >= 0.4;

  return {
    header,
    nonEmpty,
    numericRatio: nonEmpty ? numeric / nonEmpty : 0,
    dateRatio: nonEmpty ? dates / nonEmpty : 0,
    textRatio: nonEmpty ? text / nonEmpty : 0,
    repeatedTextRatio: text ? 1 - (uniqueCount / text) : 0,
    isStatusOrCategory,
    isLikelyPhone,
    isTreasuryOrBank,
    uniqueCount
  };
}

/**
 * التحقق المحاسبي الصارم مما إذا كان العمود مؤهلاً وصالحاً منطقياً ليكون خياراً للحقل المطلوب
 */
function isColumnEligibleForField(header, fieldKey, profile, sheetContext = {}, hasMultipleFinancialCols = false) {
  if (!profile || profile.nonEmpty === 0) return false;

  const headerInfo = getHeaderWords(header);

  // 1. فحص الكلمات السلبية الصارمة لكل حقل
  const negatives = FIELD_NEGATIVE_PATTERNS[fieldKey] || [];
  if (containsNegativeWord(header, negatives)) {
    return false;
  }

  // 2. اسم العميل
  if (fieldKey === 'clientName') {
    // استبعاد تام وبلا استثناء إذا كان العمود خزينة أو بنك أو عهدة (الجانب المدين في سندات القبض / وسيلة السداد)
    if (profile.isTreasuryOrBank) return false;

    // استبعاد الأعمدة الرقمية، الهواتف، والتواريخ
    if (profile.numericRatio > 0.35 || profile.isLikelyPhone || profile.dateRatio > 0.3) return false;

    const isExplicitClientName = getHeaderScore(header, COLUMN_PATTERNS.clientName.patterns, FIELD_NEGATIVE_PATTERNS.clientName) >= 0.5;

    // إذا كان العنوان صريحاً لاسم العميل (مثل "اسم العميل"، "العميل"، "اسم الحساب")
    if (isExplicitClientName) {
      return true; // مؤهل دائماً حتى لو كانت الحركات مكررة لحساب عام مثل "عميل نقدي" أو "إيرادات أخرى"
    }

    // إذا لم يكن العنوان صريحاً
    if (profile.textRatio < 0.4) return false;
    if (profile.isStatusOrCategory) return false;
    return true;
  }

  // 3. التاريخ
  if (fieldKey === 'date') {
    if (sheetContext.isOpeningSheet || sheetContext.isClosingSheet || sheetContext.isCombinedBalanceSheet) return false;
    if (profile.numericRatio > 0.8 && profile.dateRatio === 0) return false;
    const isExplicitDate = getHeaderScore(header, COLUMN_PATTERNS.date.patterns, FIELD_NEGATIVE_PATTERNS.date) >= 0.5;
    return profile.dateRatio > 0.2 || isExplicitDate;
  }

  // 4. الحقول المالية (مبالغ وأرصدة)
  if (['invoiceAmount', 'paymentAmount', 'openingBalance', 'closingBalance'].includes(fieldKey)) {
    if (profile.numericRatio < 0.6) return false;
    if (profile.isLikelyPhone) return false;

    // استبعاد أكواد وأرقام الحسابات والهواتف
    if (headerInfo.cleanWords.some(w => ['كود', 'code', 'id', 'هاتف', 'phone', 'مسلسل', 'رقم'].includes(w))) {
      return false;
    }

    const isDebitWord = headerInfo.cleanWords.some(w => ['مدين', 'مدينة', 'مدينه', 'مبيعات', 'فواتير', 'فاتورة', 'debit', 'sales'].map(cleanArabicWord).includes(w));
    const isCreditWord = headerInfo.cleanWords.some(w => ['دائن', 'داين', 'دائنة', 'داينه', 'تحصيل', 'سداد', 'مقبوضات', 'محصل', 'المحصل', 'credit', 'payment', 'receipt'].map(cleanArabicWord).includes(w));
    const isExplicitOpening = headerInfo.cleanWords.some(w => ['اول', 'سابق', 'افتتاح', 'افتتاحي', 'مرحل', 'بداية', 'opening', 'prior'].map(cleanArabicWord).includes(w));
    const isExplicitClosing = headerInfo.cleanWords.some(w => ['اخر', 'ختام', 'ختامي', 'حالي', 'نهائي', 'اقفال', 'closing', 'ending', 'current'].map(cleanArabicWord).includes(w));
    const isGenericBalance = headerInfo.cleanWords.some(w => ['رصيد', 'صافي', 'balance'].map(cleanArabicWord).includes(w));

    if (fieldKey === 'openingBalance') {
      if (isCreditWord || isDebitWord) return false;
      if (sheetContext.isClosingSheet) return false;
      if (sheetContext.isSalesSheet || sheetContext.isPaymentsSheet) return false;
      if (hasMultipleFinancialCols && !isExplicitOpening && !(sheetContext.isOpeningSheet && isGenericBalance)) {
        return false;
      }
      return true;
    }

    if (fieldKey === 'closingBalance') {
      if (isCreditWord || isDebitWord) return false;
      if (sheetContext.isOpeningSheet) return false;
      if (sheetContext.isSalesSheet || sheetContext.isPaymentsSheet) return false;
      if (hasMultipleFinancialCols && !isExplicitClosing && !(sheetContext.isClosingSheet && isGenericBalance)) {
        return false;
      }
      return true;
    }

    if (fieldKey === 'invoiceAmount') {
      if (sheetContext.isOpeningSheet || sheetContext.isClosingSheet || sheetContext.isCombinedBalanceSheet) return false;
      if (isCreditWord) return false;
      if (isExplicitOpening || isExplicitClosing || isGenericBalance) return false;
      if (sheetContext.isPaymentsSheet && !isDebitWord) return false;
      return true;
    }

    if (fieldKey === 'paymentAmount') {
      if (sheetContext.isOpeningSheet || sheetContext.isClosingSheet || sheetContext.isCombinedBalanceSheet) return false;
      if (isDebitWord) return false;
      if (isExplicitOpening || isExplicitClosing || isGenericBalance) return false;
      if (sheetContext.isSalesSheet && !isCreditWord) return false;
      return true;
    }
  }

  return true;
}

/**
 * يحلل محتوى وهيكل الشيت بذكاء بشري مع مراعاة اسم الملف وسياقه
 */
function analyzeSheetStructure(headers, data, sheetName = '', fileName = '') {
  // فحص عينة عميقة تصل إلى 1000 صف أو كامل الشيت لضمان قراءة واقعية وشاملة للمحتوى
  const sample = data.slice(0, Math.min(data.length, 1000));
  const columnProfiles = headers.map(header => profileColumn(header, sample));
  const contextNameNormalized = normalizeText(fileName + ' ' + sheetName);

  // استنباط سياق وغرض الملف من الاسم
  const hasOpeningKeyword = ['سابق', 'قديم', 'اول', 'افتتاح', 'افتتاحي', 'بداية', 'مرحل', 'opening', 'prior', 'previous', 'before', 'start']
    .some(w => contextNameNormalized.includes(cleanArabicWord(w)) || contextNameNormalized.includes(normalizeText(w)));

  const hasClosingKeyword = ['حالي', 'اخر', 'ختام', 'ختامي', 'نهاية', 'نهائي', 'اقفال', 'closing', 'ending', 'current', 'final', 'end']
    .some(w => contextNameNormalized.includes(cleanArabicWord(w)) || contextNameNormalized.includes(normalizeText(w)));

  const isOpeningSheet = hasOpeningKeyword && !hasClosingKeyword;
  const isClosingSheet = hasClosingKeyword && !hasOpeningKeyword;
  const isCombinedBalanceSheet = hasOpeningKeyword && hasClosingKeyword;

  const isSalesSheet = ['فواتير', 'مبيعات', 'بيع', 'اجل', 'invoices', 'sales', 'invoice']
    .some(w => contextNameNormalized.includes(cleanArabicWord(w)) || contextNameNormalized.includes(normalizeText(w)));

  const isPaymentsSheet = ['سداد', 'تحصيل', 'مقبوضات', 'قبض', 'صرف', 'ايصالات', 'payments', 'receipts', 'collection']
    .some(w => contextNameNormalized.includes(cleanArabicWord(w)) || contextNameNormalized.includes(normalizeText(w)));

  const isStatementSheet = ['كشف حساب', 'استاذ', 'ميزان مراجعة', 'statement', 'ledger']
    .some(w => contextNameNormalized.includes(cleanArabicWord(w)) || contextNameNormalized.includes(normalizeText(w)));

  const sheetContext = { isOpeningSheet, isClosingSheet, isCombinedBalanceSheet, isSalesSheet, isPaymentsSheet, isStatementSheet };

  // حساب عدد الأعمدة المالية المتاحة
  const numericCount = columnProfiles.filter(p => p.numericRatio >= 0.6).length;
  const hasMultipleFinancialCols = numericCount >= 3;

  const suggestedMapping = {};

  // 1. اكتشاف عمود اسم العميل
  let bestNameCol = null;
  let bestNameScore = 0;
  headers.forEach((h, i) => {
    if (!isColumnEligibleForField(h, 'clientName', columnProfiles[i], sheetContext, hasMultipleFinancialCols)) return;
    const hScore = getHeaderScore(h, COLUMN_PATTERNS.clientName.patterns, FIELD_NEGATIVE_PATTERNS.clientName);
    const score = (hScore * 0.7) + (columnProfiles[i].textRatio * 0.3);
    if (score > bestNameScore && score >= 0.35) {
      bestNameScore = score;
      bestNameCol = h;
    }
  });
  suggestedMapping.clientName = bestNameCol;

  // 2. اكتشاف عمود التاريخ (فقط للشيتات ذات الحركات كالفواتير والسدادات وكشوف الحسابات، وليس شيتات الأرصدة)
  const AUDIT_DATE_PATTERNS = ['added', 'create', 'created', 'creation', 'print', 'printed', 'system', 'export', 'اضاف', 'انشا', 'طباع'];
  let bestDateCol = null;
  if (!isOpeningSheet && !isClosingSheet && !isCombinedBalanceSheet) {
    let bestDateScore = -999;
    headers.forEach((h, i) => {
      if (!isColumnEligibleForField(h, 'date', columnProfiles[i], sheetContext, hasMultipleFinancialCols)) return;
      const hScore = getHeaderScore(h, COLUMN_PATTERNS.date.patterns, FIELD_NEGATIVE_PATTERNS.date);
      let score = (hScore * 0.55) + (columnProfiles[i].dateRatio * 0.45);
      const norm = normalizeText(h);
      const isAudit = AUDIT_DATE_PATTERNS.some(p => norm.includes(p));
      if (isAudit) score -= 0.6; // استبعاد أو تخفيض تواريخ الإدخال والطباعة لصالح تواريخ السداد والفواتير الفعلية
      if (isPaymentsSheet) {
        if (norm.includes('سداد') || norm.includes('تحصيل') || norm.includes('payment')) score += 0.4;
        else if (norm.includes('اصدار') || norm.includes('issue')) score += 0.2;
      } else if (isSalesSheet) {
        if (norm.includes('فاتورة') || norm.includes('مبيعات') || norm.includes('invoice')) score += 0.4;
      }
      if (score > bestDateScore && score >= 0.4) {
        bestDateScore = score;
        bestDateCol = h;
      }
    });
  }
  suggestedMapping.date = bestDateCol;

  // 3. تصنيف الأعمدة المالية الصريحة
  let explicitOpening = null;
  let explicitClosing = null;
  let explicitDebit = null;
  let explicitCredit = null;
  let genericBalance = null;
  let genericAmount = null;

  headers.forEach((h, i) => {
    const prof = columnProfiles[i];
    if (prof.numericRatio < 0.6) return;
    const hInfo = getHeaderWords(h);

    if (containsNegativeWord(h, ['كود', 'code', 'id', 'هاتف', 'phone', 'مسلسل', 'رقم'])) return;

    if (hInfo.cleanWords.some(w => ['اول', 'افتتاح', 'افتتاحي', 'سابق', 'مرحل', 'بداية', 'opening', 'prior'].map(cleanArabicWord).includes(w))) {
      explicitOpening = h;
    } else if (hInfo.cleanWords.some(w => ['اخر', 'ختام', 'ختامي', 'حالي', 'نهائي', 'اقفال', 'closing', 'ending', 'current'].map(cleanArabicWord).includes(w))) {
      explicitClosing = h;
    } else if (hInfo.cleanWords.some(w => ['مدين', 'مدينة', 'مدينه', 'مبيعات', 'فواتير', 'فاتورة', 'debit', 'sales'].map(cleanArabicWord).includes(w))) {
      explicitDebit = h;
    } else if (hInfo.cleanWords.some(w => ['دائن', 'داين', 'دائنة', 'داينه', 'تحصيل', 'سداد', 'مقبوضات', 'محصل', 'المحصل', 'credit', 'payment', 'receipt'].map(cleanArabicWord).includes(w))) {
      explicitCredit = h;
    } else if (hInfo.cleanWords.some(w => ['الرصيد', 'رصيد', 'balance', 'صافي'].map(cleanArabicWord).includes(w))) {
      genericBalance = h;
    } else if (hInfo.cleanWords.some(w => ['المبلغ', 'القيمة', 'amount', 'total'].map(cleanArabicWord).includes(w))) {
      genericAmount = h;
    }
  });

  // الربط الذكي وفقاً لسياق اسم الملف وطبيعة الأعمدة
  if (isOpeningSheet) {
    suggestedMapping.openingBalance = explicitOpening || genericBalance || null;
    suggestedMapping.closingBalance = null;
    suggestedMapping.invoiceAmount = null;
    suggestedMapping.paymentAmount = null;
    suggestedMapping.date = null;
  } else if (isClosingSheet) {
    suggestedMapping.closingBalance = explicitClosing || genericBalance || null;
    suggestedMapping.openingBalance = null;
    suggestedMapping.invoiceAmount = null;
    suggestedMapping.paymentAmount = null;
    suggestedMapping.date = null;
  } else if (isCombinedBalanceSheet) {
    suggestedMapping.openingBalance = explicitOpening || null;
    suggestedMapping.closingBalance = explicitClosing || genericBalance || null;
    suggestedMapping.invoiceAmount = null;
    suggestedMapping.paymentAmount = null;
    suggestedMapping.date = null;
  } else if (isSalesSheet) {
    suggestedMapping.invoiceAmount = explicitDebit || genericAmount || null;
    suggestedMapping.paymentAmount = null;
    suggestedMapping.openingBalance = null;
    suggestedMapping.closingBalance = null;
  } else if (isPaymentsSheet) {
    suggestedMapping.paymentAmount = explicitCredit || genericAmount || null;
    suggestedMapping.invoiceAmount = null;
    suggestedMapping.openingBalance = null;
    suggestedMapping.closingBalance = null;
  } else {
    // شيت عام (كشف حساب، ميزان مراجعة، تقرير عملاء)
    suggestedMapping.openingBalance = explicitOpening || null;
    suggestedMapping.closingBalance = explicitClosing || genericBalance || null;
    suggestedMapping.invoiceAmount = explicitDebit || null;
    suggestedMapping.paymentAmount = explicitCredit || null;
  }

  // بناء خيارات القوائم المنسدلة النظيفة والمفروزة لكل حقل (Dropdown Options)
  const dropdownOptions = {};
  ['clientName', 'date', 'invoiceAmount', 'paymentAmount', 'openingBalance', 'closingBalance'].forEach(fieldKey => {
    let valid = headers.filter((h, i) => isColumnEligibleForField(h, fieldKey, columnProfiles[i], sheetContext, hasMultipleFinancialCols));
    const detected = suggestedMapping[fieldKey];

    // ترتيب الخيارات بحيث يكون العمود المكتشف أولاً، ثم حسب درجة الملاءمة
    valid.sort((a, b) => {
      if (a === detected) return -1;
      if (b === detected) return 1;
      const patterns = COLUMN_PATTERNS[fieldKey]?.patterns || [];
      const negs = FIELD_NEGATIVE_PATTERNS[fieldKey] || [];
      const scoreA = getHeaderScore(a, patterns, negs);
      const scoreB = getHeaderScore(b, patterns, negs);
      return scoreB - scoreA;
    });

    if (detected && !valid.includes(detected)) {
      valid.unshift(detected);
    }
    dropdownOptions[fieldKey] = valid;
  });

  const roleScores = {
    invoices: isSalesSheet ? 1 : (suggestedMapping.invoiceAmount ? 0.8 : 0),
    payments: isPaymentsSheet ? 1 : (suggestedMapping.paymentAmount ? 0.8 : 0),
    balances: (isOpeningSheet || isClosingSheet || isCombinedBalanceSheet || isStatementSheet) ? 1 : 0.5
  };

  return {
    columnProfiles,
    suggestedMapping,
    dropdownOptions,
    sheetContext,
    roleScores,
    evidence: buildProfileEvidence(suggestedMapping, headers, columnProfiles)
  };
}

function autoDetectColumns(headers, columnProfiles = []) {
  const mapping = {};
  for (const [field, config] of Object.entries(COLUMN_PATTERNS)) {
    let bestMatch = null;
    let bestScore = 0;
    for (let i = 0; i < headers.length; i++) {
      if ((field === 'openingBalance' || field === 'closingBalance') && !hasSpecificBalanceTiming(headers[i], field)) {
        continue;
      }
      const headerScore = getHeaderScore(headers[i], config.patterns, FIELD_NEGATIVE_PATTERNS[field] || []);
      const profile = columnProfiles[i];
      const contentScore = getContentScore(field, profile);
      const score = headerScore > 0 ? (headerScore * 0.8) + (contentScore * 0.2) : contentScore * 0.35;
      const minimumHeaderScore = field === 'clientName' || field === 'date' ? 0.5 : 0.6;
      if (headerScore >= minimumHeaderScore && score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = headers[i];
      }
    }
    mapping[field] = bestMatch;
  }
  return mapping;
}

function hasSpecificBalanceTiming(header, field) {
  const normalized = normalizeText(header);
  const terms = field === 'openingBalance'
    ? ['اول', 'افتتاح', 'opening', 'beginning', 'start', 'سابق', 'prior']
    : ['اخر', 'ختام', 'حالي', 'closing', 'ending', 'current'];
  return terms.some(term => normalized.includes(term));
}

function getContentScore(field, profile) {
  if (!profile || profile.nonEmpty === 0) return 0;
  if (field === 'clientName') return Math.min(1, (profile.textRatio * 0.8) + ((profile.repeatedTextRatio || 0) * 0.2));
  if (field === 'date') return profile.dateRatio;
  if (field === 'balanceType') return profile.textRatio;
  return profile.numericRatio;
}

function getMappedScore(field, mapping, headers, profiles) {
  const header = mapping[field];
  if (!header) return 0;
  const index = headers.indexOf(header);
  const config = COLUMN_PATTERNS[field];
  return (getHeaderScore(header, config.patterns, FIELD_NEGATIVE_PATTERNS[field] || []) * 0.8) + (getContentScore(field, profiles[index]) * 0.2);
}

function buildProfileEvidence(mapping, headers, profiles) {
  return Object.entries(mapping)
    .filter(([, header]) => header)
    .map(([field, header]) => {
      const profile = profiles[headers.indexOf(header)];
      const valueType = field === 'clientName' ? 'نص' : field === 'date' ? 'تاريخ' : 'رقم';
      return `${COLUMN_PATTERNS[field]?.label || field}: ${header} (${profile?.nonEmpty || 0} قيمة ${valueType})`;
    });
}

/**
 * تطبيع ذكي لمفتاح مطابقة اسم العميل (يدمج الفروق الإملائية بدقة فائقة)
 */
function getNormalizedClientKey(name) {
  if (!name) return null;
  return String(name)
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
    .replace(/[ـ]/g, '') // إزالة التطويل
    .replace(/\u200c|\u200d|\u200e|\u200f/g, '') // إزالة الحروف غير المرئية
    .replace(/\s+/g, ' ') // دمج المسافات الزائدة
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

/**
 * استكشاف تلقائي لخانات طبيعة الرصيد (مدين / دائن / الحالة) في الشيت بدون الحاجة لتدخل يدوي
 */
function detectBalanceTypeColumn(sheet, mapping = {}) {
  // 1. إذا تم اختياره صراحة
  if (mapping.balanceType && sheet.headers?.includes(mapping.balanceType)) {
    return mapping.balanceType;
  }

  // استبعاد الأعمدة المحجوزة للمبالغ وأسماء العملاء
  const reserved = new Set([
    mapping.clientName,
    mapping.invoiceAmount,
    mapping.paymentAmount,
    mapping.balance,
    mapping.openingBalance,
    mapping.closingBalance
  ].filter(Boolean));

  // 2. إذا تم اقتراحه من الملف التعريفي للشيت بشرط ألا يكون محجوزاً
  if (sheet.profile?.suggestedMapping?.balanceType && sheet.headers?.includes(sheet.profile.suggestedMapping.balanceType)) {
    const candidate = sheet.profile.suggestedMapping.balanceType;
    if (!reserved.has(candidate)) {
      return candidate;
    }
  }

  // 3. مطابقة العناوين ذات الصلة المباشرة بـ (الحالة / طبيعة الرصيد)
  const statusPatterns = [
    'الحالة', 'الحاله', 'طبيعة الرصيد', 'طبيعه الرصيد', 'نوع الرصيد',
    'طبيعة الحساب', 'طبيعه الحساب', 'نوع الحساب', 'حالة الحساب',
    'status', 'balance_type', 'type', 'طبيعة', 'طبيعه', 'ح/الرصيد'
  ];

  if (Array.isArray(sheet.headers)) {
    for (const h of sheet.headers) {
      if (reserved.has(h)) continue;
      if (getHeaderScore(h, statusPatterns) >= 0.55) {
        return h;
      }
    }
  }

  // 4. الفحص الميداني لمحتويات الأعمدة غير المحجوزة لاكتشاف أي عمود يحوي نص "مدين" أو "دائن"
  if (Array.isArray(sheet.headers) && Array.isArray(sheet.data)) {
    const sample = sheet.data.slice(0, 50);
    for (const h of sheet.headers) {
      if (reserved.has(h)) continue;
      let debitCreditCount = 0;
      for (const row of sample) {
        const raw = String(row[h] || '').trim();
        const val = normalizeText(raw);
        if (
          val.includes('مدين') || 
          val.includes('داين') || 
          val.includes('دائن') || 
          raw.includes('دائن') ||
          raw.includes('مدين') ||
          val === 'debit' || 
          val === 'credit' || 
          val === 'cr' || 
          val === 'dr' || 
          val === 'له' || 
          val === 'عليه'
        ) {
          debitCreditCount++;
        }
      }
      if (debitCreditCount >= 1) {
        return h;
      }
    }
  }
  return null;
}

/**
 * فحص ما إذا كان الصف أو الرصيد دائناً (له رصيد / دفعة مقدمة) أم مديناً (عليه مديونية)
 */
function checkRowCreditStatus(row, balanceTypeCol, balance, closingBalance, openingBalance, debitCol = null, creditCol = null) {
  // 1. فحص القيم الرقمية لعمودي مدين ودائن في الشيت إن وجدا (للتعرف على طبيعة الرصيد دائن أم مدين تلقائياً)
  if (debitCol || creditCol) {
    const dVal = debitCol ? parseNumber(row[debitCol]) : null;
    const cVal = creditCol ? parseNumber(row[creditCol]) : null;
    const d = (dVal !== null && !isNaN(dVal)) ? Math.abs(dVal) : 0;
    const c = (cVal !== null && !isNaN(cVal)) ? Math.abs(cVal) : 0;

    if (c > 0 && c > d) {
      return true; // دائن قطعي (له رصيد / دفعة مقدمة)
    }
    if (d > 0 && d > c) {
      return false; // مدين قطعي (عليه مديونية)
    }
  }

  // 2. فحص عمود الحالة النصي (مدين / دائن / له / عليه)
  if (balanceTypeCol && row[balanceTypeCol] !== null && row[balanceTypeCol] !== undefined) {
    const raw = String(row[balanceTypeCol]).trim();
    const norm = normalizeText(raw);
    
    // التحقق من الدائن بكل الأشكال الإملائية بعد التطبيع وبدونه
    if (
      norm.includes('داين') || 
      norm.includes('دائن') || 
      raw.includes('دائن') ||
      norm.includes('credit') || 
      norm === 'cr' || 
      norm === 'له' || 
      norm.includes('دفعه مقدمه') || 
      norm.includes('مقدم')
    ) {
      return true;
    }
    
    // التحقق من المدين
    if (
      norm.includes('مدين') || 
      raw.includes('مدين') ||
      norm.includes('debit') || 
      norm === 'dr' || 
      norm === 'عليه'
    ) {
      return false;
    }
  }

  // 3. إذا لم يتوفر ما سبق أو كانت الخلية فارغة، نعتمد على الإشارة السالبة إن وجدت
  if (balance !== null && balance < 0) return true;
  if (closingBalance !== null && closingBalance < 0) return true;
  if (openingBalance !== null && openingBalance < 0) return true;
  return false;
}

/**
 * تطبيق الربط وتحويل البيانات مع دمج ذكي لأسماء العملاء واكتشاف تلقائي للدائن والمدين
 * @param {Array<Object>} sheetsData - بيانات الشيتات
 * @param {Object} sheetMappings - ربط الأعمدة
 * @returns {Object} البيانات المحللة
 */
function applyMapping(sheetsData, sheetMappings) {
  // خريطة لتجميع الحركات بناءً على المفتاح المطبع مع الاحتفاظ بالاسم الأصلي
  const clientsMap = new Map();

  sheetsData.forEach((sheet, sheetIndex) => {
    const mapping = sheetMappings[sheetIndex] || {};
    
    // إذا لم يتم ربط اسم العميل لهذا الشيت، نتخطاه
    if (!mapping.clientName) return;

    // استكشاف تلقائي لعمود الحالة (مدين / دائن) بدون إلزام المستخدم بإدخاله في الواجهة
    const balanceTypeCol = detectBalanceTypeColumn(sheet, mapping);

    // استكشاف تلقائي لعمودي مدين ودائن المحاسبيين (الأرقام) لدعم دقة التمييز بين المدين والدائن في كل ERP
    let debitCol = null;
    let creditCol = null;
    const profiles = sheet.profile?.columnProfiles;
    if (Array.isArray(sheet.headers)) {
      sheet.headers.forEach((h, i) => {
        const prof = profiles ? profiles[i] : null;
        if (prof && prof.numericRatio < 0.4) return;
        const hInfo = getHeaderWords(h);
        const isDebit = hInfo.cleanWords.some(w => ['مدين', 'مدينة', 'مدينه', 'debit', 'dr'].map(cleanArabicWord).includes(w));
        const isCredit = hInfo.cleanWords.some(w => ['دائن', 'داين', 'دائنة', 'داينه', 'credit', 'cr'].map(cleanArabicWord).includes(w));
        if (isDebit && !isCredit) debitCol = h;
        if (isCredit && !isDebit) creditCol = h;
      });
    }

    for (const row of sheet.data) {
      const rawName = row[mapping.clientName];
      if (rawName === null || rawName === undefined) continue;
      
      const cleanRaw = String(rawName).trim().replace(/\s+/g, ' ');
      if (!cleanRaw) continue;

      const normKey = getNormalizedClientKey(cleanRaw);
      if (!normKey) continue;

      if (!clientsMap.has(normKey)) {
        clientsMap.set(normKey, {
          displayName: cleanRaw, // الاسم الأصلي كما هو في الشيت تماماً
          records: []
        });
      }

      const clientEntry = clientsMap.get(normKey);

      const date = mapping.date ? parseDate(row[mapping.date]) : null;
      const invoiceAmount = mapping.invoiceAmount ? parseNumber(row[mapping.invoiceAmount]) : 0;
      const paymentAmount = mapping.paymentAmount ? parseNumber(row[mapping.paymentAmount]) : 0;
      let balance = mapping.balance ? parseNumber(row[mapping.balance]) : null;
      let openingBalance = mapping.openingBalance ? parseNumber(row[mapping.openingBalance]) : null;
      let closingBalance = mapping.closingBalance ? parseNumber(row[mapping.closingBalance]) : null;

      // إذا لم يتوفر عمود رصيد صريح ولكن يتوفر عمودا مدين ودائن في شيت أرصدة
      if (openingBalance === null && sheet.profile?.sheetContext?.isOpeningSheet && (debitCol || creditCol)) {
        const d = debitCol ? (parseNumber(row[debitCol]) || 0) : 0;
        const c = creditCol ? (parseNumber(row[creditCol]) || 0) : 0;
        openingBalance = Math.abs(d - c);
      }
      if (closingBalance === null && sheet.profile?.sheetContext?.isClosingSheet && (debitCol || creditCol)) {
        const d = debitCol ? (parseNumber(row[debitCol]) || 0) : 0;
        const c = creditCol ? (parseNumber(row[creditCol]) || 0) : 0;
        closingBalance = Math.abs(d - c);
      }

      // تحديد هل الحركة أو الرصيد دائن (له فلوس / دفعة مقدمة) أم مدين (عليه مديونية) بدقة واقعية
      const isCredit = checkRowCreditStatus(row, balanceTypeCol, balance, closingBalance, openingBalance, debitCol, creditCol);

      const signedBalance = balance !== null ? (isCredit ? -Math.abs(balance) : Math.abs(balance)) : null;
      const signedOpeningBalance = openingBalance !== null ? (isCredit ? -Math.abs(openingBalance) : Math.abs(openingBalance)) : null;
      const signedClosingBalance = closingBalance !== null ? (isCredit ? -Math.abs(closingBalance) : Math.abs(closingBalance)) : null;

      // استخراج البيان ورقم السند/الفاتورة لإنشاء كشف الحساب المتزامن بدقة
      let docNo = '';
      let details = '';
      for (const [k, v] of Object.entries(row)) {
        if (v === null || v === undefined) continue;
        const kn = normalizeText(k);
        if (!docNo && (kn.includes('سند') || kn.includes('فاتورة') || kn.includes('رقم') || kn === 'id' || kn === 'code')) {
          docNo = String(v).trim();
        }
        if (!details && (kn.includes('بيان') || kn.includes('وصف') || kn.includes('ملاحظ') || kn.includes('تفاصيل') || kn.includes('شرح'))) {
          details = String(v).trim();
        }
      }

      clientEntry.records.push({
        clientName: clientEntry.displayName,
        date,
        invoiceAmount: invoiceAmount,
        paymentAmount: paymentAmount,
        balance: signedBalance,
        openingBalance: signedOpeningBalance,
        closingBalance: signedClosingBalance,
        docNo: docNo,
        details: details,
        isCredit: isCredit,
        balanceType: isCredit ? 'credit' : 'debit',
        source: `${sheet.fileName} / ${sheet.sheetName}`
      });
    }
  });

  // تحويل إلى Map<string, Array> المتوافقة مع المحرك الحسابي
  const finalClientsMap = new Map();
  for (const [, entry] of clientsMap) {
    finalClientsMap.set(entry.displayName, entry.records);
  }

  return {
    clients: finalClientsMap,
    clientCount: finalClientsMap.size,
    totalRecords: Array.from(finalClientsMap.values()).reduce((sum, r) => sum + r.length, 0)
  };
}

/**
 * تحويل التاريخ مع دعم التوقيت بالكامل والأرقام العربية ورموز (ص / م)
 */
function parseDate(value) {
  if (!value) return null;

  // إذا كان Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  let str = String(value).trim();

  // تنظيف الأرقام الهندية (المشرقية) والرموز العربية للصباح والمساء (ص / م)
  str = str
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/(\d{1,2}:\d{1,2}(?::\d{1,2})?)\s*([صم])/g, (m, time, ap) => (ap === 'م' ? `${time} PM` : `${time} AM`))
    .replace(/([صم])\s*(\d{1,2}:\d{1,2}(?::\d{1,2})?)/g, (m, ap, time) => (ap === 'م' ? `${time} PM` : `${time} AM`))
    .replace(/\s*م$/g, ' PM')
    .replace(/\s*ص$/g, ' AM');

  // محاولة التحويل المباشر بعد التنظيف
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) return direct;

  // محاولة أنماط مختلفة
  // DD/MM/YYYY أو DD-MM-YYYY (مع وقت اختياري)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?$/i);
  if (dmyMatch) {
    let [, day, month, year, hours, minutes, seconds, ap] = dmyMatch;
    if (year.length === 2) year = '20' + year;
    let h = hours ? parseInt(hours, 10) : 0;
    if (ap) {
      if (ap.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ap.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const d = new Date(year, month - 1, day, h, minutes ? parseInt(minutes, 10) : 0, seconds ? parseInt(seconds, 10) : 0);
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY/MM/DD أو YYYY-MM-DD (مع وقت اختياري)
  const ymdMatch = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?$/i);
  if (ymdMatch) {
    let [, year, month, day, hours, minutes, seconds, ap] = ymdMatch;
    let h = hours ? parseInt(hours, 10) : 0;
    if (ap) {
      if (ap.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ap.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const d = new Date(year, month - 1, day, h, minutes ? parseInt(minutes, 10) : 0, seconds ? parseInt(seconds, 10) : 0);
    if (!isNaN(d.getTime())) return d;
  }

  // Excel serial date number
  const num = parseFloat(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date((num - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * تحويل الأرقام
 */
function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;

  const str = String(value)
    .replace(/,/g, '')
    .replace(/٬/g, '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\s/g, '')
    .trim();

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * تطبيع النص للمقارنة
 */
function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ى]/g, 'ي');
}

/**
 * حساب التشابه بين نصين
 */
function calculateSimilarity(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) {
    const shorter = str1.length < str2.length ? str1 : str2;
    if (shorter.length >= 3) return 0.9;
  }

  const words1 = str1.split(' ').filter(w => w.length > 0);
  const words2 = str2.split(' ').filter(w => w.length > 0);
  let matches = 0;

  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2) {
        matches++;
        break;
      }
      if (w1.length >= 3 && w2.length >= 3 && (w1.includes(w2) || w2.includes(w1))) {
        matches++;
        break;
      }
    }
  }

  return matches / Math.max(words1.length, words2.length);
}

/**
 * تنسيق التاريخ بالعربي (مع أرقام إنجليزية)
 */
function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    numberingSystem: 'latn'
  }).format(date);
}
