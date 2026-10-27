/** name of a statement row: a document type, or the opening balance */
export function docLabel(kind: string, t: (k: string) => string): string {
  if (kind === 'opening') return t('pt_openingBalance')
  if (kind === 'adjustment') return t('la_stock_adjust')
  return t('tt_' + kind)
}
