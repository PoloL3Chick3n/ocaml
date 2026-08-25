/* Web Worker hébergeant le toplevel OCaml.
   Le worker reste vivant entre deux exécutions : c'est lui qui porte
   l'environnement persistant du REPL. */

importScripts("./ocaml-toplevel.js");

const repl = self.ocamlRepl;

repl.initialize();
self.postMessage({ type: "ready", version: repl.version });

self.onmessage = (event) => {
  const { id, action, code } = event.data;

  if (action === "reset") {
    repl.initialize();
    self.postMessage({ id, type: "reset" });
    return;
  }

  const r = repl.execute(code);
  self.postMessage({
    id,
    type: "result",
    stdout: r.stdout,
    stderr: r.stderr,
    answer: r.answer,
    error: r.error,
    startLine: r.startLine,
    startColumn: r.startColumn,
    endLine: r.endLine,
    endColumn: r.endColumn,
  });
};
