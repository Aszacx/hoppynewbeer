"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type LogTone = "default" | "success" | "error" | "muted";

type LogEntry = {
  id: number;
  prompt?: string;
  output: string;
  tone?: LogTone;
};

type CommitEntry = {
  hash: string;
  message: string;
  alias: string;
  tap: string;
  caption: string;
  createdAt: string;
  status: "pending" | "approved";
  bubbleX?: number;
  bubbleDelay?: number;
};

const initialLogs: LogEntry[] = [
  {
    id: 1,
    output: "🍺 Last Commit // Azul Malta\nConsola vintage para tu último commit cervecero.",
    tone: "success",
  },
  {
    id: 2,
    output:
      "Escribe `help` para ver comandos. Ej: brew commit \"mensaje\" --alias tu_nombre --beer ipa",
    tone: "muted",
  },
];

const commandHelp = [
  "brew commit \"mensaje\" --alias tu_nombre --beer ipa|stout|lager",
  "tap log               # muestra los últimos commits",
  "tap status            # resumen de pendientes/aprobados",
  "tap review            # ver pendientes",
  "tap approve <hash>    # aprobar un commit",
  "clear                 # limpia la consola",
  "about                 # info del proyecto",
];

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef<number>(initialLogs.length);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 1400);
    return () => clearTimeout(timeout);
  }, []);

  const appendLog = (entry: Omit<LogEntry, "id">) => {
    setLogs((prev) => [...prev, { id: nextId(), ...entry }]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = input.trim();
    if (!command) return;
    setInput("");
    await processCommand(command);
  };

  const processCommand = async (command: string) => {
    const prompt = `last@azulmalta:~$ ${command}`;
    appendLog({ prompt, output: "", tone: "muted" });

    const lower = command.toLowerCase();

    if (lower === "clear") {
      setLogs(initialLogs);
      return;
    }

    if (lower === "help" || lower === "brew help") {
      appendLog({
        output: ["Comandos:", ...commandHelp].join("\n"),
        tone: "muted",
      });
      return;
    }

    if (lower === "about" || lower === "azul about") {
      appendLog({
        output:
          "Last Commit by Azul Malta: mensajes cerveceros convertidos en commits. Deja el tuyo y compártelo.",
        tone: "default",
      });
      return;
    }

    if (lower === "tap status") {
      const approved = commits.filter((c) => c.status === "approved").length;
      const pending = commits.filter((c) => c.status === "pending").length;
      if (!commits.length) {
        appendLog({
          output: "Sin commits aún. Corre `brew commit \"mensaje\" --alias tu_nombre`.",
          tone: "muted",
        });
        return;
      }
      appendLog({
        output: `Commits aprobados: ${approved}\nPendientes: ${pending}\nÚltimo: ${commits[0].hash} (${commits[0].tap}) por ${commits[0].alias}`,
        tone: "success",
      });
      return;
    }

    if (lower === "tap log" || lower === "git log") {
      if (!commits.length) {
        appendLog({
          output: "Aún no hay log cervecero. Usa `brew commit` para estrenar.",
          tone: "muted",
        });
        return;
      }
      const summary = commits
        .slice(0, 6)
        .map(
          (c) =>
            `• ${c.hash} [${c.tap}] ${c.alias}: "${c.message}" (${c.status})`,
        )
        .join("\n");
      appendLog({ output: summary, tone: "default" });
      return;
    }

    if (lower === "tap review") {
      const pending = commits.filter((c) => c.status === "pending");
      if (!pending.length) {
        appendLog({ output: "No hay commits pendientes.", tone: "muted" });
        return;
      }
      const list = pending
        .map((c) => `• ${c.hash} ${c.alias}: "${c.message}" [${c.tap}]`)
        .join("\n");
      appendLog({ output: `Pendientes:\n${list}`, tone: "muted" });
      return;
    }

    const approveMatch = command.match(/^tap\s+approve\s+([a-zA-Z0-9]+)/i);
    if (approveMatch) {
      const hash = approveMatch[1];
      let found = false;
      setCommits((prev) =>
        prev.map((c) => {
          if (c.hash === hash) {
            found = true;
            return { ...c, status: "approved" };
          }
          return c;
        }),
      );
      appendLog({
        output: found ? `Commit ${hash} aprobado.` : `No encontré ${hash}.`,
        tone: found ? "success" : "error",
      });
      return;
    }

    const commitMatch = command.match(
      /^brew\s+commit\s+"([^"]+)"(?:\s+--alias\s+([^\s]+))?(?:\s+--beer\s+([^\s]+))?/i,
    );

    if (commitMatch) {
      const [, message, alias, beer] = commitMatch;
      await runCommitCommand({ message, alias, beer });
      return;
    }

    appendLog({
      output: `Comando no reconocido: ${command}\nTip: ejecuta 'help' para ver opciones.`,
      tone: "error",
    });
  };

  const runCommitCommand = async ({
    message,
    alias,
    beer,
  }: {
    message: string;
    alias?: string;
    beer?: string;
  }) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          alias: alias || undefined,
          beer: beer || undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        appendLog({
          output: payload?.error || "No pudimos fermentar este commit.",
          tone: "error",
        });
        return;
      }

      const newCommit: CommitEntry = {
        hash: payload.hash,
        message: payload.message,
        alias: payload.alias,
        tap: payload.tap,
        caption: payload.caption,
        createdAt: payload.createdAt,
        status: "pending",
        bubbleX: Math.random() * 80 + 10,
        bubbleDelay: Math.random() * 3,
      };

      setCommits((prev) => [newCommit, ...prev].slice(0, 50));

      appendLog({
        output: `commit ${newCommit.hash} (${newCommit.tap}) por ${newCommit.alias}\n"${newCommit.message}"\n→ En revisión. Usa 'tap approve ${newCommit.hash}' para publicarlo.`,
        tone: "muted",
      });
    } catch {
      appendLog({
        output: "Fallo la conexión al bar. Intenta de nuevo en unos segundos.",
        tone: "error",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 text-green-100">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]">
          <div className="flex flex-col items-center gap-4">
            <div className="beer-loader">
              <div className="beer-handle" />
              <div className="beer-glass">
                <div className="beer-glass__shine" />
                <div className="beer-foam" />
                <div className="beer-fill" />
                <div className="beer-bubbles" />
              </div>
            </div>
            <p className="text-sm uppercase tracking-[0.3em] text-green-200">
              Llenando el vaso...
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 noise-overlay opacity-80" />
      <div className="absolute inset-0 grid-overlay opacity-70" />

      <div className="relative w-full max-w-5xl overflow-hidden rounded-lg retro-window backdrop-blur crt-mask">
        <div className="window-header">
          <div className="title">
            <span>Last Commit OS</span>
          </div>
          <div className="leds">
            <span className="led ok" />
            <span className="led warn" />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0">
          {commits
            .filter((c) => c.status === "approved")
            .slice(0, 12)
            .map((c) => (
              <div
                key={c.hash}
                className="bubble-float absolute flex max-w-[220px] flex-col gap-1 rounded-full px-4 py-3 text-xs text-green-50/90"
                style={{
                  left: `${c.bubbleX ?? 10}%`,
                  top: `${10 + Math.random() * 70}%`,
                  animationDelay: `${c.bubbleDelay ?? 0}s`,
                }}
              >
                <span className="text-[10px] uppercase tracking-[0.25em] text-green-200/70">
                  {c.tap}
                </span>
                <span className="font-semibold text-green-50">{c.alias}</span>
                <span className="text-green-100/80 italic">&quot;{c.message}&quot;</span>
              </div>
            ))}
        </div>
        <div className="flex flex-col p-0">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-6 sm:p-8 border-b border-green-900/30">
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 overflow-hidden rounded-md border border-green-800/60 bg-black/60">
                <Image
                  src="/logo.png"
                  alt="Azul Malta"
                  fill
                  className="object-contain p-1"
                  sizes="48px"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-green-50 tracking-wide">
                  AZUL MALTA // LAST COMMIT
                </h1>
                <p className="text-xs text-green-300/60 tracking-wider uppercase">
                  v1.0.4-rc
                </p>
              </div>
            </div>
            <div className="text-xs text-green-500 font-mono">
              MEM: 640K OK
            </div>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex w-full items-center gap-3 rounded-none border-b border-green-900/50 bg-[#0a0f0a] px-4 py-3 focus-within:bg-[#0f140f]">
              <span className="text-green-300">last@azulmalta:~$</span>
              <input
                autoFocus
                className="w-full bg-transparent text-sm text-green-50 outline-none placeholder:text-green-800/50"
                placeholder={"brew commit \"mensaje\" --alias tu_nombre --beer ipa"}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={isProcessing}
                className="hidden"
              >
                brew
              </button>
            </div>
            <div className="hidden flex-wrap gap-2 px-4 text-xs text-green-500/80">
              {/* Hints can be hidden or moved */}
            </div>
          </form>

          <div className="h-[60vh] w-full overflow-y-auto bg-black p-4 sm:p-6 shadow-inner shadow-black/40">
            <div className="flex flex-col gap-1 text-sm leading-relaxed font-mono">
              {logs.map((entry) => (
                <div key={entry.id} className="whitespace-pre-wrap break-words">
                  {entry.prompt && (
                    <div className="text-green-300/60 mb-1">{entry.prompt}</div>
                  )}
                  {entry.output && (
                    <div
                      className={
                        entry.tone === "success"
                          ? "text-green-200"
                          : entry.tone === "error"
                            ? "text-rose-300"
                            : entry.tone === "muted"
                              ? "text-green-300/60"
                              : "text-green-100"
                      }
                    >
                      {entry.output}
                    </div>
                  )}
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
        <div className="window-footer">
          <span>SYS: AZULMALTA/CRT</span>
          <span>MEM OK · FOAM READY</span>
        </div>
      </div>
    </div>
  );
}
