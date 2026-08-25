import "./StatusBar.css";

export type Status = "loading" | "idle" | "running" | "success" | "error";

const LABELS: Record<Status, string> = {
  loading: "Chargement du toplevel…",
  idle: "Prêt",
  running: "Exécution…",
  success: "Terminé",
  error: "Erreur",
};

const ICONS: Record<Status, string> = {
  loading: "◌",
  idle: "●",
  running: "◌",
  success: "✓",
  error: "×",
};

interface StatusBarProps {
  version: string;
  status: Status;
  /** Libellé plus précis qu'« Erreur », ex. « Exécution interrompue » après un timeout. */
  detail?: string;
}

export function StatusBar({ version, status, detail }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span className="status-item">
        <span className="status-dot status-dot-info" />
        OCaml {version}
      </span>
      <span className={`status-item status-${status}`}>
        <span className="status-icon">{ICONS[status]}</span>
        {detail ?? LABELS[status]}
      </span>
    </footer>
  );
}
