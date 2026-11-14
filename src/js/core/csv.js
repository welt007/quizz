/**
 * Minimal RFC 4180 CSV parser.
 * - strips a UTF-8 BOM
 * - accepts \n, \r\n and \r line endings
 * - auto-detects "," or ";" as delimiter (from the header line) unless given
 * - supports quoted fields with embedded delimiters, quotes ("") and newlines
 *
 * Returns an array of rows, each row an array of strings. Each row carries a
 * non-enumerable `line` property with its 1-based starting line number.
 */
export function parseCsv(text, { delimiter } = {}) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = delimiter ?? detectDelimiter(text);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // skip completely empty lines
    if (!(row.length === 1 && row[0] === '')) {
      Object.defineProperty(row, 'line', { value: rowStartLine, enumerable: false });
      rows.push(row);
    }
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      i++;
    } else if (ch === delim) {
      pushField();
      i++;
    } else if (ch === '\r' || ch === '\n') {
      pushRow();
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
      line++;
      rowStartLine = line;
    } else {
      field += ch;
      i++;
    }
  }
  if (inQuotes) {
    throw new CsvError(`Nicht geschlossenes Anführungszeichen (ab Zeile ${rowStartLine})`, rowStartLine);
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

/** Picks ";" if the first line contains more semicolons than commas (outside quotes). */
export function detectDelimiter(text) {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

/** Parses CSV with a header row into objects keyed by (trimmed, lower-cased) header names. */
export function parseCsvObjects(text, options) {
  const rows = parseCsv(text, options);
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const records = rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((key, idx) => {
      if (key) obj[key] = (r[idx] ?? '').trim();
    });
    Object.defineProperty(obj, 'line', { value: r.line, enumerable: false });
    // more fields than header columns → usually an unquoted delimiter inside a text
    const extra = r.slice(header.length).filter((v) => v.trim() !== '').length;
    Object.defineProperty(obj, 'extraFields', { value: extra, enumerable: false });
    return obj;
  });
  return { header, records };
}

export class CsvError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'CsvError';
    this.line = line;
  }
}
