(* Toplevel OCaml réel exposé au Web Worker.

   L'environnement du toplevel (Toploop) est un état global du programme : il
   survit donc naturellement d'un appel à [execute] au suivant. C'est ce qui
   donne un vrai REPL persistant, et non une suite de compilations isolées. *)

open Js_of_ocaml
open Js_of_ocaml_toplevel

let stdout_buf = Buffer.create 4096
let stderr_buf = Buffer.create 4096
let answer_buf = Buffer.create 4096
let error_buf = Buffer.create 4096
let answer_fmt = Format.formatter_of_buffer answer_buf
let last_loc = ref None

(* Le toplevel signale ses erreurs et ses avertissements sur
   [Format.err_formatter]. On le détourne vers son propre tampon pour ne pas
   les confondre avec ce que le programme de l'utilisateur écrit sur stderr. *)
let redirect_err_formatter () =
  let base = Format.pp_get_formatter_out_functions Format.err_formatter () in
  Format.pp_set_formatter_out_functions
    Format.err_formatter
    { base with
      Format.out_string = (fun s pos len -> Buffer.add_substring error_buf s pos len)
    ; out_flush = (fun () -> ())
    ; out_newline = (fun () -> Buffer.add_char error_buf '\n')
    ; out_spaces = (fun n -> Buffer.add_string error_buf (String.make n ' '))
    ; out_indent = (fun n -> Buffer.add_string error_buf (String.make n ' '))
    }

let channels_ready = ref false

let setup_channels () =
  if not !channels_ready
  then (
    channels_ready := true;
    Sys_js.set_channel_flusher Stdlib.stdout (fun s -> Buffer.add_string stdout_buf s);
    Sys_js.set_channel_flusher Stdlib.stderr (fun s -> Buffer.add_string stderr_buf s);
    redirect_err_formatter ())

(* [JsooTop.initialize] appelle [Toploop.initialize_toplevel_env], qui repart
   d'un environnement vierge : c'est exactement l'opération « Réinitialiser ». *)
let initialize () =
  setup_channels ();
  JsooTop.initialize ()

let clear_buffers () =
  Buffer.clear stdout_buf;
  Buffer.clear stderr_buf;
  Buffer.clear answer_buf;
  Buffer.clear error_buf;
  last_loc := None

let record_location loc =
  let s = loc.Location.loc_start and e = loc.Location.loc_end in
  last_loc
    := Some
         ( s.Lexing.pos_lnum
         , s.Lexing.pos_cnum - s.Lexing.pos_bol
         , e.Lexing.pos_lnum
         , e.Lexing.pos_cnum - e.Lexing.pos_bol )

(* Une exception non rattrapée est imprimée par [Toploop] sur le formatter de
   réponse, sous la forme « Exception: ... ». On la déplace vers le canal
   d'erreurs pour qu'elle apparaisse dans l'onglet Erreurs. *)
let split_exceptions answer =
  let rec go acc = function
    | [] -> List.rev acc, []
    | line :: rest when String.starts_with ~prefix:"Exception: " line ->
        List.rev acc, line :: rest
    | line :: rest -> go (line :: acc) rest
  in
  let before, from_exn = go [] (String.split_on_char '\n' answer) in
  String.concat "\n" before, String.concat "\n" from_exn

let execute code =
  clear_buffers ();
  (try JsooTop.execute true ~highlight_location:record_location answer_fmt code with
   | exn -> Buffer.add_string error_buf (Printexc.to_string exn));
  Format.pp_print_flush answer_fmt ();
  Format.pp_print_flush Format.err_formatter ();
  let answer_text, exn_text = split_exceptions (Buffer.contents answer_buf) in
  let inject = Js.Unsafe.inject in
  let loc_field name value = name, inject value in
  let base =
    [ "stdout", inject (Js.string (Buffer.contents stdout_buf))
    ; "stderr", inject (Js.string (Buffer.contents stderr_buf))
    ; "answer", inject (Js.string answer_text)
    ; "error", inject (Js.string (Buffer.contents error_buf ^ exn_text))
    ]
  in
  let loc =
    match !last_loc with
    | None -> []
    | Some (l1, c1, l2, c2) ->
        [ loc_field "startLine" l1
        ; loc_field "startColumn" c1
        ; loc_field "endLine" l2
        ; loc_field "endColumn" c2
        ]
  in
  Js.Unsafe.obj (Array.of_list (base @ loc))

let () =
  Js.Unsafe.set
    Js.Unsafe.global
    (Js.string "ocamlRepl")
    (Js.Unsafe.obj
       [| "version", Js.Unsafe.inject (Js.string Sys.ocaml_version)
        ; "initialize", Js.Unsafe.inject (Js.wrap_callback (fun () -> initialize ()))
        ; ( "execute"
          , Js.Unsafe.inject (Js.wrap_callback (fun code -> execute (Js.to_string code)))
          )
       |])
