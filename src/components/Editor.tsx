import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import MonacoEditor, {
  useMonaco,
  type BeforeMount,
  type Monaco,
  type OnMount,
} from "@monaco-editor/react";
import { DEMO_CODE } from "../lib/demoCode";
import { OCAML_LANGUAGE_ID, registerOcamlLanguage } from "../lib/ocamlLanguage";
import {
  OCAML_DARK_THEME,
  OCAML_LIGHT_THEME,
  defineOcamlThemes,
  type OcamlPalettes,
} from "../lib/ocamlThemes";
import { phraseAt } from "../lib/phrases";
import { downloadTextFile } from "../lib/download";
import "./Editor.css";

const DOWNLOAD_FILENAME = "main.ml";

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform ?? "");
export const RUN_SHORTCUT_LABEL = IS_MAC ? "⌘↵" : "Ctrl+Enter";

export interface EditorHandle {
  getCode: () => string;
  setCode: (code: string) => void;
  /** Offset du curseur dans la source, pour retrouver la phrase courante. */
  getCursorOffset: () => number;
  getSelection: () => { text: string; startOffset: number };
}

interface EditorProps {
  theme: "light" | "dark";
  palettes: OcamlPalettes;
  boldAll: boolean;
  busy: "phrase" | "all" | "reset" | null;
  onRunPhrase: () => void;
  onRunAll: () => void;
  onReset: () => void;
}

const handleBeforeMount: BeforeMount = (monaco) => {
  registerOcamlLanguage(monaco);
};

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { theme, palettes, boldAll, busy, onRunPhrase, onRunAll, onReset },
  ref,
) {
  const monacoInstance = useMonaco();
  const editorInstanceRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const [downloaded, setDownloaded] = useState(false);
  const onRunPhraseRef = useRef(onRunPhrase);
  useEffect(() => {
    onRunPhraseRef.current = onRunPhrase;
  }, [onRunPhrase]);

  /* Les couleurs syntaxiques (et l'option gras) peuvent changer à tout moment
     (personnalisation en direct) : on redéfinit les deux thèmes et on force
     leur application immédiate — `defineTheme` seul ne suffit pas si le
     thème actif est déjà celui redéfini. */
  useEffect(() => {
    if (!monacoInstance) return;
    defineOcamlThemes(monacoInstance, palettes, boldAll);
    monacoInstance.editor.setTheme(theme === "dark" ? OCAML_DARK_THEME : OCAML_LIGHT_THEME);
  }, [monacoInstance, palettes, boldAll, theme]);

  useImperativeHandle(ref, () => ({
    getCode: () => editorInstanceRef.current?.getValue() ?? "",
    setCode: (code: string) => editorInstanceRef.current?.setValue(code),
    getCursorOffset: () => {
      const editor = editorInstanceRef.current;
      const position = editor?.getPosition();
      const model = editor?.getModel();
      return position && model ? model.getOffsetAt(position) : 0;
    },
    getSelection: () => {
      const editor = editorInstanceRef.current;
      const selection = editor?.getSelection();
      const model = editor?.getModel();
      if (!selection || !model) return { text: "", startOffset: 0 };
      return {
        text: model.getValueInRange(selection),
        startOffset: model.getOffsetAt(selection.getStartPosition()),
      };
    },
  }));

  /* Surligne discrètement la phrase que Cmd/Ctrl+Entrée exécuterait : celle
     qui contient le curseur, tant qu'il n'y a pas de sélection active (la
     sélection prend alors le pas, comme pour l'exécution elle-même). C'est un
     simple fond semi-transparent, indépendant de la couleur du texte : il
     reste donc visible quelle que soit la palette syntaxique choisie.

     Monaco interdit d'appeler deltaDecorations depuis l'intérieur même de la
     boucle de diffusion d'un événement (curseur/sélection/contenu) — cela
     lève « Invoking deltaDecorations recursively ». On sort donc de cette
     pile via une microtâche, en ne programmant qu'une seule mise à jour même
     si plusieurs événements arrivent pour le même changement. */
  const decorationScheduledRef = useRef(false);
  const applyPhraseDecoration = () => {
    const editor = editorInstanceRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    const selection = editor.getSelection();
    const position = editor.getPosition();
    if (!position || (selection && !selection.isEmpty())) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const phrase = phraseAt(model.getValue(), model.getOffsetAt(position));
    if (!phrase) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const start = model.getPositionAt(phrase.start);
    const end = model.getPositionAt(phrase.end);
    const range = new monaco.Range(
      start.lineNumber,
      start.column,
      end.lineNumber,
      end.column,
    );
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [
      {
        range,
        options: {
          isWholeLine: false,
          className: "active-phrase",
          linesDecorationsClassName: "active-phrase-margin",
        },
      },
    ]);
  };

  const updatePhraseDecoration = () => {
    if (decorationScheduledRef.current) return;
    decorationScheduledRef.current = true;
    queueMicrotask(() => {
      decorationScheduledRef.current = false;
      applyPhraseDecoration();
    });
  };

  /* Le fichier téléchargé contient exactement le contenu actuel de Monaco,
     sans aucune transformation (pas de `;;` ajouté, pas de formatage). */
  const handleDownload = () => {
    const code = editorInstanceRef.current?.getValue() ?? "";
    downloadTextFile(DOWNLOAD_FILENAME, code);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1000);
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunPhraseRef.current();
    });
    editor.onDidChangeCursorPosition(updatePhraseDecoration);
    editor.onDidChangeCursorSelection(updatePhraseDecoration);
    editor.onDidChangeModelContent(updatePhraseDecoration);
    updatePhraseDecoration();
  };

  return (
    <section className="panel editor-panel">
      <div className="panel-header">
        <span className="file-tab">main.ml</span>
        <div className="editor-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRunPhrase}
            disabled={busy !== null}
          >
            {busy === "phrase" ? (
              "◌ Exécution…"
            ) : (
              <>
                <span className="shortcut-hint">{RUN_SHORTCUT_LABEL}</span>
                Exécuter la phrase
              </>
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRunAll}
            disabled={busy !== null}
          >
            {busy === "all" ? "◌ Exécution…" : "▶ Exécuter tout"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onReset}
            disabled={busy !== null}
            title="Réinitialiser l'environnement OCaml"
            aria-label="Réinitialiser"
          >
            ↻
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={handleDownload}
            title="Télécharger main.ml"
            aria-label="Télécharger main.ml"
          >
            {downloaded ? "✓" : "↓"}
          </button>
        </div>
      </div>
      <div className="panel-body">
        <MonacoEditor
          defaultLanguage={OCAML_LANGUAGE_ID}
          defaultValue={DEMO_CODE}
          theme={theme === "dark" ? OCAML_DARK_THEME : OCAML_LIGHT_THEME}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          options={{
            fontSize: 13,
            fontFamily: "SF Mono, Fira Code, Menlo, Consolas, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            padding: { top: 16 },
            automaticLayout: true,
            renderLineHighlight: "line",
            smoothScrolling: true,
          }}
        />
      </div>
    </section>
  );
});
