/* Téléchargement d'un fichier texte côté client, sans dépendance ni backend :
   Blob + URL d'objet + clic synthétique sur un <a download>, le mécanisme
   natif supporté par Chrome, Firefox et Safari. */
export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Le téléchargement démarré par `click()` n'est pas garanti d'avoir déjà lu
  // le blob de façon synchrone (observé notamment sous automatisation) :
  // révoquer l'URL immédiatement peut faire échouer le téléchargement en
  // cours (ERR_FILE_NOT_FOUND). On laisse un court délai avant de la libérer.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
