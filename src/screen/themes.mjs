/**
 * Color themes of the full-screen interface. Theme names are public (`anais theme <nom>`).
 *
 *   terminal  the terminal's own colors: no forced background, faint frames, selection in reverse
 *             video. Readable with any light or dark theme, and the default.
 *   ambre     amber on black, like an old phosphor screen.
 *   sauge     soft green on dark grey.
 * Only the 256-color palette is used: macOS Terminal does not display 24-bit colors.
 */
const RESET = '\x1b[0m';
const attributes = (...codes) => `\x1b[0;${codes.join(';')}m`;
const palette = (background, foreground, ...extra) => attributes(...extra, `48;5;${background}`, `38;5;${foreground}`);

export const THEMES = {
  terminal: {
    body: RESET,
    frame: attributes(2),
    dimmed: attributes(2),
    bar: attributes(1),
    barActive: attributes(1, 7),
    selected: attributes(7),
    message: attributes(1),
    field: attributes(4),
  },
  ambre: {
    body: palette(16, 214),
    frame: palette(16, 172),
    dimmed: palette(16, 136),
    bar: palette(94, 230),
    barActive: palette(214, 16, 1),
    selected: palette(214, 16, 1),
    message: palette(16, 222, 1),
    field: palette(58, 222),
  },
  sauge: {
    body: palette(236, 151),
    frame: palette(236, 65),
    dimmed: palette(236, 102),
    bar: palette(65, 194),
    barActive: palette(108, 235, 1),
    selected: palette(108, 235, 1),
    message: palette(236, 194, 1),
    field: palette(238, 194),
  },
};
export const DEFAULT_THEME = 'terminal';
export const RESET_CODE = RESET;

export function themeNamed(name) {
  return THEMES[name] || THEMES[DEFAULT_THEME];
}
