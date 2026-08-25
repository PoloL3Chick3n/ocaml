/* Découpage d'une source OCaml en phrases séparées par `;;`.

   Le découpage n'est pas une recherche naïve de `;;` : on scanne la source en
   respectant les chaînes, les caractères, les chaînes délimitées {|...|} et les
   commentaires imbriqués, afin qu'un `;;` situé dans l'un d'eux ne soit jamais
   pris pour un séparateur. */

export interface Phrase {
  /** Texte de la phrase, séparateur `;;` exclu. */
  text: string;
  /** Offset du début de la phrase dans la source. */
  start: number;
  /** Offset de fin, séparateur `;;` inclus. */
  end: number;
}

/** Littéral de caractère : `'a'`, `'\n'`, `'\065'`, `'\x41'`.
    Permet de ne pas confondre avec une variable de type `'a` ou un prime `x'`. */
const CHAR_LITERAL =
  /'(?:\\(?:[\\"'ntbr ]|[0-9]{3}|x[0-9a-fA-F]{2}|o[0-7]{3})|[^\\'])'/y;

/** Ouverture d'une chaîne délimitée `{id|`. */
const QUOTED_OPEN = /\{([a-z_]*)\|/y;

interface ScanResult {
  separators: { start: number; end: number }[];
  /** Vrai si la source se termine dans une chaîne ou un commentaire ouvert. */
  unterminated: boolean;
}

function scan(src: string): ScanResult {
  const separators: { start: number; end: number }[] = [];
  let commentDepth = 0;
  let unterminated = false;
  let i = 0;

  /** Avance après la chaîne `"..."` ouverte en `i`. */
  const skipString = (from: number): number => {
    let j = from + 1;
    while (j < src.length) {
      if (src[j] === "\\") {
        j += 2;
        continue;
      }
      if (src[j] === '"') return j + 1;
      j++;
    }
    unterminated = true;
    return src.length;
  };

  const skipQuotedString = (from: number): number => {
    QUOTED_OPEN.lastIndex = from;
    const open = QUOTED_OPEN.exec(src);
    if (!open) return from + 1;
    const closing = `|${open[1]}}`;
    const end = src.indexOf(closing, from + open[0].length);
    if (end === -1) {
      unterminated = true;
      return src.length;
    }
    return end + closing.length;
  };

  while (i < src.length) {
    if (commentDepth > 0) {
      if (src.startsWith("(*", i)) {
        commentDepth++;
        i += 2;
      } else if (src.startsWith("*)", i)) {
        commentDepth--;
        i += 2;
      } else if (src[i] === '"') {
        // OCaml lexe aussi les chaînes à l'intérieur des commentaires.
        i = skipString(i);
      } else {
        i++;
      }
      continue;
    }

    if (src.startsWith("(*", i)) {
      commentDepth = 1;
      i += 2;
    } else if (src[i] === '"') {
      i = skipString(i);
    } else if (src[i] === "{") {
      QUOTED_OPEN.lastIndex = i;
      i = QUOTED_OPEN.test(src) ? skipQuotedString(i) : i + 1;
    } else if (src[i] === "'") {
      CHAR_LITERAL.lastIndex = i;
      const match = CHAR_LITERAL.exec(src);
      i += match ? match[0].length : 1;
    } else if (src.startsWith(";;", i)) {
      separators.push({ start: i, end: i + 2 });
      i += 2;
    } else {
      i++;
    }
  }

  return { separators, unterminated: unterminated || commentDepth > 0 };
}

/** Découpe la source en segments, y compris les segments vides. */
function segments(src: string): Phrase[] {
  const { separators } = scan(src);
  const result: Phrase[] = [];
  let cursor = 0;

  for (const sep of separators) {
    result.push({ text: src.slice(cursor, sep.start), start: cursor, end: sep.end });
    cursor = sep.end;
  }
  result.push({ text: src.slice(cursor), start: cursor, end: src.length });
  return result;
}

/** Toutes les phrases non vides de la source. */
export function splitPhrases(src: string): Phrase[] {
  return segments(src).filter((p) => p.text.trim() !== "");
}

/** Phrase contenant l'offset donné. Si le curseur est sur une zone vide
    (ligne blanche, fin de fichier), on retombe sur la phrase précédente. */
export function phraseAt(src: string, offset: number): Phrase | null {
  const all = segments(src);
  let index = all.findIndex((p) => offset >= p.start && offset <= p.end);
  if (index === -1) index = all.length - 1;

  for (let i = index; i >= 0; i--) {
    if (all[i].text.trim() !== "") return all[i];
  }
  return null;
}

/** Code réellement envoyé au REPL.

    Deux ajustements, invisibles dans l'éditeur : le toplevel exige un `;;`
    terminal, et le fragment est réaligné (retours à la ligne et espaces de
    remplissage) sur sa position dans le fichier, pour que les numéros de ligne
    et de colonne rapportés par OCaml désignent le bon endroit de la source. */
export function toReplCode(src: string, startOffset: number, body: string): string {
  const before = src.slice(0, startOffset);
  const linesBefore = before.length - before.replaceAll("\n", "").length;
  const column = startOffset - before.lastIndexOf("\n") - 1;

  const trimmed = body.replace(/\s+$/, "");
  const terminated = trimmed.endsWith(";;") ? trimmed : `${trimmed};;`;
  return "\n".repeat(linesBefore) + " ".repeat(column) + terminated;
}

/** Une sélection n'est exécutable que si elle ne s'arrête pas au milieu d'une
    chaîne ou d'un commentaire. */
export function isSelectionComplete(selection: string): boolean {
  if (selection.trim() === "") return false;
  return !scan(selection).unterminated;
}
