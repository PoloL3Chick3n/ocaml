import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Editor, type EditorHandle } from "./components/Editor";
import { OutputPanel, type OutputTab } from "./components/OutputPanel";
import { StatusBar, type Status } from "./components/StatusBar";
import { OcamlRepl, TIMEOUT_MS, type ReplResult } from "./lib/repl";
import {
  isSelectionComplete,
  phraseAt,
  splitPhrases,
  toReplCode,
} from "./lib/phrases";
import {
  PRESETS,
  clonePalette,
  type Palette,
  type PaletteMode,
  type PresetId,
} from "./lib/syntaxPalette";
import "./App.css";

type Theme = "light" | "dark";
const THEME_KEY = "ocaml-playground-theme";
const PALETTE_MODE_KEY = "ocaml-playground-palette-mode";
const BASE_PRESET_KEY = "ocaml-playground-base-preset";
const CUSTOM_LIGHT_KEY = "ocaml-playground-custom-light";
const CUSTOM_DARK_KEY = "ocaml-playground-custom-dark";
const BOLD_KEY = "ocaml-playground-bold";

const PRESET_ID_SET = new Set<PresetId>(["marine", "classic", "solarized"]);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" ? "dark" : "light";
}

function getInitialPaletteMode(): PaletteMode {
  const stored = localStorage.getItem(PALETTE_MODE_KEY);
  if (stored === "custom" || (stored && PRESET_ID_SET.has(stored as PresetId))) {
    return stored as PaletteMode;
  }
  return "marine";
}

function getInitialBasePreset(): PresetId {
  const stored = localStorage.getItem(BASE_PRESET_KEY);
  return stored && PRESET_ID_SET.has(stored as PresetId) ? (stored as PresetId) : "marine";
}

function readStoredPalette(key: string): Palette | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Palette;
  } catch {
    return null;
  }
}

/* Un seul REPL par page. Au niveau module, il survit au double montage du
   StrictMode sans démarrer deux workers. */
const repl = new OcamlRepl();

const TIMEOUT_MESSAGE = `Exécution interrompue

Le programme a dépassé le temps d'exécution autorisé (${TIMEOUT_MS / 1000} s).
L'environnement du REPL a été réinitialisé.`;

/* Transcription d'une phrase : la sortie du programme, puis la valeur
   imprimée par le toplevel — comme dans un vrai toplevel. */
