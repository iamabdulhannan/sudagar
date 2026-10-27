/** words used by the items module */
export const en = {
  // list
  itProducts: 'Products', itServices: 'Services', itProduct: 'Product', itService: 'Service',
  itNew: 'Add item', itEdit: 'Edit item', itImport: 'Import CSV', itCategories: 'Categories',
  itSearchPh: 'Search by name, code or barcode', itAllCategories: 'All categories', itNoCategory: 'No category',
  itStock: 'Stock', itStockValue: 'Stock value', itStockAll: 'All stock', itStockIn: 'In stock', itStockLow: 'Low stock',
  itStockOut: 'Out of stock', itCount: 'Items', itLowStock: 'Low stock', itOutOfStock: 'Out of stock',
  itLow: 'Low', itOut: 'Out', itSelectAll: 'Select all', itShowing: 'Showing {n} of {total}', itLabelsN: 'Labels ({n})',
  itEmptyTitle: 'No items yet', itEmptyText: 'Add the products and services you sell, or import them from a CSV file.',

  // form
  itName: 'Item name', itCode: 'Item code / SKU', itBarcode: 'Barcode', itGenerate: 'Generate', itCategory: 'Category',
  itAddCategory: 'Add category', itCategoryName: 'Category name', itAltUnit: 'Second unit',
  itAltFactor: 'Base units in 1 second unit', itAltHint: '1 {alt} = {n} {unit}',
  itSalePrice: 'Sale price', itWholesalePrice: 'Wholesale price', itWholesaleMinQty: 'Wholesale from qty',
  itWholesaleMinHint: 'Anyone buying this many gets the wholesale price. 0 = wholesale customers only.',
  itPurchasePrice: 'Purchase price', itMrp: 'MRP', itTaxRate: 'Tax %', itPriceIncludesTax: 'Prices include tax',
  itPriceIncludesTaxHint: 'Turn on if the sale price already has tax in it.',
  itOpeningStock: 'Opening stock', itOpeningCost: 'Opening cost per unit', itOpeningCostHint: 'Empty = purchase price',
  itOpeningDate: 'Opening stock date', itOpeningEditHint: 'Stock you had before using Saudagar.',
  itMinStock: 'Low stock alert at', itMinStockHint: 'Shows as low when stock reaches this.',
  itLocation: 'Location / rack', itHsn: 'HSN / PCT code', itDescription: 'Description', itActive: 'Active (shows in billing)',
  itSecPricing: 'Pricing', itSecStock: 'Stock', itSecMore: 'More details', itSaved: 'Item saved',
  itAddNamed: 'Add new item "{name}"',
  itErrDupName: 'An item with this name already exists.', itErrDupBarcode: 'This barcode is used by {name}.',
  itErrDupCode: 'This code is used by {name}.', itErrNegative: 'Cannot be negative.',
  itErrAltFactor: 'Enter how many base units make one second unit.', itErrAltSame: 'The second unit must be different from the unit.',
  itErrQty: 'Enter a quantity above 0.',

  // categories
  itCatExists: 'This category already exists.', itCatInUse: 'Used by {n} items. Move them to another category first.',
  itCatDelete: 'Delete category "{name}"?', itItemsCount: '{n} items',

  // detail
  itNotFound: 'Item not found', itAdjust: 'Adjust stock', itPrintLabels: 'Print labels', itDeactivate: 'Deactivate',
  itActivate: 'Activate', itDeactivated: 'Item deactivated', itActivated: 'Item activated',
  itCannotDelete: 'This item cannot be deleted',
  itCannotDeleteText: 'It is used on invoices or stock adjustments. Deactivate it instead to hide it from billing.',
  itDeleteTitle: 'Delete "{name}"?', itAvgCost: 'Average cost', itPerUnit: 'per {unit}', itMargin: 'Margin',
  itMinStockIs: 'Alert at {n} {unit}',
  itTabTxns: 'Transactions', itTabAdjustments: 'Stock adjustments', itTabBatches: 'Batches',
  itAllTypes: 'All types', itParty: 'Party', itQtyIn: 'In', itQtyOut: 'Out', itBalance: 'Stock',
  itAdjustment: 'Stock adjustment', itNoMoves: 'No transactions yet', itNoMovesText: 'Sales, purchases and adjustments of this item show here.',

  // adjustments
  itAdjAdd: 'Add stock', itAdjRemove: 'Remove stock', itReason: 'Reason', itBatch: 'Batch', itInStock: 'In stock',
  itAfter: 'After', itAdjSaved: 'Stock adjusted', itAdjDelete: 'Delete this adjustment?',
  itNoAdjustments: 'No adjustments', itNoAdjustmentsText: 'Correct the stock after a count, or remove damaged and expired goods.',
  adjr_count: 'Stock count correction', adjr_damage: 'Damaged', adjr_expired: 'Expired', adjr_gift: 'Gift / free sample',
  adjr_own_use: 'Own use', adjr_production: 'Used in production', adjr_other: 'Other',

  // batches
  itExpiry: 'Expiry', itExpired: 'Expired', itExpiresIn: 'Expires in {n} days', itNoBatch: 'No batch',
  itNoBatches: 'No batches yet', itNoBatchesText: 'Batch numbers entered on purchases and sales show here.',

  // labels
  itLabelSize: 'Label size', itLabelMedium: 'Medium (3 across, 21 per A4)', itLabelSmall: 'Small (4 across, 40 per A4)',
  itLabelFirm: 'Business name', itLabelPrice: 'Price', itLabelCount: 'Labels', itNoBarcode: 'No barcode or code',
  itPrintN: 'Print {n} labels',

  // import
  itImpStep1: 'Download the template and fill one item per row (Excel can save it as CSV).',
  itImpStep2: 'Choose the file. Rows are checked before anything is saved.',
  itImpStep3: 'Rows with problems are skipped. New categories are created by name.',
  itImpTemplate: 'Download template', itImpChoose: 'Choose CSV file', itImpSave: 'Import {n} items',
  itImpGood: '{n} ready', itImpBad: '{n} with problems', itImpOk: 'OK', itImpMore: '{n} more rows not shown',
  itImpDone: '{n} items imported', itImpEmpty: 'The file has no rows.', itImpNoName: 'The file needs a "name" column.',
  itImpNoItemName: 'Name is missing.', itImpExists: '"{name}" already exists.', itImpBadKind: 'Kind must be product or service.',
  itImpBadNumber: '{col} must be a number of 0 or more.', itImpDupCode: 'Code {code} is already used.',
  itImpDupBarcode: 'Barcode {code} is already used.',
  // bulk price update
  itBulkN: 'Update prices ({n})', itBulkTitle: 'Update prices of {n} items', itBulkField: 'Price to change', itBulkOp: 'Change',
  itBulkIncrease: 'Increase by', itBulkDecrease: 'Decrease by', itBulkSet: 'Set to', itBulkBy: 'By', itBulkNewPrice: 'New price',
  itBulkRound: 'Round new price', itBulkRoundNone: 'Do not round', itBulkRoundN: 'To nearest {n}', itBulkPreview: 'Preview',
  itBulkOld: 'Now', itBulkNew: 'New', itBulkNoChange: 'Enter a change to see the new prices.',
  itBulkSave: 'Update {n} items', itBulkDone: 'Prices updated for {n} items', itBulkSkipped: '{n} items keep the same price.',
  itTabGodowns: 'By godown',

  // camera scanning
  scanCamera: 'Scan with camera', scanHint: 'Hold the barcode inside the box. It is read on its own.',
  scanUnsupported: 'This browser cannot scan barcodes with the camera.',
  scanTip: 'Use a USB barcode scanner (it types the code), or open Saudagar in Chrome on Android.',
  scanDenied: 'Camera permission was refused. Allow the camera for this site in the browser settings and try again.',
  scanNoCamera: 'No camera was found on this device.', scanInsecure: 'The camera only works when the app is opened over https.',
  scanError: 'The camera could not be started. Close other apps using it and try again.',
}

