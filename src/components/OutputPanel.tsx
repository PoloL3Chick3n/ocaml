import "./OutputPanel.css";

export type OutputTab = "output" | "errors";

/** Une ligne « val x : int = 10 » ou « - : int = 5 » est une valeur imprimée
    par le toplevel, à distinguer visuellement de la sortie du programme. */
const REPL_VALUE_LINE = /^(val\s|- : )/;

interface OutputPanelProps {
  output: string;
  errors: string;
  tab: OutputTab;
  onTabChange: (tab: OutputTab) => void;
  onClear: () => void;
}

export function OutputPanel({
  output,
  errors,
  tab,
  onTabChange,
  onClear,
}: OutputPanelProps) {
  const content = tab === "output" ? output : errors;
  const placeholder =
    tab === "output"
      ? "La sortie du programme s'affichera ici."
      : "Aucune erreur.";

  return (
    <section className="panel output-panel">
      <div className="panel-header output-header">
        <div className="output-tabs">
          <button
            type="button"
            className={`tab ${tab === "output" ? "tab-active" : ""}`}
            onClick={() => onTabChange("output")}
          >
            Sortie
          </button>
          <button
            type="button"
            className={`tab ${tab === "errors" ? "tab-active" : ""}`}
            onClick={() => onTabChange("errors")}
          >
            Erreurs
            {errors ? <span className="tab-dot" /> : null}
          </button>
        </div>
        <button type="button" className="text-action" onClick={onClear}>
          Effacer
        </button>
      </div>
      <div className="panel-body output-body">
        {content ? (
          tab === "errors" ? (
            <pre className="output-text output-error">{content}</pre>
          ) : (
            <pre className="output-text">
              {content.split("\n").map((line, i) => (
                <span
                  key={i}
                  className={REPL_VALUE_LINE.test(line) ? "output-value" : undefined}
                >
                  {line}
                  {"\n"}
                </span>
              ))}
            </pre>
          )
        ) : (
          <p className="output-placeholder">{placeholder}</p>
        )}
      </div>
    </section>
  );
}
