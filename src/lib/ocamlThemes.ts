import type { Monaco } from "@monaco-editor/react";
import type { Palette, SyntaxCategory } from "./syntaxPalette";

export const OCAML_LIGHT_THEME = "ocaml-light";
export const OCAML_DARK_THEME = "ocaml-dark";

/* Association token Monarch → catégorie personnalisable. Les délimiteurs et
   crochets restent en couleur neutre (texte par défaut) : ce ne sont pas des
   catégories exposées à la personnalisation. */
const TOKEN_CATEGORY = new Map<string, SyntaxCategory>([
  ["comment", "comment"],
  ["keyword", "keyword"],
  ["keyword.operator", "keyword"],
  ["constant.boolean", "boolean"],
  ["type.builtin", "type"],
  ["constructor", "constructor"],
  ["entity.function", "function"],
  ["identifier", "variable"],
  ["string", "string"],
  ["string.escape", "string"],
  ["number", "number"],
  ["number.hex", "number"],
  ["number.octal", "number"],
  ["number.binary", "number"],
  ["operator", "operator"],
]);

const BOLD_TOKENS = new Set(["keyword", "keyword.operator", "constant.boolean"]);

/* `boldAll` vient de l'option « Texte en gras » du panneau de personnalisation :
   plutôt que de mettre en gras seulement les mots-clés et booléens (le
   comportement par défaut), toutes les catégories syntaxiques le deviennent,
   pour un code globalement plus visible. Les commentaires restent en italique
   dans les deux cas. */
function buildRules(palette: Palette, boldAll: boolean) {
  return Array.from(TOKEN_CATEGORY.entries()).map(([token, category]) => {
    const bold = boldAll || BOLD_TOKENS.has(token);
    const italic = token === "comment";
    return {
      token,
      foreground: palette[category],
      fontStyle: bold && italic ? "bold italic" : bold ? "bold" : italic ? "italic" : undefined,
    };
  });
}

interface EditorChrome {
  background: string;
  foreground: string;
  lineNumber: string;
  lineNumberActive: string;
  cursor: string;
  selection: string;
  inactiveSelection: string;
  lineHighlight: string;
  indentGuide: string;
  indentGuideActive: string;
  widgetBackground: string;
  widgetBorder: string;
}

const LIGHT_CHROME: EditorChrome = {
  background: "#ffffff",
  foreground: "#14181f",
  lineNumber: "#b0b6c0",
  lineNumberActive: "#0a2540",
  cursor: "#0a2540",
  selection: "#0a25402a",
  inactiveSelection: "#0a254015",
  lineHighlight: "#fafbfc",
  indentGuide: "#e2e5ea",
  indentGuideActive: "#c7cbd3",
  widgetBackground: "#ffffff",
  widgetBorder: "#e2e5ea",
};

const DARK_CHROME: EditorChrome = {
  background: "#0b0e13",
  foreground: "#e6e9ee",
  lineNumber: "#4b5563",
  lineNumberActive: "#5b9bd8",
  cursor: "#5b9bd8",
  selection: "#3b82c440",
  inactiveSelection: "#3b82c420",
  lineHighlight: "#11151c",
  indentGuide: "#262c36",
  indentGuideActive: "#3a4250",
  widgetBackground: "#11151c",
  widgetBorder: "#262c36",
};

function buildColors(chrome: EditorChrome) {
  return {
    "editor.background": chrome.background,
    "editor.foreground": chrome.foreground,
    "editorLineNumber.foreground": chrome.lineNumber,
    "editorLineNumber.activeForeground": chrome.lineNumberActive,
    "editorCursor.foreground": chrome.cursor,
    "editor.selectionBackground": chrome.selection,
    "editor.inactiveSelectionBackground": chrome.inactiveSelection,
    "editor.lineHighlightBackground": chrome.lineHighlight,
    "editor.lineHighlightBorder": "#00000000",
    "editorIndentGuide.background": chrome.indentGuide,
    "editorIndentGuide.activeBackground": chrome.indentGuideActive,
    "editorWidget.background": chrome.widgetBackground,
    "editorWidget.border": chrome.widgetBorder,
  };
}

export interface OcamlPalettes {
  light: Palette;
  dark: Palette;
}

/* (Re)définit les deux thèmes Monaco à partir des palettes courantes. Les
   couleurs "chrome" (fond, curseur, sélection...) restent fixes par thème
   clair/sombre — seules les couleurs des catégories syntaxiques varient avec
   la palette choisie par l'utilisateur. Peut être appelée à nouveau à chaque
   changement de couleur : `monaco.editor.setTheme` doit être rappelé ensuite
   pour que la redéfinition soit visible immédiatement. */
export function defineOcamlThemes(monaco: Monaco, palettes: OcamlPalettes, boldAll = false) {
  monaco.editor.defineTheme(OCAML_LIGHT_THEME, {
    base: "vs",
    inherit: true,
    rules: buildRules(palettes.light, boldAll),
    colors: buildColors(LIGHT_CHROME),
  });

  monaco.editor.defineTheme(OCAML_DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: buildRules(palettes.dark, boldAll),
    colors: buildColors(DARK_CHROME),
  });
}
