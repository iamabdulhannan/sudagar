/** download rows as a CSV file that opens in Excel (UTF-8 with BOM so Urdu shows correctly) */
export function downloadCsv(filename: string, header: string[], rows: (string | number | undefined | null)[][]) {
  const esc = (v: string | number | undefined | null) => {
    // drop bidi isolate marks added for Urdu screens
    const s = v === undefined || v === null ? '' : String(v).replace(/[\u2066-\u2069]/g, '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const text = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  downloadBlob(filename.endsWith('.csv') ? filename : filename + '.csv', new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** parse a simple CSV (quoted fields allowed) into rows of strings */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}
