/** words used by the stock module (godowns, transfers, manufacturing, catalogue) */
export const en = {
  // shared
  stTurnOn: 'Turn it on in Settings', stItem: 'Item', stGodown: 'Godown', stAllGodowns: 'All godowns', stMain: 'Main',
  stAvailable: 'Available', stAvgCost: 'Avg cost', stNoLines: 'No items added yet. Search above to add items.',
  stShort: 'More than available', stShortTitle: 'Not enough stock for some items',
  stShortLine: '{name}: need {need}, available {have}', stShortBlocked: 'Not enough stock. Your settings block going below zero.',
  stMissingItem: 'Deleted item', stLines: 'Items', stDeleteText: 'It moves to the recycle bin and can be restored from there.',
  stDeleteEntry: 'Delete {no}?',

  // godowns
  stGodownsSub: 'Stock in each godown or branch, and moving stock between them',
  stGodownsOffTitle: 'Godowns are turned off',
  stGodownsOffText: 'Turn on "Several godowns / branches" in Settings, Features to keep stock in more than one place and move it between them.',
  stTabStock: 'Stock by godown', stHideZero: 'Hide zero stock', stAddGodown: 'Add godown', stEditGodown: 'Edit godown',
  stGodownName: 'Godown / branch name', stGodownNamePh: 'e.g. Back store, Lahore branch', stErrDupGodown: 'A godown with this name already exists.',
  stItemsInStock: 'Items in stock', stGodownOff: 'Godown deactivated', stGodownOn: 'Godown activated',
  stDeactivateTitle: 'Deactivate {name}?', stDeactivateStock: '{n} items still have stock here. Move the stock out first if you can.',
  stCannotDelete: 'This godown cannot be deleted', stCannotDeleteText: 'It is used on transfers, bills or adjustments. Deactivate it instead.',
  stDeleteGodown: 'Delete {name}?',

  // transfers
  stNewTransfer: 'New transfer', stEditTransfer: 'Edit transfer {no}', stFromGodown: 'From godown', stToGodown: 'To godown',
  stFromTo: 'From / to', stAddItemPh: 'Search item to move', stMoveQty: 'Qty to move', stTransferValue: 'Value',
  stTransferSaved: 'Transfer {no} saved', stNoTransfers: 'No stock transfers', stNoTransfersText: 'Move stock from one godown to another with New transfer.',

  // godown summary report
  stGodownSummary: 'Godown summary', stGodownsCount: 'Godowns', stNegativeItems: 'Items below zero', stByGodown: 'By godown',
  stByCategory: 'Stock value by category', stTotalUnits: 'Units', stShare: 'Share',

  // bill of materials
  stBomTitle: 'Bill of materials', stBomHint: 'Materials used to make 1 {unit} of this item. Making it takes them out of stock.',
  stMaterial: 'Material', stQtyPerUnit: 'Qty per 1 {unit}', stCostEach: 'Cost', stBomCost: 'Material cost of 1 {unit}',
  stAddMaterial: 'Search material to add', stErrBomSelf: 'An item cannot be made from itself.',

  // manufacturing
  stMfgSub: 'Make finished goods from raw materials and see what each unit costs',
  stMfgOffTitle: 'Manufacturing is turned off',
  stMfgOffText: 'Turn on "Manufacturing" in Settings, Features to make items from raw materials with a bill of materials.',
  stMakeItems: 'Make items', stEditMake: 'Edit {no}', stMake: 'Make', stItemMade: 'Item made', stPickItemMade: 'Search the item you made',
  stQtyMade: 'Qty made', stWithBom: 'Items with a bill of materials', stNoBom: 'This item has no bill of materials. Add the materials used below, or add a bill of materials to the item.',
  stMakeGodownHint: 'Materials are taken from here and the finished goods are kept here.',
  stMaterialsUsed: 'Materials used', stUseQty: 'Qty used', stRefill: 'Fill again from the bill of materials',
  stCharges: 'Making charges', stChargesHint: 'Labour, electricity or job work paid for this batch.', stPaidFrom: 'Paid from',
  stCostPreview: 'Cost', stMaterialsCost: 'Materials cost', stTotalCost: 'Total cost', stUnitCost: 'Cost per unit',
  stUnitCostOf: 'Cost of 1 {unit}', stSaleVsCost: 'Sale price is {price}', stErrNoMaterials: 'Add the materials used.',
  stMadeSaved: '{no} saved: {qty} {name} made', stNoMade: 'Nothing made yet', stNoMadeText: 'Use Make items to record a production batch.',
  stBoms: 'Bills of materials', stMaterials: 'Materials', stBomCostShort: 'Material cost', stCanMake: 'Can make now',
  stNoBoms: 'No bills of materials yet', stNoBomsText: 'Edit a finished item and add the materials used to make 1 unit.',
  stRegister: 'Production register', stEntries: 'Entries', stByItemMade: 'By item made', stAvgUnitCost: 'Avg cost per unit',

  // catalogue
  ctSub: 'Send a price list to customers: print it or share it on WhatsApp',
  ctOptions: 'Options', ctTitle: 'Title', ctDefaultTitle: 'Price list', ctPriceShown: 'Price shown', ctRetail: 'Retail price',
  ctWholesale: 'Wholesale price', ctNoPrice: 'No price', ctGroup: 'Group by category', ctShowCode: 'Show item code',
  ctShowStock: 'Show stock note', ctShowStockHint: 'Shows "In stock" or "Out of stock", not the quantity.',
  ctShareHint: 'WhatsApp opens with the list as a message. Choose the customer or group to send it to.',
  ctInStockOnly: 'In stock only', ctChosen: '{n} of {total} chosen', ctPrint: 'Print catalogue', ctWhatsApp: 'Share on WhatsApp',
  ctCopyText: 'Copy text', ctCopied: 'Price list copied', ctInStock: 'In stock', ctOutOfStock: 'Out of stock', ctOther: 'Other',
  ctCode: 'Code', ctPer: 'per', ctItemsN: '{n} items',
}

