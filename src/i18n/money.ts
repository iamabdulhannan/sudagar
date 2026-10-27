/** words used by the money module: cheques, loans and the recycle bin */
export const en = {
  // cheque states
  chq_open_in: 'In hand', chq_open_out: 'Issued', chq_cleared: 'Cleared', chq_bounced: 'Bounced',

  // cheques page
  chqSubtitle: 'Cheques received and issued that have not cleared yet',
  chqNewReceived: 'Receive by cheque', chqNewIssued: 'Pay by cheque',
  chqInHandTotal: 'Cheques in hand', chqIssuedTotal: 'Issued, not cleared', chqCount: '{n} cheques',
  chqNone: 'No cheques yet', chqNoneText: 'Record a payment in or out with the mode Cheque and it will be tracked here until it clears.',
  chqReceived: 'Received', chqIssued: 'Issued', chqNoMatch: 'No cheques with this status.',
  chqAge: 'Age', chqPostDated: 'Post-dated', chqDays: '{n} days',
  chqClear: 'Clear', chqBounce: 'Bounce', chqReopen: 'Reopen',
  chqClearedToast: 'Cheque {no} cleared', chqBouncedToast: 'Cheque {no} marked as bounced', chqReopenedToast: 'Cheque {no} is open again',
  chqBounceQ: 'Mark cheque {no} as bounced?',
  chqBounceTextIn: 'The payment will no longer count, so {amount} comes back on the balance of {party}.',
  chqBounceTextOut: 'The payment will no longer count, so you owe {party} {amount} again.',
  chqClearTitle: 'Clear cheque {no}', chqClearTextIn: 'Cheque deposited and credited to the account:', chqClearTextOut: 'Cheque paid by the bank:',
  chqDepositedIn: 'Cleared into', chqPaidFrom: 'Paid from account',

  // loans
  ln_add: 'Add loan account', ln_subtitle: 'Money borrowed from banks or people, and what is still owed',
  ln_none: 'No loans', ln_noneText: 'Add a loan account for money you borrowed. Its opening balance is the amount you owe.',
  ln_totalOwed: 'Total owed', ln_count: '{n} loans', ln_repaid: 'Repaid', ln_interestPaid: 'Interest paid', ln_paidOff: 'Paid off',
  ln_taken: 'Taken', ln_receive: 'Receive loan money', ln_payInstalment: 'Pay instalment', ln_statement: 'Statement',
  ln_receiveTitle: 'Receive money from {name}', ln_receiveHint: 'Adds the money to your account and to the amount owed.',
  ln_receivedIn: 'Received in', ln_interestHead: 'Loan interest', ln_instalmentSaved: 'Instalment saved',
  ln_instalmentTitle: 'Pay instalment: {name}', ln_owedNow: 'Owed now',
  ln_principal: 'Principal', ln_principalHint: 'Reduces the amount owed', ln_interest: 'Interest',
  ln_interestHint: 'Saved as an expense under Loan interest', ln_paidFrom: 'Paid from', ln_overOwed: 'This is more than is owed.',

  // recycle bin
  binSubtitle: 'Deleted transactions stay here until you restore them or delete them forever.',
  binNone: 'The recycle bin is empty', binNoneText: 'Deleted invoices, bills and payments appear here.',
  binDeletedAt: 'Deleted', binRestore: 'Restore', binRestored: '{name} restored',
  binDeleteForever: 'Delete forever', binDeleteQ: 'Delete {name} forever?',
  binEmpty: 'Empty bin', binEmptyQ: 'Empty the recycle bin ({n} entries)?', binEmptied: 'Recycle bin emptied',
}

