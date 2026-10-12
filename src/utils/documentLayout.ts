export interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Recover table cells from PDF/OCR coordinates, preserving blank columns. */
export function layoutToRows(words: PositionedText[]): string[][] {
  const lines: { y: number; height: number; words: PositionedText[] }[] = [];
  for (const word of [...words].filter(w => w.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines.find(l => Math.abs(l.y - word.y) <= Math.max(3, Math.min(l.height, word.height) * 0.5));
    if (line) line.words.push(word);
    else lines.push({ y: word.y, height: word.height, words: [word] });
  }
  const merge = (words: PositionedText[], height: number) => {
    const result: PositionedText[] = [];
    for (const word of [...words].sort((a, b) => a.x - b.x)) {
      const previous = result[result.length - 1];
      if (previous && word.x - previous.x - previous.width < Math.max(5, height * 0.7)) {
        previous.text += ' ' + word.text;
        previous.width = Math.max(previous.width, word.x + word.width - previous.x);
      } else result.push({ ...word });
    }
    return result;
  };
  let columns: PositionedText[] | undefined;
  let sizeColumns: PositionedText[] | undefined;
  return lines.map(source => {
    const line = merge(source.words, source.height);
    const sizes = line.filter(c => /^(UNI|XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|\d{1,3}A)$/i.test(c.text));
    if (sizes.length >= 2 && sizes.length === line.length) {
      sizeColumns = sizes;
      return line.map(c => c.text);
    }
    if (sizeColumns && (line.some(c => /^(MULTIPLO|MULTIPLE|RATIO)/i.test(c.text)) || (line.some(c => /^\d+(?:\/\d+)*$/.test(c.text)) && line.some(c => /\b(PZ|PCS|PC|EA)\b/i.test(c.text))))) {
      // CSQ quantities are right aligned. Assign original tokens by their centres
      // before joining nearby words; header starts can put 80 and 190 in one cell.
      const centres = sizeColumns.map(c => c.x + c.width / 2);
      const firstX = centres[0] - (centres[1] - centres[0]) / 2;
      const lastX = centres.at(-1)! + (centres.at(-1)! - centres.at(-2)!) / 2;
      const centre = (c: PositionedText) => c.x + c.width / 2;
      const prefix = merge(source.words.filter(c => centre(c) < firstX), source.height).map(c => c.text);
      const values = sizeColumns.map(() => '');
      const tail: string[] = [];
      for (const cell of source.words.filter(c => centre(c) >= firstX && centre(c) < lastX)) {
        const index = centres.reduce((best, x, i) => Math.abs(x - centre(cell)) < Math.abs(centres[best] - centre(cell)) ? i : best, 0);
        values[index] = [values[index], cell.text].filter(Boolean).join(' ');
      }
      tail.push(...merge(source.words.filter(c => centre(c) >= lastX), source.height).map(c => c.text));
      return [...prefix, ...values, ...tail];
    }
    const isHeader = line.some(c => /^(ITEM|STYLE|CODICE|COD\.?\s*ART|ARTICLE|ARTICOLO|MODEL|SKU|款號|產品編號)/i.test(c.text)) &&
      line.some(c => /^(QTY|Q[.\s]*T[.\s]*[AÀ]|QUANTIT|TOTAL|PRICE|PREZZO|數量|總數|S$|M$|L$|XS$)/i.test(c.text));
    if (isHeader) {
      columns = line;
      return line.map(c => c.text);
    }
    if (!columns) return line.map(c => c.text);
    const row = columns.map(() => '');
    for (const cell of line) {
      // Header starts define column boundaries; item descriptions may span multiple words.
      let index = -1;
      for (let column = 0; column < columns.length; column++) {
        if (cell.x >= columns[column].x - 5) index = column;
      }
      if (index < 0) index = 0;
      row[index] = [row[index], cell.text].filter(Boolean).join(' ');
    }
    return row;
  });
}
