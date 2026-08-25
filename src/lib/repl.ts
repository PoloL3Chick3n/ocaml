/* Client du Web Worker qui héberge le toplevel OCaml.

   Le worker reste vivant entre deux exécutions : c'est ce qui conserve
   l'environnement du REPL. La seule façon d'interrompre du code OCaml
   synchrone (une boucle infinie) est de tuer le worker ; le timeout ci-dessous
   le fait, au prix de la perte de l'environnement — c'est assumé et signalé. */

export const TIMEOUT_MS = 2000;

export interface ReplResult {
  stdout: string;
  stderr: string;
  /** Valeurs imprimées par le toplevel, ex. `- : int = 5`. */
  answer: string;
  /** Erreurs de syntaxe, de typage et exceptions non rattrapées. */
  error: string;
  location?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  /** Vrai si le worker a dû être tué : l'environnement a été perdu. */
  timedOut?: boolean;
}

const WORKER_URL = `${import.meta.env.BASE_URL}ocaml-worker.js`;

export class OcamlRepl {
  private worker: Worker | null = null;
  private starting: Promise<Worker> | null = null;
  private nextId = 0;
  version = "";

  /** Démarre le worker si besoin et attend que le toplevel soit initialisé. */
  private start(): Promise<Worker> {
    if (this.worker) return Promise.resolve(this.worker);
    if (this.starting) return this.starting;

    this.starting = new Promise<Worker>((resolve, reject) => {
      const worker = new Worker(WORKER_URL);
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type !== "ready") return;
        worker.removeEventListener("message", onMessage);
        this.version = event.data.version;
        this.worker = worker;
        this.starting = null;
        resolve(worker);
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener(
        "error",
        (e) => {
          this.starting = null;
          reject(new Error(e.message || "Impossible de charger le toplevel OCaml"));
        },
        { once: true },
      );
    });
    return this.starting;
  }

  /** Prépare le runtime et renvoie la version d'OCaml embarquée. */
  async init(): Promise<string> {
    await this.start();
    return this.version;
  }

  private kill() {
    this.worker?.terminate();
    this.worker = null;
  }

  private send<T>(
    action: string,
    code: string,
    onReply: (data: Record<string, unknown>) => T,
    onTimeout: () => T,
  ): Promise<T> {
    return this.start().then(
      (worker) =>
        new Promise<T>((resolve) => {
          const id = ++this.nextId;
          const timer = window.setTimeout(() => {
            worker.removeEventListener("message", onMessage);
            this.kill();
            resolve(onTimeout());
          }, TIMEOUT_MS);

          const onMessage = (event: MessageEvent) => {
            if (event.data?.id !== id) return;
            window.clearTimeout(timer);
            worker.removeEventListener("message", onMessage);
            resolve(onReply(event.data));
          };

          worker.addEventListener("message", onMessage);
          worker.postMessage({ id, action, code });
        }),
    );
  }

  execute(code: string): Promise<ReplResult> {
    return this.send<ReplResult>(
      "execute",
      code,
      (data) => ({
        stdout: (data.stdout as string) ?? "",
        stderr: (data.stderr as string) ?? "",
        answer: (data.answer as string) ?? "",
        error: (data.error as string) ?? "",
        location:
          typeof data.startLine === "number"
            ? {
                startLine: data.startLine as number,
                startColumn: data.startColumn as number,
                endLine: data.endLine as number,
                endColumn: data.endColumn as number,
              }
            : undefined,
      }),
      () => ({ stdout: "", stderr: "", answer: "", error: "", timedOut: true }),
    );
  }

  /** Repart d'un environnement vierge (Toploop.initialize_toplevel_env). */
  reset(): Promise<void> {
    if (!this.worker) {
      // Rien à réinitialiser : le prochain démarrage sera déjà vierge.
      return Promise.resolve();
    }
    return this.send<void>(
      "reset",
      "",
      () => undefined,
      () => undefined,
    );
  }
}
