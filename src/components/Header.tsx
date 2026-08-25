import { useState } from "react";
import { ColorSettings } from "./ColorSettings";
import type { Palette, PaletteMode, PresetId } from "../lib/syntaxPalette";
import "./Header.css";

interface HeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onThemeChange: (theme: "light" | "dark") => void;
  paletteMode: PaletteMode;
  onSelectPreset: (id: PresetId) => void;
  onSelectCustom: () => void;
  activePalette: Palette;
  onColorChange: (category: keyof Palette, hex: string) => void;
  onResetColors: () => void;
  boldAll: boolean;
  onToggleBoldAll: (bold: boolean) => void;
}

export function Header({
  theme,
  onToggleTheme,
  onThemeChange,
  paletteMode,
  onSelectPreset,
  onSelectCustom,
  activePalette,
  onColorChange,
  onResetColors,
  boldAll,
  onToggleBoldAll,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-title">
        <svg
          className="header-logo"
          width="22"
          height="22"
          viewBox="0 0 64 64"
          aria-hidden="true"
        >
          <circle cx="20" cy="20" r="9" fill="currentColor" />
          <circle cx="34" cy="17" r="9" fill="currentColor" />
          <ellipse cx="27" cy="36" rx="17" ry="11" fill="currentColor" />
          <path d="M40 32 L52 14 L58 16 L48 38 Z" fill="currentColor" />
          <circle cx="55" cy="15" r="6" fill="currentColor" />
          <path d="M52 10 L56 8 L57 12 Z" fill="currentColor" />
          <rect x="16" y="44" width="5" height="16" rx="2" fill="currentColor" />
          <rect x="34" y="44" width="5" height="16" rx="2" fill="currentColor" />
          <path
            d="M11 32 Q6 38 10 46"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        OCaml Playground
      </div>
      <div className="header-actions">
        <div className="header-settings">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label="Personnaliser les couleurs"
            aria-expanded={settingsOpen}
            title="Personnaliser les couleurs"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="8" cy="5" r="1.15" fill="currentColor" />
              <circle cx="5.2" cy="9.2" r="1.15" fill="currentColor" />
              <circle cx="10.8" cy="9.2" r="1.15" fill="currentColor" />
            </svg>
          </button>
          {settingsOpen ? (
            <ColorSettings
              theme={theme}
              onThemeChange={onThemeChange}
              paletteMode={paletteMode}
              onSelectPreset={onSelectPreset}
              onSelectCustom={onSelectCustom}
              activePalette={activePalette}
              onColorChange={onColorChange}
              onResetColors={onResetColors}
              boldAll={boldAll}
              onToggleBoldAll={onToggleBoldAll}
              onClose={() => setSettingsOpen(false)}
            />
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={onToggleTheme}
          aria-label="Changer de thème"
        >
          {theme === "light" ? "☾" : "☀"}
        </button>
      </div>
    </header>
  );
}
