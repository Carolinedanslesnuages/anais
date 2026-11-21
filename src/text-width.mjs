/**
 * Text width in terminal columns: an emoji shown as a picture takes two columns, other
 * characters one. Frames stay aligned even with emoji in the journal.
 */
const graphemes = new Intl.Segmenter('fr', { granularity: 'grapheme' });
const WIDE = /\p{Emoji_Presentation}|️/u;

const graphemeList = (text) => [...graphemes.segment(String(text))].map((part) => part.segment);
const columnsOf = (grapheme) => (WIDE.test(grapheme) ? 2 : 1);

export const displayWidth = (text) => graphemeList(text).reduce((total, grapheme) => total + columnsOf(grapheme), 0);

/** Cuts or pads a text to an exact width in columns ("…" marks a cut). */
export function fitWidth(text, width) {
  if (width <= 0) return '';
  if (displayWidth(text) <= width) return String(text) + ' '.repeat(width - displayWidth(text));
  let kept = '';
  let used = 0;
  for (const grapheme of graphemeList(text)) {
    if (used + columnsOf(grapheme) > width - 1) break;
    kept += grapheme;
    used += columnsOf(grapheme);
  }
  return kept + '…' + ' '.repeat(width - used - 1);
}

/** Wraps a text (with line breaks) into lines of at most `width` columns, cutting at spaces. */
export function wrapText(text, width) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let current = '';
    for (const word of paragraph.split(' ')) {
      let rest = word;
      while (displayWidth(rest) > width) {
        if (current) lines.push(current);
        let head = '';
        for (const grapheme of graphemeList(rest)) {
          if (displayWidth(head + grapheme) > width) break;
          head += grapheme;
        }
        lines.push(head);
        rest = rest.slice(head.length);
        current = '';
      }
      const candidate = current ? `${current} ${rest}` : rest;
      if (displayWidth(candidate) > width) {
        lines.push(current);
        current = rest;
      } else current = candidate;
    }
    lines.push(current);
  }
  return lines;
}
