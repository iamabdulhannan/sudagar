/** words used by the txn module (lists, forms, view, printed documents, WhatsApp) */
export const en = {
  // list
  txNewOf: 'New {name}', txEditOf: 'Edit {name} {number}', txFromDoc: 'From {name}',
  txCount: 'Documents', txCountIn: '{n} documents', txOpenValue: 'Open value', txOverdueCount: '{n} overdue',
  txOtherModes: 'Bank, cheque and others', txSearchPh: 'Search number, party, item or ref no',
  txAnyStatus: 'Any status', txAllParties: 'All parties', txAllHeads: 'All expense heads', txAllIncomeHeads: 'All income heads',
  txNoneYet: 'No {name} yet', txNoneYetText: 'Create the first one. It takes a few seconds.',
  txNoMatch: 'Nothing matches these filters. Try another period or clear the search.',
  txParty: 'Party', txView: 'View', txDue: 'Due', txWhatsApp: 'WhatsApp',

  // columns and fields
  txNumber: 'Number', txNumberHint: 'Given automatically when you save', txDueDate: 'Due date', txRefNo: 'Ref / PO no.',
  txSupplierBillNo: 'Supplier bill no.', txAgainstInvoice: 'Against invoice', txBillNo: 'Bill / receipt no.',
  txExpenseHead: 'Expense head', txIncomeHead: 'Income head', txAccount: 'Account', txMode: 'Payment mode',
  txChequeRef: 'Cheque / ref no.', txFromAccount: 'From account', txToAccount: 'To account',
  txCustomer: 'Customer', txSupplier: 'Supplier', txWalkInName: 'Customer name (optional)',
  txShipTo: 'Ship to', txShipToPh: 'Delivery address, if different', txNotesPh: 'Shown on the printed document',
  txReceived: 'Received', txRefunded: 'Refunded', txRefundReceived: 'Refund received',
  txReceivedNow: 'Received now', txPaidNow: 'Paid now', txRefundedNow: 'Refunded now',
  txBalanceDue: 'Balance due', txFullPayment: 'Full payment', txWalkInPaid: 'Without a party it is paid in full',

  // lines
  txItems: 'Items', txItemName: 'Item', txDescription: 'Description', txAddItemPh: 'Search or scan an item to add it',
  txAddFreeLine: 'Free-text line', txAddLine: 'Add line', txRemoveLine: 'Remove line', txNoLinesYet: 'Search above or scan a barcode to add items.',
  txExpenseItemPh: 'What was it for?', txInStock: 'In stock', txInclTax: 'incl. tax',
  txDiscount: 'Discount', txDiscountPct: 'Discount %', txTax: 'Tax', txTaxPct: 'Tax %',
  txBatch: 'Batch', txExpiry: 'Expiry', txSerial: 'Serial / IMEI', txSerialPh: 'Serial or IMEI',

  // totals
  txSubtotal: 'Subtotal', txSubtotalExTax: 'Subtotal (before tax)', txCharges: 'Delivery / packing', txRoundOff: 'Round off', txGrandTotal: 'Grand total',

  // expense / income / payments / transfer
  txAddHead: 'Add a new head', txHeadPh: 'e.g. Shop rent', txIncomeHeadPh: 'e.g. Commission',
  txItemised: 'Itemised expense', txItemisedHint: 'List each thing bought instead of one amount',
  txPaidToParty: 'Paid to', txReceivedFromParty: 'Received from',
  txFullBalance: 'Full balance: {amount}', txAdvanceIn: '{amount} more than the balance will be kept as advance.',
  txAdvanceOut: '{amount} more than the balance will be kept as advance to the supplier.',
  txOpenInvoices: 'Unpaid invoices', txNoOpenInvoices: 'No unpaid invoices for this party.', txSettles: 'This payment',
  txDuesAfterThis: 'Dues shown already include this payment.',
  txTransferOver: 'This is more than the account has ({amount}).', txBalances: 'Account balances',

  // warnings
  txStockWarn: 'You can still save.', txStockBlocked: 'Reduce the quantity or add stock first.',
  txCreditOver: 'Credit limit {limit} will be crossed. Balance after this sale: {balance}.',
  txCurrentBalance: 'Balance', txCreditLimit: 'Credit limit', txPartyLedger: 'Ledger',

  // saving
  txSavePrint: 'Save & print', txSavedToast: '{name} saved', txShortcuts: 'Ctrl+S save, Ctrl+Enter save & new, Esc back',
  txDiscardQ: 'Discard changes?', txDiscardText: 'What you entered on this form will be lost.', txDiscard: 'Discard',
  txNotFound: 'Document not found', txNotFoundText: 'It may have been deleted.',

  // view
  txPrintSize: 'Print size', txConvert: 'Convert', txConvertTo: 'Convert to {name}', txMakeReturn: 'Make return',
  txReceivePayment: 'Receive payment', txMakePayment: 'Make payment',
  txCancelDoc: 'Cancel document', txCancelQ: 'Cancel {name}?', txCancelText: 'It keeps its number but no longer counts in stock or accounts.',
  txCancelledToast: '{name} cancelled', txCancelledNote: 'Cancelled: it has no effect on stock or accounts.',
  txDeleteQ: 'Delete {name}?',
  txSummary: 'Summary', txLinked: 'Linked documents', txConvertedFrom: 'Converted from', txConvertedTo: 'Converted to', txReturns: 'Returns',
  txHistory: 'History', txCreatedAt: 'Created', txUpdatedAt: 'Last changed',
  au_create: 'Created', au_update: 'Changed', au_cancel: 'Cancelled', au_delete: 'Deleted',

  // printed documents
  dt_taxInvoice: 'Tax Invoice', dt_sale: 'Sale Invoice', dt_sale_return: 'Credit Note', dt_estimate: 'Quotation',
  dt_sale_order: 'Sale Order', dt_delivery_challan: 'Delivery Challan', dt_purchase: 'Purchase Bill', dt_purchase_return: 'Debit Note',
  dt_purchase_order: 'Purchase Order', dt_payment_in: 'Payment Receipt', dt_payment_out: 'Payment Voucher', dt_expense: 'Expense Voucher',
  dt_other_income: 'Income Receipt', dt_transfer: 'Transfer Voucher',
  prNumber: 'No.', prBillTo: 'Bill to', prSupplier: 'Supplier', prCustomer: 'Customer', prItem: 'Item', prMrp: 'MRP',
  prAmountInWords: 'Amount in words', prPartyBalance: 'Party balance', prForFirm: 'For {name}', prAuthSign: 'Authorised signatory',
  prReceivedBy: 'Received by', prReceivedFrom: 'Received from', prPaidTo: 'Paid to', prReceivedIn: 'Received in',
  prThanks: 'Thank you! Please visit again.', prEstimateNote: 'This is a quotation, not a bill. Prices are valid for a limited time.',

  // WhatsApp
  waDear: 'Dear {name},', waItems: 'Items', waThanks: 'Thank you for your business!',

  // split payments, change, cheques
  txSplitPayment: 'Split payment', txSplitHint: 'Paid now: {amount}. Whatever is not allocated stays as balance due.',
  txAddPaymentRow: 'Add payment', txFillRest: 'Fill rest', txRefShort: 'Ref no.', txAllocated: 'Allocated',
  txRemaining: 'Remaining', txOverAllocated: 'More than the total by', txCashGiven: 'Cash given', txChange: 'Change',
  txChequeNo: 'Cheque no.', txChequeDate: 'Cheque date', txChequeStatus: 'Cheque status', txChequeUntracked: 'Not tracked',
  txChequeClearedNow: 'Cleared now', txClearedOn: 'Cleared on', txManageCheques: 'Open the cheques list',
  txChequeOpenHintIn: 'Counts as a cheque in hand until it clears into the account.',
  txChequeOpenHintOut: 'Stays as an issued cheque until the bank pays it.',

  // owner money
  txCapitalHint: 'Money the owner puts into the business. It adds to capital, not to profit.',
  txDrawingHint: 'Money the owner takes out for personal use. It reduces capital, not profit.',

  // godowns, last rate, loyalty
  txGodown: 'Godown', txGodownIn: 'Receive into godown',
  txLastSold: 'Last sold to this party at {rate} on {date}', txLastBought: 'Last bought from this party at {rate} on {date}', txApplyRate: 'Use this rate',
  txPointsAvailable: '{n} loyalty points', txPointsWorth: 'Worth {amount}', txRedeemPoints: 'Redeem points', txRedeemMax: 'Use {n}',
  txPointsApplied: '{n} points take {amount} off this bill.', txPointsDiscount: 'Loyalty points ({n})', txPointsRedeemed: 'Points redeemed',

  // stock transfer and manufacturing
  txFromGodown: 'From godown', txToGodown: 'To godown', txLinesCount: 'Items', txItemMade: 'Item made', txQtyMade: 'Quantity made',
  txMaterials: 'Materials used', txMaterialsCost: 'Cost of materials', txMakingCharges: 'Making charges', txTotalCost: 'Total cost',
  txUnitCost: 'Cost per unit', txCostRate: 'Cost rate',

  // recycle bin
  txDeleteToBin: 'It moves to the recycle bin, where you can restore it.', txMovedToBin: 'Moved to the recycle bin', au_restore: 'Restored',

  dt_capital_in: 'Capital Receipt', dt_drawing: 'Drawing Voucher', dt_stock_transfer: 'Stock Transfer Note', dt_manufacture: 'Production Note',
  prPointsIncl: 'incl. {n} loyalty points', prFromOwner: 'From owner', prTakenBy: 'Taken by', prPaidFrom: 'Paid from',
}