export const ur: Partial<typeof en> = {
  stTurnOn: 'سیٹنگز میں آن کریں', stItem: 'آئٹم', stGodown: 'گودام', stAllGodowns: 'تمام گودام', stMain: 'مرکزی',
  stAvailable: 'موجود', stAvgCost: 'اوسط لاگت', stNoLines: 'ابھی کوئی آئٹم شامل نہیں۔ اوپر تلاش کر کے شامل کریں۔',
  stShort: 'موجود سے زیادہ', stShortTitle: 'کچھ آئٹمز کا اسٹاک کافی نہیں',
  stShortLine: '{name}: چاہیے {need}، موجود {have}', stShortBlocked: 'اسٹاک کافی نہیں۔ آپ کی سیٹنگز صفر سے کم جانے نہیں دیتیں۔',
  stMissingItem: 'حذف شدہ آئٹم', stLines: 'آئٹمز', stDeleteText: 'یہ ری سائیکل بن میں چلا جائے گا اور وہاں سے واپس لایا جا سکتا ہے۔',
  stDeleteEntry: '{no} حذف کریں؟',

  stGodownsSub: 'ہر گودام یا برانچ کا اسٹاک، اور ان کے درمیان مال کی منتقلی',
  stGodownsOffTitle: 'گودام کا فیچر بند ہے',
  stGodownsOffText: 'ایک سے زیادہ جگہ اسٹاک رکھنے اور منتقل کرنے کے لیے سیٹنگز، فیچرز میں "کئی گودام / برانچیں" آن کریں۔',
  stTabStock: 'گودام کے حساب سے اسٹاک', stHideZero: 'صفر اسٹاک چھپائیں', stAddGodown: 'گودام شامل کریں', stEditGodown: 'گودام میں تبدیلی',
  stGodownName: 'گودام / برانچ کا نام', stGodownNamePh: 'مثلاً پچھلا اسٹور، لاہور برانچ', stErrDupGodown: 'اس نام کا گودام پہلے سے موجود ہے۔',
  stItemsInStock: 'اسٹاک والے آئٹمز', stGodownOff: 'گودام غیر فعال ہو گیا', stGodownOn: 'گودام فعال ہو گیا',
  stDeactivateTitle: '{name} غیر فعال کریں؟', stDeactivateStock: 'یہاں ابھی {n} آئٹمز کا اسٹاک موجود ہے۔ ہو سکے تو پہلے اسٹاک منتقل کریں۔',
  stCannotDelete: 'یہ گودام حذف نہیں ہو سکتا', stCannotDeleteText: 'یہ منتقلی، بلوں یا ایڈجسٹمنٹ میں استعمال ہوا ہے۔ اسے غیر فعال کر دیں۔',
  stDeleteGodown: '{name} حذف کریں؟',

  stNewTransfer: 'نئی منتقلی', stEditTransfer: 'منتقلی {no} میں تبدیلی', stFromGodown: 'کس گودام سے', stToGodown: 'کس گودام میں',
  stFromTo: 'سے / میں', stAddItemPh: 'منتقل کرنے والا آئٹم تلاش کریں', stMoveQty: 'منتقل تعداد', stTransferValue: 'مالیت',
  stTransferSaved: 'منتقلی {no} محفوظ ہو گئی', stNoTransfers: 'کوئی اسٹاک منتقلی نہیں', stNoTransfersText: 'نئی منتقلی سے ایک گودام کا مال دوسرے میں بھیجیں۔',

  stGodownSummary: 'گودام کا خلاصہ', stGodownsCount: 'گودام', stNegativeItems: 'صفر سے کم آئٹمز', stByGodown: 'گودام کے حساب سے',
  stByCategory: 'کیٹیگری کے حساب سے اسٹاک کی مالیت', stTotalUnits: 'یونٹس', stShare: 'حصہ',

  stBomTitle: 'خام مال کی فہرست (BOM)', stBomHint: 'اس آئٹم کا 1 {unit} بنانے میں لگنے والا خام مال۔ بنانے پر یہ اسٹاک سے نکل جاتا ہے۔',
  stMaterial: 'خام مال', stQtyPerUnit: 'فی 1 {unit} تعداد', stCostEach: 'لاگت', stBomCost: '1 {unit} کے خام مال کی لاگت',
  stAddMaterial: 'خام مال تلاش کر کے شامل کریں', stErrBomSelf: 'آئٹم خود سے نہیں بن سکتا۔',

  stMfgSub: 'خام مال سے تیار مال بنائیں اور ہر یونٹ کی لاگت دیکھیں',
  stMfgOffTitle: 'تیاری کا فیچر بند ہے',
  stMfgOffText: 'خام مال کی فہرست سے آئٹم بنانے کے لیے سیٹنگز، فیچرز میں "تیاری" آن کریں۔',
  stMakeItems: 'آئٹم بنائیں', stEditMake: '{no} میں تبدیلی', stMake: 'بنائیں', stItemMade: 'تیار آئٹم', stPickItemMade: 'تیار کیا گیا آئٹم تلاش کریں',
  stQtyMade: 'تیار تعداد', stWithBom: 'خام مال کی فہرست والے آئٹمز', stNoBom: 'اس آئٹم کی خام مال کی فہرست نہیں۔ نیچے استعمال شدہ مال شامل کریں، یا آئٹم میں فہرست بنائیں۔',
  stMakeGodownHint: 'خام مال یہیں سے لیا جائے گا اور تیار مال یہیں رکھا جائے گا۔',
  stMaterialsUsed: 'استعمال شدہ خام مال', stUseQty: 'استعمال تعداد', stRefill: 'خام مال کی فہرست سے دوبارہ بھریں',
  stCharges: 'تیاری کے اخراجات', stChargesHint: 'اس بیچ کی مزدوری، بجلی یا جاب ورک۔', stPaidFrom: 'کس اکاؤنٹ سے ادا',
  stCostPreview: 'لاگت', stMaterialsCost: 'خام مال کی لاگت', stTotalCost: 'کل لاگت', stUnitCost: 'فی یونٹ لاگت',
  stUnitCostOf: '1 {unit} کی لاگت', stSaleVsCost: 'فروخت قیمت {price} ہے', stErrNoMaterials: 'استعمال شدہ خام مال شامل کریں۔',
  stMadeSaved: '{no} محفوظ: {qty} {name} تیار', stNoMade: 'ابھی کچھ تیار نہیں ہوا', stNoMadeText: 'تیاری کا بیچ درج کرنے کے لیے آئٹم بنائیں دبائیں۔',
  stBoms: 'خام مال کی فہرستیں', stMaterials: 'خام مال', stBomCostShort: 'خام مال کی لاگت', stCanMake: 'ابھی کتنے بن سکتے ہیں',
  stNoBoms: 'ابھی کوئی خام مال کی فہرست نہیں', stNoBomsText: 'تیار آئٹم میں تبدیلی کر کے 1 یونٹ کا خام مال شامل کریں۔',
  stRegister: 'پیداوار رجسٹر', stEntries: 'اندراجات', stByItemMade: 'تیار آئٹم کے حساب سے', stAvgUnitCost: 'اوسط فی یونٹ لاگت',

  ctSub: 'گاہکوں کو ریٹ لسٹ بھیجیں: پرنٹ کریں یا واٹس ایپ پر شیئر کریں',
  ctOptions: 'انتخاب', ctTitle: 'عنوان', ctDefaultTitle: 'ریٹ لسٹ', ctPriceShown: 'کون سی قیمت دکھائیں', ctRetail: 'پرچون قیمت',
  ctWholesale: 'ہول سیل قیمت', ctNoPrice: 'قیمت نہیں', ctGroup: 'کیٹیگری کے حساب سے', ctShowCode: 'آئٹم کوڈ دکھائیں',
  ctShowStock: 'اسٹاک کا نوٹ دکھائیں', ctShowStockHint: '"اسٹاک میں موجود" یا "اسٹاک ختم" دکھائے گا، تعداد نہیں۔',
  ctShareHint: 'واٹس ایپ لسٹ کے پیغام کے ساتھ کھلے گا۔ جس گاہک یا گروپ کو بھیجنا ہو اسے چنیں۔',
  ctInStockOnly: 'صرف موجود اسٹاک', ctChosen: '{total} میں سے {n} منتخب', ctPrint: 'کیٹلاگ پرنٹ کریں', ctWhatsApp: 'واٹس ایپ پر شیئر کریں',
  ctCopyText: 'متن کاپی کریں', ctCopied: 'ریٹ لسٹ کاپی ہو گئی', ctInStock: 'اسٹاک میں موجود', ctOutOfStock: 'اسٹاک ختم', ctOther: 'دیگر',
  ctCode: 'کوڈ', ctPer: 'فی', ctItemsN: '{n} آئٹمز',
}
