/**
 * Styles of printed documents. Plain hex colours on purpose: the app's dark theme remaps
 * Tailwind colours on screen, and the on-screen preview must look like paper.
 * Logical properties keep Urdu (RTL) layouts right.
 */
export const DOC_CSS = `
.sdoc { --acc: #0f766e; color: #1c1917; background: #fff; font-size: 12px; line-height: 1.45; margin-inline: auto;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sdoc * { box-sizing: border-box; }
.sdoc p, .sdoc h1, .sdoc h2, .sdoc h3, .sdoc h4 { margin: 0; }
.sdoc .num { font-family: "Inter", ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; }
.sdoc .muted { color: #57534e; }
.sdoc .small { font-size: 0.85em; }
.sdoc .b { font-weight: 700; }
.sdoc .r { text-align: end; }
.sdoc .c { text-align: center; }
.sdoc .acc { color: var(--acc); }
.sdoc tr { break-inside: avoid; }

.sdoc.sheet { width: 100%; max-width: 190mm; }
.sdoc.sheet.a5 { max-width: 128mm; font-size: 10px; }
.sdoc .hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  border-bottom: 3px solid var(--acc); padding-bottom: 10px; margin-bottom: 12px; }
.sdoc .firm { display: flex; gap: 12px; align-items: flex-start; min-width: 0; }
.sdoc .logo { max-height: 64px; max-width: 110px; object-fit: contain; }
.sdoc .firm-name { font-size: 1.65em; font-weight: 700; color: var(--acc); line-height: 1.2; }
.sdoc .doc-title { font-size: 1.45em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--acc); text-align: end; }
.sdoc .meta { display: grid; grid-template-columns: auto auto; gap: 1px 12px; justify-content: end; margin-top: 4px; }
.sdoc .meta dt { color: #57534e; text-align: end; }
.sdoc .meta dd { margin: 0; font-weight: 600; text-align: end; }
.sdoc .stamp { display: inline-block; border: 2px solid #b91c1c; color: #b91c1c; font-weight: 700; padding: 2px 10px;
  text-transform: uppercase; letter-spacing: 0.1em; margin-top: 6px; }
.sdoc .boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.sdoc .box { border: 1px solid #e7e5e4; border-radius: 6px; padding: 8px 10px; }
.sdoc .box h4, .sdoc .label { font-size: 0.8em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--acc); margin-bottom: 3px; }
.sdoc table { width: 100%; border-collapse: collapse; }
.sdoc table.lines th { background: var(--acc); color: #fff; font-weight: 600; padding: 6px; text-align: start; font-size: 0.92em; white-space: nowrap; }
.sdoc table.lines th.r { text-align: end; }
.sdoc table.lines td { padding: 5px 6px; border-bottom: 1px solid #e7e5e4; vertical-align: top; }
.sdoc table.lines tbody tr:nth-child(even) td { background: #fafaf9; }
.sdoc table.lines tfoot td { font-weight: 700; border-top: 2px solid #d6d3d1; border-bottom: 0; padding: 6px; }
.sdoc .foot { display: grid; grid-template-columns: 1fr minmax(200px, 42%); gap: 16px; margin-top: 12px; align-items: start; }
.sdoc .tot td { padding: 3px 6px; }
.sdoc .tot td:last-child { text-align: end; }
.sdoc .tot .grand td { border-top: 2px solid var(--acc); border-bottom: 2px solid var(--acc); font-weight: 700; font-size: 1.2em; color: var(--acc); padding: 5px 6px; }
.sdoc .tot .due td { font-weight: 700; }
.sdoc .words { font-style: italic; margin-bottom: 8px; }
.sdoc .terms { white-space: pre-line; }
.sdoc .sign { margin-top: 44px; display: flex; justify-content: space-between; gap: 24px; }
.sdoc .sign > div { border-top: 1px solid #57534e; padding-top: 4px; min-width: 150px; text-align: center; }
.sdoc .sign .spacer { border: 0; }
.sdoc .footer-note { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e7e5e4; text-align: center; color: #57534e; }

.sdoc .voucher-amt { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 2px solid var(--acc);
  border-radius: 8px; padding: 10px 14px; margin: 12px 0; }
.sdoc .voucher-amt .v { font-size: 1.9em; font-weight: 700; color: var(--acc); }
.sdoc .kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
.sdoc .kv dt { color: #57534e; }
.sdoc .kv dd { margin: 0; font-weight: 600; border-bottom: 1px dotted #a8a29e; }

.sdoc.thermal { width: 72mm; font-size: 11.5px; color: #000; line-height: 1.35; }
.sdoc.thermal.t58 { width: 48mm; font-size: 10px; }
.sdoc.thermal .row { display: flex; justify-content: space-between; gap: 8px; }
.sdoc.thermal .row > :last-child { text-align: end; white-space: nowrap; }
.sdoc.thermal hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
.sdoc.thermal .big { font-size: 1.35em; font-weight: 700; }
.sdoc.thermal .item { margin-bottom: 3px; }
.sdoc.thermal .logo { max-height: 40px; display: block; margin: 0 auto 4px; filter: grayscale(1); }

/* ---- invoice designs (settings.invoiceTheme); classic is the base above ---- */
/* modern: colour band header with the logo at the start, light table */
.sdoc.th-modern .hd { background: var(--acc); color: #fff; border-bottom: 0; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
.sdoc.th-modern .hd .muted, .sdoc.th-modern .hd .meta dt { color: rgba(255, 255, 255, 0.85); }
.sdoc.th-modern .firm-name, .sdoc.th-modern .doc-title { color: #fff; }
.sdoc.th-modern .logo { background: #fff; border-radius: 6px; padding: 4px; }
.sdoc.th-modern .stamp { border-color: #fff; color: #fff; }
.sdoc.th-modern .box { border: 0; background: #f5f5f4; }
.sdoc.th-modern table.lines th { background: color-mix(in srgb, var(--acc) 10%, #fff); color: var(--acc); border-bottom: 2px solid var(--acc); }
.sdoc.th-modern table.lines tbody tr:nth-child(even) td { background: transparent; }
.sdoc.th-modern table.lines td { border-bottom-color: #f0efee; }
.sdoc.th-modern .tot .grand td { border: 0; background: color-mix(in srgb, var(--acc) 10%, #fff); border-radius: 4px; }

/* compact: dense, small type for long invoices */
.sdoc.th-compact { font-size: 10px; line-height: 1.3; }
.sdoc.th-compact.a5 { font-size: 8.5px; }
.sdoc.th-compact .hd { border-bottom-width: 2px; padding-bottom: 6px; margin-bottom: 8px; }
.sdoc.th-compact .logo { max-height: 40px; max-width: 80px; }
.sdoc.th-compact .firm-name { font-size: 1.4em; }
.sdoc.th-compact .doc-title { font-size: 1.2em; }
.sdoc.th-compact .boxes { gap: 8px; margin-bottom: 8px; }
.sdoc.th-compact .box { padding: 4px 8px; }
.sdoc.th-compact table.lines th { padding: 3px 4px; }
.sdoc.th-compact table.lines td { padding: 2px 4px; }
.sdoc.th-compact table.lines tbody tr:nth-child(even) td { background: transparent; }
.sdoc.th-compact .foot { margin-top: 8px; gap: 10px; }
.sdoc.th-compact .tot td { padding: 1px 4px; }
.sdoc.th-compact .sign { margin-top: 26px; }
.sdoc.th-compact .footer-note { margin-top: 8px; padding-top: 4px; }

/* bold: big title, dark table head, strong totals block */
.sdoc.th-bold .hd { border-bottom-width: 6px; }
.sdoc.th-bold .firm-name { color: #1c1917; font-size: 1.85em; }
.sdoc.th-bold .doc-title { font-size: 2.5em; line-height: 1.05; letter-spacing: 0.01em; }
.sdoc.th-bold table.lines th { background: #1c1917; }
.sdoc.th-bold table.tot { border: 2px solid var(--acc); border-collapse: separate; border-spacing: 0; border-radius: 8px; overflow: hidden; }
.sdoc.th-bold .tot td { padding: 4px 8px; }
.sdoc.th-bold .tot .grand td { background: var(--acc); color: #fff; border: 0; font-size: 1.45em; padding: 8px; }
.sdoc.th-bold .tot .due td { font-size: 1.15em; color: #b91c1c; }
.sdoc.th-bold .voucher-amt { background: var(--acc); color: #fff; }
.sdoc.th-bold .voucher-amt .v, .sdoc.th-bold .voucher-amt .label { color: #fff; }

@media print {
  .sdoc.sheet, .sdoc.sheet.a5 { max-width: none; }
  .sdoc.thermal { width: 100%; }
}
`
