/* ============================================
   Excel Parser — قراءة وتحليل ملفات الإكسل
   ============================================ */

/**
 * أنماط أسماء الأعمدة المتوقعة للاكتشاف التلقائي
 */
const COLUMN_PATTERNS = {
  clientName: {
    label: 'اسم العميل',
    patterns: [
      'اسم العميل', 'العميل', 'اسم', 'الاسم', 'عميل', 'اسم المورد',
      'client', 'customer', 'name', 'client_name', 'customer_name',
      'اسم الزبون', 'الزبون', 'اسم العميل/المورد', 'اسم الحساب',
      'حساب', 'الحساب'
    ]
  },
  date: {
    label: 'التاريخ',
    patterns: [
      'التاريخ', 'تاريخ', 'تاريخ الفاتورة', 'تاريخ المعاملة',
      'date', 'invoice_date', 'transaction_date', 'تاريخ القيد',
      'تاريخ العملية', 'التاريخ الميلادي'
    ]
  },
  invoiceAmount: {
    label: 'قيمة الفاتورة',
    patterns: [
      'قيمة الفاتورة', 'المبلغ', 'القيمة', 'مبلغ', 'قيمة', 'المبيعات',
      'مدين', 'مبيعات', 'إجمالي', 'الإجمالي', 'صافي',
      'amount', 'invoice_amount', 'total', 'sales', 'debit',
      'قيمة البيع', 'مبلغ الفاتورة', 'اجمالي الفاتورة'
    ]
  },
  paymentAmount: {
    label: 'المحصّل (دائن)',
    patterns: [
      'دائن', 'المحصل', 'محصل', 'التحصيل', 'تحصيل', 'المدفوع', 'مدفوع',
      'payment', 'credit', 'collected', 'paid', 'receipt',
      'سداد', 'مسدد', 'الدائن', 'مبلغ السداد', 'قيمة السداد'
    ]
  },
  balance: {
    label: 'الرصيد',
    patterns: [
      'الرصيد', 'رصيد', 'الرصيد الحالي', 'رصيد حالي', 'الرصيد المتبقي',
      'balance', 'current_balance', 'remaining', 'outstanding',
      'رصيد العميل', 'الرصيد المدين', 'المتبقي', 'رصيد مدين'
    ]
  },
  openingBalance: {
    label: 'رصيد أول المدة',
    patterns: [
      'رصيد أول المدة', 'رصيد اول المدة', 'رصيد افتتاحي', 'الرصيد الافتتاحي',
      'opening balance', 'beginning balance', 'start balance'
    ]
  },
  closingBalance: {
    label: 'رصيد آخر المدة',
    patterns: [
      'رصيد آخر المدة', 'رصيد اخر المدة', 'رصيد ختامي', 'الرصيد الختامي',
      'الرصيد الحالي', 'رصيد حالي', 'closing balance', 'ending balance', 'current balance'
    ]
  }
};