export const ur: Partial<typeof en> = {
  chq_open_in: 'ہاتھ میں', chq_open_out: 'جاری شدہ', chq_cleared: 'کلیئر', chq_bounced: 'باؤنس',

  chqSubtitle: 'وصول اور جاری کیے گئے چیک جو ابھی کلیئر نہیں ہوئے',
  chqNewReceived: 'چیک سے وصولی', chqNewIssued: 'چیک سے ادائیگی',
  chqInHandTotal: 'ہاتھ میں چیک', chqIssuedTotal: 'جاری شدہ، کلیئر نہیں', chqCount: '{n} چیک',
  chqNone: 'ابھی کوئی چیک نہیں', chqNoneText: 'وصولی یا ادائیگی میں طریقہ چیک منتخب کریں، کلیئر ہونے تک یہاں نظر آئے گا۔',
  chqReceived: 'وصول شدہ', chqIssued: 'جاری شدہ', chqNoMatch: 'اس حالت کا کوئی چیک نہیں۔',
  chqAge: 'مدت', chqPostDated: 'آئندہ تاریخ کا', chqDays: '{n} دن',
  chqClear: 'کلیئر کریں', chqBounce: 'باؤنس', chqReopen: 'دوبارہ کھولیں',
  chqClearedToast: 'چیک {no} کلیئر ہو گیا', chqBouncedToast: 'چیک {no} باؤنس درج ہو گیا', chqReopenedToast: 'چیک {no} دوبارہ کھل گیا',
  chqBounceQ: 'چیک {no} باؤنس درج کریں؟',
  chqBounceTextIn: 'یہ وصولی شمار نہیں ہو گی، اس لیے {amount} دوبارہ {party} کے بیلنس میں آ جائیں گے۔',
  chqBounceTextOut: 'یہ ادائیگی شمار نہیں ہو گی، اس لیے آپ کو {party} کے {amount} دوبارہ دینے ہیں۔',
  chqClearTitle: 'چیک {no} کلیئر کریں', chqClearTextIn: 'چیک جمع ہو کر اکاؤنٹ میں آ گیا:', chqClearTextOut: 'بینک نے چیک کی ادائیگی کر دی:',
  chqDepositedIn: 'اس اکاؤنٹ میں کلیئر', chqPaidFrom: 'اس اکاؤنٹ سے ادا',

  ln_add: 'قرض اکاؤنٹ شامل کریں', ln_subtitle: 'بینکوں یا لوگوں سے لیا گیا قرض اور باقی رقم',
  ln_none: 'کوئی قرض نہیں', ln_noneText: 'لیے گئے قرض کے لیے قرض اکاؤنٹ بنائیں۔ اس کا ابتدائی بیلنس آپ کے ذمے رقم ہے۔',
  ln_totalOwed: 'کل واجب الادا', ln_count: '{n} قرضے', ln_repaid: 'واپس کیا', ln_interestPaid: 'ادا شدہ سود', ln_paidOff: 'ادا ہو چکا',
  ln_taken: 'لیا گیا', ln_receive: 'قرض کی رقم وصول کریں', ln_payInstalment: 'قسط ادا کریں', ln_statement: 'کھاتہ',
  ln_receiveTitle: '{name} سے رقم وصول کریں', ln_receiveHint: 'رقم آپ کے اکاؤنٹ میں اور واجب الادا قرض میں شامل ہو جائے گی۔',
  ln_receivedIn: 'اس اکاؤنٹ میں وصول', ln_interestHead: 'قرض پر سود', ln_instalmentSaved: 'قسط محفوظ ہو گئی',
  ln_instalmentTitle: 'قسط ادا کریں: {name}', ln_owedNow: 'ابھی واجب الادا',
  ln_principal: 'اصل رقم', ln_principalHint: 'واجب الادا قرض کم کرتی ہے', ln_interest: 'سود',
  ln_interestHint: 'قرض پر سود کی مد میں خرچہ درج ہو گا', ln_paidFrom: 'اس اکاؤنٹ سے ادا', ln_overOwed: 'یہ واجب الادا رقم سے زیادہ ہے۔',

  binSubtitle: 'حذف شدہ اندراجات یہاں رہتے ہیں جب تک آپ انہیں واپس نہ لائیں یا ہمیشہ کے لیے حذف نہ کریں۔',
  binNone: 'ری سائیکل بن خالی ہے', binNoneText: 'حذف کی گئی انوائسز، بل اور ادائیگیاں یہاں نظر آئیں گی۔',
  binDeletedAt: 'حذف کیا گیا', binRestore: 'واپس لائیں', binRestored: '{name} واپس آ گیا',
  binDeleteForever: 'ہمیشہ کے لیے حذف', binDeleteQ: '{name} ہمیشہ کے لیے حذف کریں؟',
  binEmpty: 'بن خالی کریں', binEmptyQ: 'ری سائیکل بن خالی کریں ({n} اندراجات)؟', binEmptied: 'ری سائیکل بن خالی ہو گیا',
}