function transcribe(result: ReplResult): string {
  const program = result.stdout + result.stderr;
  const separator = program !== "" && !program.endsWith("\n") ? "\n" : "";
  return program + separator + result.answer;
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [status, setStatus] = useState<Status>("loading");
  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [busy, setBusy] = useState<"phrase" | "all" | "reset" | null>(null);
  const [version, setVersion] = useState("5.x");
  const [output, setOutput] = useState("");
  const [errors, setErrors] = useState("");
  const [tab, setTab] = useState<OutputTab>("output");
  const editorRef = useRef<EditorHandle>(null);

  /* `paletteMode` piloté par les 4 boutons radio (3 presets + Personnalisée).
     `basePresetId` retient le dernier preset nommé choisi : c'est à la fois
     la source utilisée pour amorcer une personnalisation naissante et la
     cible de « Réinitialiser les couleurs ». `customPalettes` ne contient une
     entrée pour un thème qu'une fois que l'utilisateur y a réellement touché,
     et clair/sombre sont toujours conservés indépendamment. */
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(getInitialPaletteMode);
  const [basePresetId, setBasePresetId] = useState<PresetId>(getInitialBasePreset);
  const [customPalettes, setCustomPalettes] = useState<{
    light: Palette | null;
    dark: Palette | null;
  }>(() => ({
    light: readStoredPalette(CUSTOM_LIGHT_KEY),
    dark: readStoredPalette(CUSTOM_DARK_KEY),
  }));
  const [boldAll, setBoldAll] = useState<boolean>(
    () => localStorage.getItem(BOLD_KEY) === "true",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(PALETTE_MODE_KEY, paletteMode);
  }, [paletteMode]);

  useEffect(() => {
    localStorage.setItem(BASE_PRESET_KEY, basePresetId);
  }, [basePresetId]);

  useEffect(() => {
    if (customPalettes.light) {
      localStorage.setItem(CUSTOM_LIGHT_KEY, JSON.stringify(customPalettes.light));
    }
    if (customPalettes.dark) {
      localStorage.setItem(CUSTOM_DARK_KEY, JSON.stringify(customPalettes.dark));
    }
  }, [customPalettes]);

  useEffect(() => {
    localStorage.setItem(BOLD_KEY, String(boldAll));
  }, [boldAll]);

  const paletteFor = useCallback(
    (t: Theme): Palette =>
      paletteMode === "custom"
        ? (customPalettes[t] ?? PRESETS[basePresetId][t])
        : PRESETS[paletteMode][t],
    [paletteMode, basePresetId, customPalettes],
  );

  const palettes = useMemo(
    () => ({ light: paletteFor("light"), dark: paletteFor("dark") }),
    [paletteFor],
  );

  const handleSelectPreset = useCallback((id: PresetId) => {
    setBasePresetId(id);
    setPaletteMode(id);
  }, []);

  const handleSelectCustom = useCallback(() => {
    setPaletteMode("custom");
  }, []);

  const handleColorChange = useCallback(
    (category: keyof Palette, hex: string) => {
      setPaletteMode("custom");
      setCustomPalettes((prev) => ({
        ...prev,
        [theme]: {
          ...(prev[theme] ?? clonePalette(PRESETS[basePresetId][theme])),
          [category]: hex,
        },
      }));
    },
    [theme, basePresetId],
  );

  const handleResetColors = useCallback(() => {
    setCustomPalettes((prev) => ({
      ...prev,
      [theme]: clonePalette(PRESETS[basePresetId][theme]),
    }));
  }, [theme, basePresetId]);

  useEffect(() => {
    let cancelled = false;
    repl
      .init()
      .then((ocamlVersion) => {
        if (cancelled) return;
        setVersion(ocamlVersion);
        setStatus("idle");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setErrors(error.message);
        setTab("errors");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showFailure = useCallback((message: string, detail?: string) => {
    setErrors(message);
    setTab("errors");
    setStatus("error");
    setStatusDetail(detail);
  }, []);

  /* Le timeout tue le Worker : l'environnement est perdu. On le signale
     brièvement dans la barre de statut, puis on relance un Worker en
     arrière-plan pour que le playground redevienne utilisable — le statut
     revient alors à « Prêt » de lui-même, sans action de l'utilisateur. */
  const recoverAfterTimeout = useCallback(() => {
    showFailure(TIMEOUT_MESSAGE, "Exécution interrompue");
    repl.init().then(() => {
      setStatus((current) => (current === "error" ? "idle" : current));
      setStatusDetail((current) =>
        current === "Exécution interrompue" ? undefined : current,
      );
    });
  }, [showFailure]);

  const applyResult = useCallback(
    (result: ReplResult, replace: boolean) => {
      if (result.timedOut) {
        recoverAfterTimeout();
        return;
      }
      const text = transcribe(result);
      setOutput((previous) => (replace ? text : previous + text));

      if (result.error) {
        setErrors(result.error);
        setTab("errors");
        setStatus("error");
        setStatusDetail(undefined);
      } else {
        setErrors("");
        setTab("output");
        setStatus("success");
        setStatusDetail(undefined);
      }
    },
    [recoverAfterTimeout],
  );

  const runPhrase = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || busy !== null || status === "loading") return;

    const source = editor.getCode();
    const selection = editor.getSelection();
    let code: string;

    if (selection.text.trim() !== "") {
      if (!isSelectionComplete(selection.text)) {
        showFailure("La sélection ne constitue pas une phrase OCaml complète.");
        return;
      }
      code = toReplCode(source, selection.startOffset, selection.text);
    } else {
      const phrase = phraseAt(source, editor.getCursorOffset());
      if (!phrase) {
        showFailure("Aucune phrase à exécuter à cet endroit.");
        return;
      }
      code = toReplCode(source, phrase.start, phrase.text);
    }

    setBusy("phrase");
    setStatus("running");
    const result = await repl.execute(code);
    setBusy(null);
    applyResult(result, false);
  }, [applyResult, busy, showFailure, status]);

  /* « Exécuter tout » repart toujours d'un environnement vierge : le résultat
     ne dépend donc jamais des Cmd/Ctrl+Entrée précédents. Les phrases sont
     envoyées une à une, ce qui préserve l'ordre sortie/valeur et permet de
     s'arrêter proprement à la première erreur. */
  const runAll = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || busy !== null || status === "loading") return;

    const source = editor.getCode();
    const phrases = splitPhrases(source);
    if (phrases.length === 0) return;

    setBusy("all");
    setStatus("running");
    await repl.reset();

    let transcript = "";
    for (const phrase of phrases) {
      const result = await repl.execute(toReplCode(source, phrase.start, phrase.text));
      if (result.timedOut) {
        setOutput(transcript);
        setBusy(null);
        recoverAfterTimeout();
        return;
      }
      transcript += transcribe(result);
      if (result.error) {
        setOutput(transcript);
        setBusy(null);
        showFailure(result.error);
        return;
      }
    }

    setOutput(transcript);
    setErrors("");
    setTab("output");
    setBusy(null);
    setStatus("success");
    setStatusDetail(undefined);
  }, [busy, recoverAfterTimeout, showFailure, status]);

  const handleReset = useCallback(async () => {
    if (busy !== null || status === "loading") return;
    setBusy("reset");
    setStatus("running");
    await repl.reset();
    setOutput("");
    setErrors("");
    setTab("output");
    setBusy(null);
    setStatus("idle");
    setStatusDetail(undefined);
  }, [busy, status]);

  return (
    <div className="app">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        onThemeChange={setTheme}
        paletteMode={paletteMode}
        onSelectPreset={handleSelectPreset}
        onSelectCustom={handleSelectCustom}
        activePalette={palettes[theme]}
        onColorChange={handleColorChange}
        onResetColors={handleResetColors}
        boldAll={boldAll}
        onToggleBoldAll={setBoldAll}
      />
      <main className="workspace">
        <Editor
          ref={editorRef}
          theme={theme}
          palettes={palettes}
          boldAll={boldAll}
          busy={busy}
          onRunPhrase={runPhrase}
          onRunAll={runAll}
          onReset={handleReset}
        />
        <OutputPanel
          output={output}
          errors={errors}
          tab={tab}
          onTabChange={setTab}
          onClear={() => {
            setOutput("");
            setErrors("");
          }}
        />
      </main>
      <StatusBar version={version} status={status} detail={statusDetail} />
    </div>
  );
}

export default App;
