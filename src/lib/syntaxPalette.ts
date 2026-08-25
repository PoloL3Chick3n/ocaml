/* Catégories syntaxiques personnalisables et presets de couleurs.

   Chaque catégorie correspond à un ou plusieurs tokens Monarch émis par
   `ocamlLanguage.ts` (voir `TOKEN_CATEGORY`). Les couleurs UI fonctionnelles
   (erreur, succès, action principale) ne font pas partie de ce système —
   elles restent définies dans `theme.css` et ne sont jamais touchées ici. */

export type SyntaxCategory =
  | "keyword"
  | "function"
  | "type"
  | "constructor"
  | "string"
  | "number"
  | "boolean"
  | "comment"
  | "operator"
  | "variable";

export type Palette = Record<SyntaxCategory, string>;

export const CATEGORIES: { key: SyntaxCategory; label: string }[] = [
  { key: "keyword", label: "Mots-clés" },
  { key: "function", label: "Fonctions" },
  { key: "type", label: "Types" },
  { key: "constructor", label: "Constructeurs" },
  { key: "string", label: "Chaînes" },
  { key: "number", label: "Nombres" },
  { key: "boolean", label: "Booléens" },
  { key: "comment", label: "Commentaires" },
  { key: "operator", label: "Opérateurs" },
  { key: "variable", label: "Variables" },
];

export const PRESET_IDS = ["marine", "classic", "solarized"] as const;
export type PresetId = (typeof PRESET_IDS)[number];
export type PaletteMode = PresetId | "custom";

export const PRESET_LABELS: Record<PresetId, string> = {
  marine: "Marine",
  classic: "Classic",
  solarized: "Solarized",
};

interface PresetThemes {
  light: Palette;
  dark: Palette;
}

/* Marine — sur la marque du site : navy dominant, accents teal/ambre. */
const MARINE: PresetThemes = {
  light: {
    keyword: "0a2540",
    function: "b45309",
    type: "0f766e",
    constructor: "1d4ed8",
    string: "15803d",
    number: "7c3aed",
    boolean: "be185d",
    comment: "6b7280",
    operator: "334155",
    variable: "14181f",
  },
  dark: {
    keyword: "5b9bd8",
    function: "f0b429",
    type: "2dd4bf",
    constructor: "60a5fa",
    string: "34d399",
    number: "a78bfa",
    boolean: "f472b6",
    comment: "8b93a1",
    operator: "cbd5e1",
    variable: "e6e9ee",
  },
};

/* Classic — inspirée des éditeurs de code traditionnels (type VS Code). */
const CLASSIC: PresetThemes = {
  light: {
    keyword: "0000ff",
    function: "795e26",
    type: "267f99",
    constructor: "af00db",
    string: "a31515",
    number: "098658",
    boolean: "d16969",
    comment: "008000",
    operator: "444444",
    variable: "1f2328",
  },
  dark: {
    keyword: "569cd6",
    function: "dcdcaa",
    type: "4ec9b0",
    constructor: "c586c0",
    string: "ce9178",
    number: "b5cea8",
    boolean: "ff6b81",
    comment: "6a9955",
    operator: "d4d4d4",
    variable: "9cdcfe",
  },
};

/* Solarized — les accents emblématiques de la palette Solarized. Les tons
   neutres (commentaires, variables) sont réajustés par thème pour rester
   lisibles sur un fond blanc ou quasi noir ; les accents saturés restent
   volontairement identiques entre les deux, comme dans la palette d'origine. */
const SOLARIZED: PresetThemes = {
  light: {
    keyword: "268bd2",
    function: "b58900",
    type: "2aa198",
    constructor: "6c71c4",
    string: "859900",
    number: "cb4b16",
    boolean: "d33682",
    comment: "657b83",
    operator: "586e75",
    variable: "1f2937",
  },
  dark: {
    keyword: "268bd2",
    function: "b58900",
    type: "2aa198",
    constructor: "6c71c4",
    string: "859900",
    number: "cb4b16",
    boolean: "d33682",
    comment: "93a1a1",
    operator: "839496",
    variable: "d6dee7",
  },
};

export const PRESETS: Record<PresetId, PresetThemes> = {
  marine: MARINE,
  classic: CLASSIC,
  solarized: SOLARIZED,
};

export function clonePalette(palette: Palette): Palette {
  return { ...palette };
}