async function parseExcelFiles(files) {
  const allSheets = [];
  
  // الكلمات المفتاحية للبحث عن صف العناوين
  const keywords = ['اسم', 'عميل', 'تاريخ', 'رصيد', 'مبلغ', 'فاتورة', 'قيمة', 'مدين', 'مبيعات', 'حساب'];

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
        if (!row) continue;
        
        let currentKeywords = 0;
        for (const cell of row) {
          if (typeof cell === 'string') {
            const normalized = normalizeText(cell);
            if (keywords.some(k => normalized.includes(k))) {
              currentKeywords++;
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
function autoDetectColumns(headers, columnProfiles = []) {
  const mapping = {};

  for (const [field, config] of Object.entries(COLUMN_PATTERNS)) {
    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < headers.length; i++) {
      if ((field === 'openingBalance' || field === 'closingBalance') && !hasSpecificBalanceTiming(headers[i], field)) {
        continue;
      }
      const headerScore = getHeaderScore(headers[i], config.patterns);
      const profile = columnProfiles[i];
      const contentScore = getContentScore(field, profile);
      // الاسم يحدد المعنى، والقيم تؤكد أن العمود صالح لهذا المعنى.
      const score = headerScore > 0 ? (headerScore * 0.8) + (contentScore * 0.2) : contentScore * 0.35;
      // المحتوى يؤكد نوع البيانات فقط؛ لا يجوز أن يحول «قيمة الفاتورة» إلى «سداد» لمجرد أن كليهما أرقام.
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
    ? ['اول', 'افتتاح', 'opening', 'beginning', 'start']
    : ['اخر', 'ختام', 'حالي', 'closing', 'ending', 'current'];
  return terms.some(term => normalized.includes(term));
}

/**
 * يحلل محتوى الأعمدة (وليس رأس العمود فقط) حتى تكون الاقتراحات آمنة مع تنسيقات مختلفة.
 */
function analyzeSheetStructure(headers, data, sheetName = '', fileName = '') {
  const sample = data.slice(0, 250);
  const columnProfiles = headers.map(header => profileColumn(header, sample));
  const contextNameNormalized = normalizeText(fileName + ' ' + sheetName);
  
  const sheetHints = {
    invoices: getHeaderScore(contextNameNormalized, ['فواتير', 'فاتوره', 'مبيعات', 'invoice', 'sales']),
    payments: getHeaderScore(contextNameNormalized, ['سداد', 'تحصيل', 'مقبوضات', 'قبض', 'صرف', 'payment', 'receipt', 'collection']),
    balances: getHeaderScore(contextNameNormalized, ['ارصده', 'أرصدة', 'رصيد', 'ميزان', 'balance', 'statement'])
  };
  
  const suggestedMapping = autoDetectColumns(headers, columnProfiles);
  const genericAmount = findGenericAmountColumn(headers, columnProfiles);
  
  // استكشاف عمود الرصيد العام
  let genericBalance = null;
  let bestBalScore = 0;
  headers.forEach((h, i) => {
    const s = getHeaderScore(h, COLUMN_PATTERNS.balance.patterns) * 0.7 + (columnProfiles[i]?.numericRatio || 0) * 0.3;
    if (s > bestBalScore && s >= 0.5) {
      bestBalScore = s;
      genericBalance = h;
    }
  });

  const isOpeningSheet = getHeaderScore(contextNameNormalized, ['اول', 'افتتاحي', 'بداية', 'opening', 'start']) >= 0.6;
  const isClosingSheet = getHeaderScore(contextNameNormalized, ['حالي', 'اخر', 'نهاية', 'ختامي', 'closing', 'end', 'current']) >= 0.6;

  // الذكاء الجديد: توجيه عمود "الرصيد" بناءً على اسم الملف أو الشيت (أول أو آخر المدة)
  if (genericBalance) {
    if (isOpeningSheet) {
      suggestedMapping.openingBalance = genericBalance;
      if (suggestedMapping.closingBalance === genericBalance) suggestedMapping.closingBalance = null;
      if (suggestedMapping.balance === genericBalance) suggestedMapping.balance = null;
    } else if (isClosingSheet) {
      suggestedMapping.closingBalance = genericBalance;
      if (suggestedMapping.openingBalance === genericBalance) suggestedMapping.openingBalance = null;
      if (suggestedMapping.balance === genericBalance) suggestedMapping.balance = null;
    }
  }

  // الذكاء الجديد: توجيه عمود "المبلغ/القيمة" بناءً على اسم الملف أو الشيت بقوة، ومنع التداخل.
  if (genericAmount) {
    if (sheetHints.payments >= 0.6 && sheetHints.payments > sheetHints.invoices) {
      suggestedMapping.paymentAmount = genericAmount;
      if (suggestedMapping.invoiceAmount === genericAmount) {
        suggestedMapping.invoiceAmount = null;
      }
    } else if (sheetHints.invoices >= 0.6 && sheetHints.invoices > sheetHints.payments) {
      suggestedMapping.invoiceAmount = genericAmount;
      if (suggestedMapping.paymentAmount === genericAmount) {
        suggestedMapping.paymentAmount = null;
      }
    }
  }

  const nameScore = getMappedScore('clientName', suggestedMapping, headers, columnProfiles);
  const dateScore = getMappedScore('date', suggestedMapping, headers, columnProfiles);
  const invoiceScore = getMappedScore('invoiceAmount', suggestedMapping, headers, columnProfiles);
  const paymentScore = getMappedScore('paymentAmount', suggestedMapping, headers, columnProfiles);
  const balanceScore = Math.max(
    getMappedScore('balance', suggestedMapping, headers, columnProfiles),
    getMappedScore('closingBalance', suggestedMapping, headers, columnProfiles)
  );
  const openingScore = getMappedScore('openingBalance', suggestedMapping, headers, columnProfiles);

  const invoiceRoleScore = (nameScore * 0.35) + (invoiceScore * 0.45) + (dateScore * 0.1) + (sheetHints.invoices * 0.1)
    - (sheetHints.payments >= 0.6 && sheetHints.invoices < 0.6 ? 0.4 : 0);
  const paymentRoleScore = (nameScore * 0.35) + (paymentScore * 0.45) + (dateScore * 0.1) + (sheetHints.payments * 0.1)
    - (sheetHints.invoices >= 0.6 && sheetHints.payments < 0.6 ? 0.4 : 0);

  const roleScores = {
    invoices: Math.max(0, Math.round(invoiceRoleScore * 100) / 100),
    payments: Math.max(0, Math.round(paymentRoleScore * 100) / 100),
    balances: Math.round(((nameScore * 0.4) + (balanceScore * 0.4) + (openingScore * 0.1) + (sheetHints.balances * 0.1)) * 100) / 100
  };

  return {
    columnProfiles,
    suggestedMapping,
    roleScores,
    evidence: buildProfileEvidence(suggestedMapping, headers, columnProfiles)
  };
}

function findGenericAmountColumn(headers, profiles) {
  const genericPatterns = ['المبلغ', 'مبلغ', 'القيمة', 'قيمة', 'amount', 'total', 'اجمالي', 'الإجمالي'];
  let candidate = null;
  let bestScore = 0;

  headers.forEach((header, index) => {
    const headerScore = getHeaderScore(header, genericPatterns);
    const numericRatio = profiles[index]?.numericRatio || 0;
    const score = (headerScore * 0.65) + (numericRatio * 0.35);
    if (headerScore >= 0.6 && numericRatio >= 0.6 && score > bestScore) {
      candidate = header;
      bestScore = score;
    }
  });

  return candidate;
}

function profileColumn(header, rows) {
  let nonEmpty = 0;
  let numeric = 0;
  let dates = 0;
  let text = 0;
  const uniqueText = new Set();

  rows.forEach(row => {
    const value = row[header];
    if (value === null || value === undefined || String(value).trim() === '') return;
    nonEmpty++;

    if (isLikelyDateValue(value)) {
      dates++;
      return;
    }

    if (parseNumber(value) !== null) {
      numeric++;
      return;
    }

    text++;
    uniqueText.add(normalizeText(value));
  });

  return {
    nonEmpty,
    numericRatio: nonEmpty ? numeric / nonEmpty : 0,
    dateRatio: nonEmpty ? dates / nonEmpty : 0,
    textRatio: nonEmpty ? text / nonEmpty : 0,
    repeatedTextRatio: text ? 1 - (uniqueText.size / text) : 0
  };
}

function isLikelyDateValue(value) {
  if (value instanceof Date) return !isNaN(value.getTime());
  const text = String(value).trim();
  return /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}(?:[ T].*)?$/.test(text)
    || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(text);
}

function getHeaderScore(header, patterns) {
  const normalizedHeader = normalizeText(header);
  return patterns.reduce((best, pattern) => Math.max(best, calculateSimilarity(normalizedHeader, normalizeText(pattern))), 0);
}

function getContentScore(field, profile) {
  if (!profile || profile.nonEmpty === 0) return 0;
  if (field === 'clientName') return Math.min(1, (profile.textRatio * 0.8) + (profile.repeatedTextRatio * 0.2));
  if (field === 'date') return profile.dateRatio;
  return profile.numericRatio;
}

function getMappedScore(field, mapping, headers, profiles) {
  const header = mapping[field];
  if (!header) return 0;
  const index = headers.indexOf(header);
  const config = COLUMN_PATTERNS[field];
  return (getHeaderScore(header, config.patterns) * 0.8) + (getContentScore(field, profiles[index]) * 0.2);
}

function buildProfileEvidence(mapping, headers, profiles) {
  return Object.entries(mapping)
    .filter(([, header]) => header)
    .map(([field, header]) => {
      const profile = profiles[headers.indexOf(header)];
      const valueType = field === 'clientName' ? 'نص' : field === 'date' ? 'تاريخ' : 'رقم';
      return `${COLUMN_PATTERNS[field].label}: ${header} (${profile.nonEmpty} قيمة ${valueType})`;
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
 * تطبيق الربط وتحويل البيانات مع دمج ذكي لأسماء العملاء
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
      const balance = mapping.balance ? parseNumber(row[mapping.balance]) : null;
      const openingBalance = mapping.openingBalance ? parseNumber(row[mapping.openingBalance]) : null;
      const closingBalance = mapping.closingBalance ? parseNumber(row[mapping.closingBalance]) : null;

      clientEntry.records.push({
        clientName: clientEntry.displayName,
        date,
        invoiceAmount: invoiceAmount,
        paymentAmount: paymentAmount,
        balance: balance,
        openingBalance,
        closingBalance,
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
 * تحويل التاريخ
 */
function parseDate(value) {
  if (!value) return null;

  // إذا كان Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();

  // محاولة التحويل المباشر
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) return direct;

  // محاولة أنماط مختلفة
  // DD/MM/YYYY أو DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmyMatch) {
    let [, day, month, year] = dmyMatch;
    if (year.length === 2) year = '20' + year;
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const d = new Date(year, month - 1, day);
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
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;

  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  let matches = 0;

  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
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