export const ur: Partial<typeof en> = {
  txNewOf: 'نیا {name}', txEditOf: '{name} {number} تبدیل کریں', txFromDoc: '{name} سے',
  txCount: 'دستاویزات', txCountIn: '{n} دستاویزات', txOpenValue: 'کھلی مالیت', txOverdueCount: '{n} کی تاریخ گزر گئی',
  txOtherModes: 'بینک، چیک اور دیگر', txSearchPh: 'نمبر، پارٹی، آئٹم یا ریفرنس سے تلاش کریں',
  txAnyStatus: 'کوئی بھی حالت', txAllParties: 'تمام پارٹیاں', txAllHeads: 'تمام خرچے کی مدیں', txAllIncomeHeads: 'تمام آمدنی کی مدیں',
  txNoneYet: 'ابھی کوئی {name} نہیں', txNoneYetText: 'پہلا بنائیں، چند سیکنڈ لگیں گے۔',
  txNoMatch: 'ان فلٹرز سے کچھ نہیں ملا۔ دوسرا عرصہ منتخب کریں یا تلاش صاف کریں۔',
  txParty: 'پارٹی', txView: 'دیکھیں', txDue: 'باقی', txWhatsApp: 'واٹس ایپ',

  txNumber: 'نمبر', txNumberHint: 'محفوظ کرنے پر خود لگ جائے گا', txDueDate: 'آخری تاریخ', txRefNo: 'ریفرنس / آرڈر نمبر',
  txSupplierBillNo: 'سپلائر بل نمبر', txAgainstInvoice: 'متعلقہ انوائس', txBillNo: 'بل / رسید نمبر',
  txExpenseHead: 'خرچے کی مد', txIncomeHead: 'آمدنی کی مد', txAccount: 'اکاؤنٹ', txMode: 'ادائیگی کا طریقہ',
  txChequeRef: 'چیک / ریفرنس نمبر', txFromAccount: 'اس اکاؤنٹ سے', txToAccount: 'اس اکاؤنٹ میں',
  txCustomer: 'گاہک', txSupplier: 'سپلائر', txWalkInName: 'گاہک کا نام (اختیاری)',
  txShipTo: 'ترسیل کا پتہ', txShipToPh: 'ڈلیوری کا پتہ، اگر مختلف ہو', txNotesPh: 'پرنٹ شدہ دستاویز پر نظر آئے گا',
  txReceived: 'وصول شدہ', txRefunded: 'واپس کیے', txRefundReceived: 'واپسی وصول',
  txReceivedNow: 'ابھی وصول', txPaidNow: 'ابھی ادا', txRefundedNow: 'ابھی واپس کیے',
  txBalanceDue: 'باقی رقم', txFullPayment: 'پوری ادائیگی', txWalkInPaid: 'پارٹی کے بغیر پوری رقم ادا ہوتی ہے',

  txItems: 'آئٹمز', txItemName: 'آئٹم', txDescription: 'تفصیل', txAddItemPh: 'آئٹم تلاش کریں یا بارکوڈ اسکین کریں',
  txAddFreeLine: 'سادہ لائن', txAddLine: 'لائن شامل کریں', txRemoveLine: 'لائن ہٹائیں', txNoLinesYet: 'اوپر تلاش کریں یا بارکوڈ اسکین کر کے آئٹمز شامل کریں۔',
  txExpenseItemPh: 'کس چیز کے لیے؟', txInStock: 'اسٹاک میں', txInclTax: 'ٹیکس شامل',
  txDiscount: 'رعایت', txDiscountPct: 'رعایت %', txTax: 'ٹیکس', txTaxPct: 'ٹیکس %',
  txBatch: 'بیچ', txExpiry: 'ایکسپائری', txSerial: 'سیریل / IMEI', txSerialPh: 'سیریل یا IMEI',

  txSubtotal: 'ذیلی کل', txSubtotalExTax: 'ذیلی کل (ٹیکس سے پہلے)', txCharges: 'ڈلیوری / پیکنگ', txRoundOff: 'راؤنڈ آف', txGrandTotal: 'کل رقم',

  txAddHead: 'نئی مد شامل کریں', txHeadPh: 'مثلاً دکان کا کرایہ', txIncomeHeadPh: 'مثلاً کمیشن',
  txItemised: 'تفصیلی خرچہ', txItemisedHint: 'ایک رقم کی بجائے ہر چیز الگ لکھیں',
  txPaidToParty: 'کس کو ادا کیا', txReceivedFromParty: 'کس سے وصول کیا',
  txFullBalance: 'پورا بیلنس: {amount}', txAdvanceIn: 'بیلنس سے زائد {amount} ایڈوانس کے طور پر رہیں گے۔',
  txAdvanceOut: 'بیلنس سے زائد {amount} سپلائر کے پاس ایڈوانس رہیں گے۔',
  txOpenInvoices: 'غیر ادا شدہ انوائسز', txNoOpenInvoices: 'اس پارٹی کی کوئی غیر ادا شدہ انوائس نہیں۔', txSettles: 'یہ ادائیگی',
  txDuesAfterThis: 'دکھائی گئی رقوم میں یہ ادائیگی شامل ہے۔',
  txTransferOver: 'یہ اکاؤنٹ میں موجود رقم ({amount}) سے زیادہ ہے۔', txBalances: 'اکاؤنٹس کے بیلنس',

  txStockWarn: 'آپ پھر بھی محفوظ کر سکتے ہیں۔', txStockBlocked: 'تعداد کم کریں یا پہلے اسٹاک شامل کریں۔',
  txCreditOver: 'ادھار کی حد {limit} سے تجاوز ہو جائے گا۔ اس فروخت کے بعد بیلنس: {balance}۔',
  txCurrentBalance: 'بیلنس', txCreditLimit: 'ادھار کی حد', txPartyLedger: 'کھاتہ',

  txSavePrint: 'محفوظ کریں اور پرنٹ', txSavedToast: '{name} محفوظ ہو گیا', txShortcuts: 'Ctrl+S محفوظ، Ctrl+Enter محفوظ اور نیا، Esc واپس',
  txDiscardQ: 'تبدیلیاں ختم کریں؟', txDiscardText: 'اس فارم میں لکھی گئی معلومات ضائع ہو جائیں گی۔', txDiscard: 'ختم کریں',
  txNotFound: 'دستاویز نہیں ملی', txNotFoundText: 'شاید حذف ہو چکی ہے۔',

  txPrintSize: 'پرنٹ سائز', txConvert: 'تبدیل کریں', txConvertTo: '{name} بنائیں', txMakeReturn: 'واپسی بنائیں',
  txReceivePayment: 'رقم وصول کریں', txMakePayment: 'ادائیگی کریں',
  txCancelDoc: 'دستاویز منسوخ کریں', txCancelQ: '{name} منسوخ کریں؟', txCancelText: 'اس کا نمبر برقرار رہے گا مگر اسٹاک اور حساب پر اثر نہیں ہو گا۔',
  txCancelledToast: '{name} منسوخ ہو گیا', txCancelledNote: 'منسوخ: اسٹاک یا حساب پر کوئی اثر نہیں۔',
  txDeleteQ: '{name} حذف کریں؟',
  txSummary: 'خلاصہ', txLinked: 'متعلقہ دستاویزات', txConvertedFrom: 'جس سے بنی', txConvertedTo: 'جس میں تبدیل ہوئی', txReturns: 'واپسیاں',
  txHistory: 'تاریخچہ', txCreatedAt: 'بنائی گئی', txUpdatedAt: 'آخری تبدیلی',
  au_create: 'بنائی گئی', au_update: 'تبدیل کی گئی', au_cancel: 'منسوخ کی گئی', au_delete: 'حذف کی گئی',

  dt_taxInvoice: 'ٹیکس انوائس', dt_sale: 'سیل انوائس', dt_sale_return: 'کریڈٹ نوٹ', dt_estimate: 'کوٹیشن',
  dt_sale_order: 'سیل آرڈر', dt_delivery_challan: 'ڈلیوری چالان', dt_purchase: 'خریداری بل', dt_purchase_return: 'ڈیبٹ نوٹ',
  dt_purchase_order: 'پرچیز آرڈر', dt_payment_in: 'وصولی رسید', dt_payment_out: 'ادائیگی واؤچر', dt_expense: 'خرچہ واؤچر',
  dt_other_income: 'آمدنی رسید', dt_transfer: 'منتقلی واؤچر',
  prNumber: 'نمبر', prBillTo: 'بنام', prSupplier: 'سپلائر', prCustomer: 'گاہک', prItem: 'آئٹم', prMrp: 'MRP',
  prAmountInWords: 'رقم الفاظ میں', prPartyBalance: 'پارٹی کا بیلنس', prForFirm: 'منجانب {name}', prAuthSign: 'مجاز دستخط',
  prReceivedBy: 'وصول کنندہ', prReceivedFrom: 'وصول از', prPaidTo: 'ادا بنام', prReceivedIn: 'وصول اکاؤنٹ',
  prThanks: 'شکریہ! دوبارہ تشریف لائیں۔', prEstimateNote: 'یہ کوٹیشن ہے، بل نہیں۔ قیمتیں محدود مدت کے لیے ہیں۔',

  waDear: 'محترم {name}،', waItems: 'آئٹمز', waThanks: 'آپ کے کاروبار کا شکریہ!',

  txSplitPayment: 'تقسیم ادائیگی', txSplitHint: 'ابھی ادا: {amount}۔ جو رقم تقسیم نہ ہو وہ باقی رقم میں رہے گی۔',
  txAddPaymentRow: 'ادائیگی شامل کریں', txFillRest: 'باقی بھریں', txRefShort: 'ریفرنس نمبر', txAllocated: 'تقسیم شدہ',
  txRemaining: 'باقی', txOverAllocated: 'کل رقم سے زیادہ', txCashGiven: 'دی گئی نقد رقم', txChange: 'واپسی (بقایا)',
  txChequeNo: 'چیک نمبر', txChequeDate: 'چیک کی تاریخ', txChequeStatus: 'چیک کی حالت', txChequeUntracked: 'ٹریک نہیں',
  txChequeClearedNow: 'ابھی کلیئر', txClearedOn: 'کلیئر ہونے کی تاریخ', txManageCheques: 'چیکوں کی فہرست کھولیں',
  txChequeOpenHintIn: 'اکاؤنٹ میں کلیئر ہونے تک ہاتھ میں چیک شمار ہو گا۔',
  txChequeOpenHintOut: 'بینک کی ادائیگی تک جاری شدہ چیک رہے گا۔',

  txCapitalHint: 'مالک کی طرف سے کاروبار میں ڈالی گئی رقم۔ یہ سرمائے میں شامل ہوتی ہے، منافع میں نہیں۔',
  txDrawingHint: 'مالک کی ذاتی استعمال کے لیے نکالی گئی رقم۔ یہ سرمایہ کم کرتی ہے، منافع نہیں۔',

  txGodown: 'گودام', txGodownIn: 'اس گودام میں وصول',
  txLastSold: 'اس پارٹی کو آخری بار {date} کو {rate} میں بیچا', txLastBought: 'اس پارٹی سے آخری بار {date} کو {rate} میں خریدا', txApplyRate: 'یہی ریٹ لگائیں',
  txPointsAvailable: '{n} لائلٹی پوائنٹس', txPointsWorth: 'مالیت {amount}', txRedeemPoints: 'پوائنٹس استعمال کریں', txRedeemMax: '{n} استعمال کریں',
  txPointsApplied: '{n} پوائنٹس سے اس بل میں {amount} کم ہوئے۔', txPointsDiscount: 'لائلٹی پوائنٹس ({n})', txPointsRedeemed: 'استعمال شدہ پوائنٹس',

  txFromGodown: 'اس گودام سے', txToGodown: 'اس گودام میں', txLinesCount: 'آئٹمز', txItemMade: 'تیار شدہ آئٹم', txQtyMade: 'تیار مقدار',
  txMaterials: 'استعمال شدہ خام مال', txMaterialsCost: 'خام مال کی لاگت', txMakingCharges: 'تیاری کے اخراجات', txTotalCost: 'کل لاگت',
  txUnitCost: 'فی یونٹ لاگت', txCostRate: 'لاگت ریٹ',

  txDeleteToBin: 'یہ ری سائیکل بن میں چلا جائے گا، جہاں سے واپس لا سکتے ہیں۔', txMovedToBin: 'ری سائیکل بن میں منتقل ہو گیا', au_restore: 'واپس لایا گیا',

  dt_capital_in: 'سرمایہ رسید', dt_drawing: 'نکاسی واؤچر', dt_stock_transfer: 'اسٹاک منتقلی نوٹ', dt_manufacture: 'تیاری نوٹ',
  prPointsIncl: 'جس میں {n} لائلٹی پوائنٹس شامل', prFromOwner: 'مالک سے', prTakenBy: 'نکالنے والا', prPaidFrom: 'اس اکاؤنٹ سے ادا',
}
