import type { Monaco } from "@monaco-editor/react";

export const OCAML_LANGUAGE_ID = "ocaml";

const KEYWORDS = [
  "and", "as", "assert", "begin", "class", "constraint", "do", "done",
  "downto", "else", "end", "exception", "external", "for", "fun", "function",
  "functor", "if", "in", "include", "inherit", "initializer", "lazy", "let",
  "match", "method", "module", "mutable", "new", "nonrec", "object", "of",
  "open", "or", "private", "rec", "sig", "struct", "then", "to", "try",
  "type", "val", "virtual", "when", "while", "with",
];

const OPERATOR_KEYWORDS = ["land", "lor", "lxor", "lsl", "lsr", "asr", "mod", "not"];

const BOOLEANS = ["true", "false"];

/* Types de base de la stdlib : reconnus par leur nom, comme le ferait un
   éditeur sans vérification de types — une identification lexicale, pas
   sémantique (un utilisateur nommant une variable `list` sera coloré comme
   un type, ce qui reste un compromis raisonnable pour un tokenizer). */
const BUILTIN_TYPES = [
  "int", "float", "bool", "char", "string", "bytes", "unit",
  "list", "array", "option", "ref", "exn", "format", "in_channel", "out_channel",
];

/* Fonctions de la stdlib assez centrales pour être reconnues par leur nom
   partout où elles apparaissent (et pas seulement à leur définition). Cette
   liste est délibérément limitée : le tokenizer ne devine pas qu'un
   identifiant quelconque est une fonction, il ne l'affirme que lorsque c'est
   réellement déterminable (nom connu, définition `let`, accès `Module.nom`). */
const BUILTIN_FUNCTIONS = [
  "print_int", "print_float", "print_string", "print_char", "print_endline",
  "print_newline", "prerr_int", "prerr_string", "prerr_endline",
  "string_of_int", "int_of_string", "string_of_float", "float_of_int",
  "string_of_bool", "bool_of_string", "int_of_float",
  "failwith", "invalid_arg", "raise", "ignore", "compare",
  "max", "min", "abs", "succ", "pred",
];

export function registerOcamlLanguage(monaco: Monaco) {
  const languages = monaco.languages.getLanguages();
  if (languages.some((lang: { id: string }) => lang.id === OCAML_LANGUAGE_ID)) {
    return;
  }

  monaco.languages.register({ id: OCAML_LANGUAGE_ID, extensions: [".ml", ".mli"] });

  monaco.languages.setLanguageConfiguration(OCAML_LANGUAGE_ID, {
    comments: { blockComment: ["(*", "*)"] },
    brackets: [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "{", close: "}" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: "[", close: "]" },
      { open: "{", close: "}" },
      { open: '"', close: '"' },
    ],
  });

  const identifier = /[a-z_][a-zA-Z0-9_']*/;
  // Le `\b` empêche le moteur de regex de « reculer » à l'intérieur du mot
  // (ex. matcher juste "activ" dans "active") pour satisfaire le lookahead :
  // sans lui, un identifiant suivi d'un espace puis '=' serait scindé en deux
  // tokens dès que sa dernière lettre coïncide avec la classe [a-z_(].
  const identifierFollowedByArg = /[a-z_][a-zA-Z0-9_']*\b(?=\s*[a-z_(])/;

  monaco.languages.setMonarchTokensProvider(OCAML_LANGUAGE_ID, {
    defaultToken: "",
    keywords: KEYWORDS,
    operatorKeywords: OPERATOR_KEYWORDS,
    booleans: BOOLEANS,
    types: BUILTIN_TYPES,
    functions: BUILTIN_FUNCTIONS,

    symbols: /[=<>!~?:&|+\-*/^%@.]+/,

    tokenizer: {
      root: [
        [/\(\*/, "comment", "@comment"],
        [/"/, "string", "@string"],
        [/'([^'\\]|\\.)'/, "string.char"],
        [/\b0[xX][0-9a-fA-F_]+\b/, "number.hex"],
        [/\b0[oO][0-7_]+\b/, "number.octal"],
        [/\b0[bB][01_]+\b/, "number.binary"],
        [/\b\d[\d_]*(\.[\d_]*)?([eE][+-]?\d+)?\b/, "number"],

        // Identifiant capitalisé : constructeur (Some, None, Ok, Error...) ou
        // chemin de module (Printf.printf) — dans ce dernier cas, le nom
        // après le point est réellement une fonction/valeur du module.
        [/[A-Z][a-zA-Z0-9_']*(?=\.)/, { token: "constructor", next: "@moduleAccess" }],
        [/[A-Z][a-zA-Z0-9_']*/, "constructor"],

        [
          identifier,
          {
            cases: {
              let: { token: "keyword", next: "@letBinding" },
              "@keywords": "keyword",
              "@operatorKeywords": "keyword.operator",
              "@booleans": "constant.boolean",
              "@types": "type.builtin",
              "@functions": "entity.function",
              "@default": "identifier",
            },
          },
        ],
        [/[{}()[\]]/, "@brackets"],
        [/[;,]/, "delimiter"],
        [
          /@symbols/,
          {
            cases: {
              "@default": "operator",
            },
          },
        ],
        [/\s+/, "white"],
      ],

      // Juste après `let `, le prochain identifiant est le nom lié : suivi
      // d'un paramètre (identifiant ou parenthèse) → une fonction, sinon une
      // simple variable. Un heuristique délibérément limité au site de
      // définition, pas une analyse de tout le programme.
      letBinding: [
        [/rec\b/, "keyword"],
        [/\s+/, "white"],
        [identifierFollowedByArg, { token: "entity.function", next: "@pop" }],
        [identifier, { token: "identifier", next: "@pop" }],
        [/(?:)/, { token: "", next: "@pop" }],
      ],

      moduleAccess: [
        [/[A-Z][a-zA-Z0-9_']*(?=\.)/, { token: "constructor", next: "@moduleAccess" }],
        [/[A-Z][a-zA-Z0-9_']*/, { token: "constructor", next: "@pop" }],
        [/[a-z_][a-zA-Z0-9_']*/, { token: "entity.function", next: "@pop" }],
        [/\./, "delimiter"],
        [/(?:)/, { token: "", next: "@pop" }],
      ],

      comment: [
        [/[^(*]+/, "comment"],
        [/\(\*/, "comment", "@push"],
        [/\*\)/, "comment", "@pop"],
        [/[(*]/, "comment"],
      ],

      string: [
        [/[^\\"]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, "string", "@pop"],
      ],
    },
  });
}
