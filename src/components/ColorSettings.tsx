import { useEffect, useRef } from "react";
import {
  CATEGORIES,
  PRESET_IDS,
  PRESET_LABELS,
  type Palette,
  type PaletteMode,
} from "../lib/syntaxPalette";
import "./ColorSettings.css";

interface ColorSettingsProps {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  paletteMode: PaletteMode;
  onSelectPreset: (id: (typeof PRESET_IDS)[number]) => void;
  onSelectCustom: () => void;
  activePalette: Palette;
  onColorChange: (category: keyof Palette, hex: string) => void;
  onResetColors: () => void;
  boldAll: boolean;
  onToggleBoldAll: (bold: boolean) => void;
  onClose: () => void;
}

export function ColorSettings({
  theme,
  onThemeChange,
  paletteMode,
  onSelectPreset,
  onSelectCustom,
  activePalette,
  onColorChange,
  onResetColors,
  boldAll,
  onToggleBoldAll,
  onClose,
}: ColorSettingsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="color-popover" ref={panelRef} role="dialog" aria-label="Couleurs">
      <div className="popover-section">
        <div className="popover-label">Thème</div>
        <div className="radio-row">
          <label className="radio-option">
            <input
              type="radio"
              name="app-theme"
              checked={theme === "light"}
              onChange={() => onThemeChange("light")}
            />
            Clair
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="app-theme"
              checked={theme === "dark"}
              onChange={() => onThemeChange("dark")}
            />
            Sombre
          </label>
        </div>
      </div>

      <div className="popover-section">
        <div className="popover-label">Palette</div>
        <div className="radio-row radio-col">
          {PRESET_IDS.map((id) => (
            <label className="radio-option" key={id}>
              <input
                type="radio"
                name="palette-mode"
                checked={paletteMode === id}
                onChange={() => onSelectPreset(id)}
              />
              {PRESET_LABELS[id]}
            </label>
          ))}
          <label className="radio-option">
            <input
              type="radio"
              name="palette-mode"
              checked={paletteMode === "custom"}
              onChange={onSelectCustom}
            />
            Personnalisée
          </label>
        </div>
      </div>

      <div className="popover-section">
        <div className="popover-label">Couleurs</div>
        <div className="swatch-list">
          {CATEGORIES.map(({ key, label }) => (
            <label className="swatch-row" key={key}>
              <span className="swatch-name">{label}</span>
              <input
                type="color"
                className="swatch-input"
                value={`#${activePalette[key]}`}
                onChange={(e) => onColorChange(key, e.target.value.slice(1))}
              />
            </label>
          ))}
        </div>
        <label className="bold-option">
          <input
            type="checkbox"
            checked={boldAll}
            onChange={(e) => onToggleBoldAll(e.target.checked)}
          />
          Texte en gras
        </label>
        <button type="button" className="text-action reset-colors" onClick={onResetColors}>
          Réinitialiser les couleurs
        </button>
      </div>
    </div>
  );
}
