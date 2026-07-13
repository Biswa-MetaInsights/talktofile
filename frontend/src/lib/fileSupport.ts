import type { SessionInfo } from '../types'

// Frontend heuristic for which tool a file supports, by extension. Approximate by design
// (a PDF/DOCX with tables can't be detected here) — see CLAUDE.md. Spreadsheet/tabular files
// support Charts but not Translate; everything else (prose, web pages, JSON, code) supports
// Translate but not Charts.
const TABULAR_EXTS = ['xlsx', 'xls', 'csv']

const extOf = (name: string): string => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''

const isTabular = (name: string): boolean => TABULAR_EXTS.includes(extOf(name))

/** Charts need tabular data — supported when the session has a spreadsheet/CSV file. */
export const chartsSupported = (s: SessionInfo): boolean =>
  s.documents.some((d) => isTabular(d.filename))

/** Translate needs prose — supported when the session has a non-spreadsheet file. */
export const translateSupported = (s: SessionInfo): boolean =>
  s.documents.some((d) => !isTabular(d.filename))
