# OCaml Playground

Un playground OCaml minimaliste qui exécute **réellement** du code OCaml dans le navigateur — sans backend, sans compte, sans installation. L'expérience suit le modèle d'un toplevel (REPL) : on évalue les phrases une à une et l'environnement est conservé entre les évaluations.

## Solution technique retenue

**`js_of_ocaml-toplevel` 6.2.0**, compilé une fois en bundle JavaScript autonome et chargé dans un Web Worker.

Ce n'est pas une simulation : le bundle **est** le compilateur OCaml (analyse syntaxique, typage, génération de code) et sa bibliothèque standard, compilés vers JS. Le module `Toploop` de `compiler-libs` y tourne exactement comme dans le `ocaml` en ligne de commande.

### Pourquoi c'est un vrai REPL persistant

L'environnement du toplevel (`Toploop`) est un **état global du programme** OCaml compilé. Comme le Worker reste vivant entre deux exécutions, cet état survit naturellement d'une évaluation à la suivante :

```ocaml
let x = 10;;      (* → val x : int = 10  *)
let y = x + 5;;   (* → val y : int = 15  — x est toujours lié *)
print_int y;;     (* → 15               *)
```

Aucune recompilation de fragments indépendants : la seconde phrase est typée et exécutée dans l'environnement laissé par la première, avec la sémantique exacte du toplevel OCaml.

### Alternatives étudiées

| Solution | Verdict |
|---|---|
| **`wasm_of_ocaml`** | Rejetée : ne supporte pas la construction d'un toplevel (pas de `dynlink`). Adapté à la compilation d'un programme *fixe*, pas à l'évaluation de code saisi dynamiquement. |
| **Serveur de compilation distant** | Rejetée : viole la contrainte « sans backend », ajoute latence, infra et une surface d'exécution de code arbitraire côté serveur. |
| **Interpréteur OCaml réécrit en JS** | Rejetée : ne serait pas OCaml. Sous-ensemble incomplet, sémantique et messages d'erreur divergents. |
| **Compiler un `.ml` complet à chaque exécution** | Rejetée : détruit la sémantique du toplevel — impossible de conserver `x` d'une évaluation à la suivante. |

## Architecture

```
Main thread                          Web Worker (reste vivant)
├── Monaco (source de vérité)
├── découpage en phrases      ──▶    ocaml-toplevel.js
├── OutputPanel                      └── Toploop
└── StatusBar                            ├── stdout / stderr
                                         ├── valeurs (- : int = 5)
                                         ├── erreurs & exceptions
                                         └── environnement persistant
```

- `src/lib/phrases.ts` — découpage de la source en phrases
- `src/lib/repl.ts` — client du Worker (API `init` / `execute` / `reset`, timeout)
- `public/ocaml-worker.js` — Worker hébergeant le toplevel
- `public/ocaml-toplevel.js` — bundle généré (voir *Construire le runtime*)
- `ocaml-runtime/ocaml_repl.ml` — source OCaml exposant le toplevel à JS

Le protocole Worker est volontairement minimal :

```
{ id, action: "execute" | "reset", code }
    ↓
{ id, type: "result", stdout, stderr, answer, error, startLine, startColumn, … }
```

## Détection des phrases

Le séparateur est `;;`, comme dans un toplevel. Le découpage n'est **pas** une recherche naïve : `src/lib/phrases.ts` scanne la source en tenant compte des

- chaînes `"…"` et de leurs échappements — `let s = "hello ;; world";;` reste **une** phrase ;
- commentaires `(* … *)` **imbriqués**, y compris les chaînes qu'ils contiennent ;
- chaînes délimitées `{|…|}` et `{id|…|id}` ;
- littéraux de caractères `'a'`, `'\n'`, `'\065'` — sans les confondre avec une variable de type `'a` ni un identifiant `x'`.

Deux ajustements sont appliqués au code envoyé au REPL, **sans jamais modifier le texte affiché dans Monaco** :

1. le toplevel exige un `;;` terminal : il est ajouté s'il manque ;
2. le fragment est réaligné sur sa position dans le fichier (retours à la ligne et espaces de remplissage), pour que les numéros de ligne et de colonne rapportés par OCaml désignent le bon endroit de la source.

## Les trois actions

### `⌘↵ / Ctrl+Enter — Exécuter la phrase`

Le raccourci et le bouton appellent la même fonction.

- **Sans sélection** : exécute la phrase contenant le curseur. Si le curseur est sur une ligne vide ou en fin de fichier, on retombe sur la phrase précédente.
- **Avec sélection** : exécute la sélection. Si elle s'arrête au milieu d'une chaîne ou d'un commentaire, une erreur explicite est affichée plutôt que d'exécuter du code partiel.

L'environnement est conservé : les phrases s'accumulent dans le même toplevel, et la sortie s'ajoute à la transcription.