export const ur: Partial<typeof en> = {
  itProducts: 'پروڈکٹس', itServices: 'سروسز', itProduct: 'پروڈکٹ', itService: 'سروس',
  itNew: 'آئٹم شامل کریں', itEdit: 'آئٹم میں تبدیلی', itImport: 'CSV سے شامل کریں', itCategories: 'کیٹیگریز',
  itSearchPh: 'نام، کوڈ یا بارکوڈ سے تلاش کریں', itAllCategories: 'تمام کیٹیگریز', itNoCategory: 'بغیر کیٹیگری',
  itStock: 'اسٹاک', itStockValue: 'اسٹاک کی مالیت', itStockAll: 'تمام اسٹاک', itStockIn: 'اسٹاک میں موجود', itStockLow: 'کم اسٹاک',
  itStockOut: 'اسٹاک ختم', itCount: 'آئٹمز', itLowStock: 'کم اسٹاک', itOutOfStock: 'اسٹاک ختم',
  itLow: 'کم', itOut: 'ختم', itSelectAll: 'سب منتخب کریں', itShowing: '{total} میں سے {n}', itLabelsN: 'لیبل ({n})',
  itEmptyTitle: 'ابھی کوئی آئٹم نہیں', itEmptyText: 'جو مال اور سروسز آپ بیچتے ہیں وہ شامل کریں، یا CSV فائل سے لائیں۔',

  itName: 'آئٹم کا نام', itCode: 'آئٹم کوڈ / SKU', itBarcode: 'بارکوڈ', itGenerate: 'بنائیں', itCategory: 'کیٹیگری',
  itAddCategory: 'کیٹیگری شامل کریں', itCategoryName: 'کیٹیگری کا نام', itAltUnit: 'دوسرا یونٹ',
  itAltFactor: 'ایک دوسرے یونٹ میں کتنے بنیادی یونٹ', itAltHint: '1 {alt} = {n} {unit}',
  itSalePrice: 'فروخت قیمت', itWholesalePrice: 'ہول سیل قیمت', itWholesaleMinQty: 'ہول سیل کم از کم تعداد',
  itWholesaleMinHint: 'جو بھی اتنی تعداد لے اسے ہول سیل قیمت ملے گی۔ 0 = صرف ہول سیل گاہک۔',
  itPurchasePrice: 'خرید قیمت', itMrp: 'MRP', itTaxRate: 'ٹیکس %', itPriceIncludesTax: 'قیمت میں ٹیکس شامل ہے',
  itPriceIncludesTaxHint: 'اگر فروخت قیمت میں پہلے سے ٹیکس شامل ہے تو آن کریں۔',
  itOpeningStock: 'ابتدائی اسٹاک', itOpeningCost: 'ابتدائی لاگت فی یونٹ', itOpeningCostHint: 'خالی = خرید قیمت',
  itOpeningDate: 'ابتدائی اسٹاک کی تاریخ', itOpeningEditHint: 'سوداگر استعمال کرنے سے پہلے کا اسٹاک۔',
  itMinStock: 'کم اسٹاک کی حد', itMinStockHint: 'اسٹاک اس حد تک آنے پر کم دکھائے گا۔',
  itLocation: 'جگہ / ریک', itHsn: 'HSN / PCT کوڈ', itDescription: 'تفصیل', itActive: 'فعال (بلنگ میں دکھائیں)',
  itSecPricing: 'قیمتیں', itSecStock: 'اسٹاک', itSecMore: 'مزید تفصیل', itSaved: 'آئٹم محفوظ ہو گیا',
  itAddNamed: 'نیا آئٹم "{name}" شامل کریں',
  itErrDupName: 'اس نام کا آئٹم پہلے سے موجود ہے۔', itErrDupBarcode: 'یہ بارکوڈ {name} پر لگا ہے۔',
  itErrDupCode: 'یہ کوڈ {name} پر لگا ہے۔', itErrNegative: 'منفی نہیں ہو سکتا۔',
  itErrAltFactor: 'لکھیں کہ ایک دوسرے یونٹ میں کتنے بنیادی یونٹ ہیں۔', itErrAltSame: 'دوسرا یونٹ پہلے یونٹ سے مختلف ہونا چاہیے۔',
  itErrQty: 'صفر سے زیادہ تعداد لکھیں۔',

  itCatExists: 'یہ کیٹیگری پہلے سے موجود ہے۔', itCatInUse: '{n} آئٹمز میں استعمال ہو رہی ہے۔ پہلے انہیں دوسری کیٹیگری میں ڈالیں۔',
  itCatDelete: 'کیٹیگری "{name}" حذف کریں؟', itItemsCount: '{n} آئٹمز',

  itNotFound: 'آئٹم نہیں ملا', itAdjust: 'اسٹاک ایڈجسٹ کریں', itPrintLabels: 'لیبل پرنٹ کریں', itDeactivate: 'غیر فعال کریں',
  itActivate: 'فعال کریں', itDeactivated: 'آئٹم غیر فعال ہو گیا', itActivated: 'آئٹم فعال ہو گیا',
  itCannotDelete: 'یہ آئٹم حذف نہیں ہو سکتا',
  itCannotDeleteText: 'یہ انوائسز یا اسٹاک ایڈجسٹمنٹ میں استعمال ہوا ہے۔ بلنگ سے چھپانے کے لیے اسے غیر فعال کریں۔',
  itDeleteTitle: '"{name}" حذف کریں؟', itAvgCost: 'اوسط لاگت', itPerUnit: 'فی {unit}', itMargin: 'منافع کی شرح',
  itMinStockIs: '{n} {unit} پر الرٹ',
  itTabTxns: 'لین دین', itTabAdjustments: 'اسٹاک ایڈجسٹمنٹ', itTabBatches: 'بیچ',
  itAllTypes: 'تمام اقسام', itParty: 'پارٹی', itQtyIn: 'آمد', itQtyOut: 'روانگی', itBalance: 'اسٹاک',
  itAdjustment: 'اسٹاک ایڈجسٹمنٹ', itNoMoves: 'ابھی کوئی لین دین نہیں', itNoMovesText: 'اس آئٹم کی فروخت، خریداری اور ایڈجسٹمنٹ یہاں دکھیں گی۔',

  itAdjAdd: 'اسٹاک بڑھائیں', itAdjRemove: 'اسٹاک کم کریں', itReason: 'وجہ', itBatch: 'بیچ', itInStock: 'موجود اسٹاک',
  itAfter: 'بعد میں', itAdjSaved: 'اسٹاک ایڈجسٹ ہو گیا', itAdjDelete: 'یہ ایڈجسٹمنٹ حذف کریں؟',
  itNoAdjustments: 'کوئی ایڈجسٹمنٹ نہیں', itNoAdjustmentsText: 'گنتی کے بعد اسٹاک درست کریں، یا خراب اور ایکسپائر مال نکالیں۔',
  adjr_count: 'گنتی کے مطابق درستی', adjr_damage: 'خراب', adjr_expired: 'ایکسپائر', adjr_gift: 'تحفہ / مفت نمونہ',
  adjr_own_use: 'ذاتی استعمال', adjr_production: 'پیداوار میں استعمال', adjr_other: 'دیگر',

  itExpiry: 'ایکسپائری', itExpired: 'ایکسپائر ہو گیا', itExpiresIn: '{n} دن میں ایکسپائر', itNoBatch: 'بغیر بیچ',
  itNoBatches: 'ابھی کوئی بیچ نہیں', itNoBatchesText: 'خریداری اور فروخت پر لکھے بیچ نمبر یہاں دکھیں گے۔',

  itLabelSize: 'لیبل کا سائز', itLabelMedium: 'درمیانہ (ایک قطار میں 3، A4 پر 21)', itLabelSmall: 'چھوٹا (ایک قطار میں 4، A4 پر 40)',
  itLabelFirm: 'کاروبار کا نام', itLabelPrice: 'قیمت', itLabelCount: 'لیبل', itNoBarcode: 'بارکوڈ یا کوڈ نہیں',
  itPrintN: '{n} لیبل پرنٹ کریں',

  itImpStep1: 'ٹیمپلیٹ ڈاؤن لوڈ کریں اور ہر قطار میں ایک آئٹم لکھیں (ایکسل اسے CSV میں محفوظ کر سکتا ہے)۔',
  itImpStep2: 'فائل منتخب کریں۔ محفوظ کرنے سے پہلے ہر قطار چیک ہو گی۔',
  itImpStep3: 'غلطی والی قطاریں چھوڑ دی جائیں گی۔ نئی کیٹیگریز نام سے بن جائیں گی۔',
  itImpTemplate: 'ٹیمپلیٹ ڈاؤن لوڈ کریں', itImpChoose: 'CSV فائل منتخب کریں', itImpSave: '{n} آئٹمز شامل کریں',
  itImpGood: '{n} تیار', itImpBad: '{n} میں غلطی', itImpOk: 'ٹھیک', itImpMore: 'مزید {n} قطاریں نہیں دکھائی گئیں',
  itImpDone: '{n} آئٹمز شامل ہو گئے', itImpEmpty: 'فائل میں کوئی قطار نہیں۔', itImpNoName: 'فائل میں "name" کالم ہونا چاہیے۔',
  itImpNoItemName: 'نام موجود نہیں۔', itImpExists: '"{name}" پہلے سے موجود ہے۔', itImpBadKind: 'قسم product یا service ہونی چاہیے۔',
  itImpBadNumber: '{col} صفر یا اس سے زیادہ عدد ہونا چاہیے۔', itImpDupCode: 'کوڈ {code} پہلے سے استعمال میں ہے۔',
  itImpDupBarcode: 'بارکوڈ {code} پہلے سے استعمال میں ہے۔',
  itBulkN: 'قیمتیں بدلیں ({n})', itBulkTitle: '{n} آئٹمز کی قیمتیں بدلیں', itBulkField: 'کون سی قیمت', itBulkOp: 'تبدیلی',
  itBulkIncrease: 'اتنی بڑھائیں', itBulkDecrease: 'اتنی کم کریں', itBulkSet: 'یہ قیمت لگائیں', itBulkBy: 'کتنی', itBulkNewPrice: 'نئی قیمت',
  itBulkRound: 'نئی قیمت گول کریں', itBulkRoundNone: 'گول نہ کریں', itBulkRoundN: 'قریب ترین {n} تک', itBulkPreview: 'پیش نظارہ',
  itBulkOld: 'ابھی', itBulkNew: 'نئی', itBulkNoChange: 'نئی قیمتیں دیکھنے کے لیے تبدیلی لکھیں۔',
  itBulkSave: '{n} آئٹمز اپ ڈیٹ کریں', itBulkDone: '{n} آئٹمز کی قیمتیں بدل گئیں', itBulkSkipped: '{n} آئٹمز کی قیمت وہی رہے گی۔',
  itTabGodowns: 'گودام کے حساب سے',

  scanCamera: 'کیمرے سے اسکین کریں', scanHint: 'بارکوڈ کو خانے کے اندر رکھیں۔ یہ خود پڑھ لیا جائے گا۔',
  scanUnsupported: 'یہ براؤزر کیمرے سے بارکوڈ اسکین نہیں کر سکتا۔',
  scanTip: 'یو ایس بی بارکوڈ اسکینر استعمال کریں (یہ کوڈ خود لکھ دیتا ہے)، یا اینڈرائیڈ پر کروم میں سوداگر کھولیں۔',
  scanDenied: 'کیمرے کی اجازت نہیں ملی۔ براؤزر کی سیٹنگز میں اس سائٹ کو کیمرے کی اجازت دیں اور دوبارہ کوشش کریں۔',
  scanNoCamera: 'اس ڈیوائس پر کوئی کیمرہ نہیں ملا۔', scanInsecure: 'کیمرہ صرف https پر کھلی ایپ میں چلتا ہے۔',
  scanError: 'کیمرہ شروع نہیں ہو سکا۔ اسے استعمال کرنے والی دوسری ایپس بند کر کے دوبارہ کوشش کریں۔',
}