### `▶ Exécuter tout`

1. réinitialise l'environnement (toplevel vierge) ;
2. découpe le buffer en phrases ;
3. les exécute **dans l'ordre, une à une** ;
4. s'arrête proprement à la première erreur ;
5. remplace la transcription.

Envoyer les phrases une à une garantit que la sortie du programme et les valeurs affichées apparaissent dans le bon ordre, et permet l'arrêt propre. Le résultat ne dépend donc jamais des `⌘↵` précédents : les deux modes sont indépendants.

### `↻ Réinitialiser`

Appelle `Toploop.initialize_toplevel_env`, qui repart d'un environnement vierge, puis vide la sortie et remet le statut à `Prêt`. Après réinitialisation, `print_int x;;` échoue avec `Unbound value x`.

## Sortie et erreurs

- **Sortie** — `stdout`/`stderr` du programme, entrelacés avec les valeurs imprimées par le toplevel (`val x : int = 10`, `- : int = 5`). Ce comportement vient du toplevel lui-même, il n'est pas simulé.
- **Erreurs** — erreurs de syntaxe, erreurs de typage et exceptions non rattrapées, avec le message OCaml et la position :

```
Line 3, characters 7-9:
Error: Syntax error
```

Côté OCaml, `Format.err_formatter` est détourné vers son propre tampon pour que les diagnostics du toplevel ne soient jamais confondus avec ce que le programme écrit sur `stderr`. Les exceptions, que `Toploop` imprime sur le flux des valeurs, sont redirigées vers le canal d'erreurs.

## Timeout

Une exécution est interrompue au bout de **2 secondes**.

Le code OCaml s'exécute de façon synchrone dans le Worker : une boucle infinie ne peut pas être interrompue de l'intérieur. Le seul moyen fiable est `worker.terminate()` depuis le thread principal — c'est ce qui est fait. **Conséquence assumée : l'environnement du REPL est perdu**, et le message le dit explicitement. Un Worker neuf est créé automatiquement à l'exécution suivante.

## Limitations connues

- **Taille du runtime** : `ocaml-toplevel.js` fait 27 Mo (~4 Mo gzip, ~3,6 Mo brotli). C'est le coût d'un compilateur OCaml complet dans le navigateur — l'ordre de grandeur du playground officiel. Il n'est chargé que par le Worker, jamais dans le bundle applicatif (69 ko gzip), et le serveur statique doit servir cet asset compressé.
- **Timeout destructif** : voir ci-dessus, l'interruption coûte l'environnement.
- **Bibliothèques** : seule la bibliothèque standard est disponible. Pas d'installation de paquets opam à la volée.
- **Effets (OCaml 5)** : le runtime est compilé sans `--effects=cps`. Du code utilisateur employant des gestionnaires d'effets n'est pas supporté.
- **Sans `;;`** : un buffer sans aucun `;;` constitue une seule phrase. Le modèle interactif repose sur `;;` pour délimiter les phrases.
- **Colonnes d'une sélection** : le réalignement restitue exactement les lignes ; pour une sélection commençant en milieu de ligne, la colonne de la première ligne peut être décalée.
- **Détection de phrases** : le scanner est lexical, pas un parseur OCaml complet. Il couvre chaînes, commentaires imbriqués, caractères et chaînes délimitées, ce qui suffit en pratique ; une construction exotique pourrait le mettre en défaut. Les erreurs restent alors des erreurs de syntaxe OCaml normales, affichées dans `Erreurs`.

## Stack

- **Vite** + **React 19** + **TypeScript**
- **Monaco Editor** (`@monaco-editor/react`) — coloration OCaml via une grammaire Monarch maison, thèmes clair/sombre sur mesure
- **CSS natif** (variables CSS, un fichier par composant) — pas de framework CSS
- **js_of_ocaml-toplevel 6.2.0**, OCaml 5.4.0

## Commandes

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production (tsc + vite build)
npm run preview  # prévisualiser le build de production
```

### Construire le runtime OCaml

`public/ocaml-toplevel.js` est un artefact généré. Pour le reconstruire, il faut opam avec OCaml ≥ 5.1 :

```bash
opam install js_of_ocaml js_of_ocaml-compiler js_of_ocaml-toplevel
npm run build:runtime
```

Le script compile `ocaml-runtime/ocaml_repl.ml` en bytecode, le passe à `js_of_ocaml --toplevel` (qui embarque les `.cmi` nécessaires au typage), et copie le résultat dans `public/`. Cette étape est indépendante du build Vite : elle n'est à relancer que si le runtime OCaml change.

## Déploiement

Le résultat est entièrement statique (`dist/`) : n'importe quel hébergeur de fichiers convient. Aucun serveur de compilation, aucune API.
# ocaml
