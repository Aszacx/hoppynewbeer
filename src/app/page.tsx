"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

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

// Se llenan en cliente para evitar mismatch de SSR (fecha dinámica)
const initialLogs: LogEntry[] = [];

const commandHelp = [
  "brew commit \"message\" --alias username",
  "tap log               # muestra los últimos commits",
  "tap status            # resumen de pendientes/aprobados",
  "tap review            # ver pendientes",
  "tap approve <hash> <secret> # aprobar un commit (admin)",
  "refill                # reiniciar animación de burbujas",
  "clear                 # limpia la consola",
  "about                 # info del proyecto",
];

export default function Home() {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bubblesKey, setBubblesKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const idRef = useRef<number>(initialLogs.length);

  const refreshCommits = async () => {
    try {
      const res = await fetch("/api/commit");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCommits(data);
      }
    } catch {
      // Silent fail; no-op
    }
  };

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Reinicia animación cuando llegan commits aprobados
  useEffect(() => {
    if (commits.some((c) => c.status === "approved")) {
      setBubblesKey((prev) => prev + 1);
    }
  }, [commits]);

  useEffect(() => {
    // Mensajes iniciales en cliente para evitar mismatch de SSR
    const welcomeLogs: LogEntry[] = [
      {
        id: 1,
        output: `Last login: ${new Date().toDateString()} on console\nWelcome to Choco-Mint Commit terminal.`,
        tone: "default",
      },
      {
        id: 2,
        output:
          "Closing the year? Reviewing the brew? Commit your thoughts.\nRun `brew commit \"message\" --alias username` to leave your mark.",
        tone: "muted",
      },
    ];
    setLogs(welcomeLogs);
    idRef.current = welcomeLogs.length;
    setHasHydrated(true);

    // Detectar ancho para placeholder en mobile
    const detect = () => setIsMobile(window.innerWidth < 640);
    detect();
    window.addEventListener("resize", detect);

    // Cargar commits iniciales
    refreshCommits();

    const timeout = setTimeout(() => setIsLoading(false), 2200);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", detect);
    };
  }, []);

  // Enfocar input cuando termina el loader o al montar
  useEffect(() => {
    if (!isLoading) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [isLoading]);

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
    const prompt = `root@azulmalta:~$ ${command}`;
    appendLog({ prompt, output: "", tone: "muted" });

    const lower = command.toLowerCase();

    if (lower === "clear") {
      setLogs(initialLogs);
      return;
    }

    if (lower === "refill" || lower === "pour again") {
      setBubblesKey((prev) => prev + 1);
      appendLog({
        output: "🍺 Sirviendo otra ronda de burbujas...",
        tone: "success",
      });
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
        .map((c) => `• ${c.hash} [${c.tap}] ${c.alias} (${c.status})`)
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
        .map((c) => `• ${c.hash} ${c.alias} [${c.tap}] (En moderación)`)
        .join("\n");
      appendLog({ output: `Pendientes:\n${list}`, tone: "muted" });
      return;
    }

    const approveMatch = command.match(/^tap\s+approve\s+([a-zA-Z0-9]+)(?:\s+(.+))?/i);
    if (approveMatch) {
      const hash = approveMatch[1];
      const secret = approveMatch[2]; // Capturar el secreto si se pasa inline

      if (!hash || hash.length < 3) {
        appendLog({
          output: "Hash inválido. Usa: tap approve <hash> <secret>\nTip: escribe 'help' para más comandos.",
          tone: "error",
        });
        return;
      }

      if (!secret) {
        appendLog({
          output: `⚠️ Se requiere secreto de administrador.\nUso: tap approve ${hash} <tu_secreto>`,
          tone: "error",
        });
        return;
      }

      setIsProcessing(true);
      try {
        const response = await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash, secret }),
        });

        const data = await response.json();

        if (response.ok) {
        await refreshCommits();
        setBubblesKey((prev) => prev + 1);
          appendLog({
            output: `✅ Commit ${hash} aprobado y publicado exitosamente.`,
            tone: "success",
          });
        } else {
          appendLog({
            output: `❌ Error: ${data.error || "No se pudo aprobar."}`,
            tone: "error",
          });
        }
      } catch {
        appendLog({
          output: "Error de conexión al intentar aprobar.",
          tone: "error",
        });
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    const commitMatch = command.match(
      /^brew\s+commit\s+"([^"]+)"(?:\s+--alias\s+([^\s]+))?/i,
    );

    if (commitMatch) {
      const [, messageRaw, aliasRaw] = commitMatch;
      const message = (messageRaw || "").trim();
      const alias = (aliasRaw || "").trim();

      if (!message) {
        appendLog({
          output:
            "Falta el message. Usa: brew commit \"message\" --alias username\nTip: escribe 'help' para más comandos.",
          tone: "error",
        });
        return;
      }

      if (!alias) {
        appendLog({
          output:
            "Falta el alias. Usa: brew commit \"message\" --alias username\nTip: escribe 'help' para más comandos.",
          tone: "error",
        });
        return;
      }

      // Fixed beer style for Choco-Mint Commit
      await runCommitCommand({ message, alias, beer: "choco-mint" });
      return;
    }

    // Si el usuario intentó brew commit pero sin formato válido
    if (command.toLowerCase().startsWith("brew commit")) {
      appendLog({
        output:
          "Formato inválido. Usa: brew commit \"message\" --alias username\nTip: escribe 'help' para más comandos.",
        tone: "error",
      });
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
        output: `commit ${newCommit.hash} en revisión. Usa 'tap approve ${newCommit.hash} <secret>' para publicarlo.`,
        tone: "muted",
      });

      // Refrescar desde origen para asegurar que el hash mostrado coincida con el archivo remoto
      await refreshCommits();
      setBubblesKey((prev) => prev + 1);
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
              Pouring the beer...
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 noise-overlay opacity-80" />
      <div className="absolute inset-0 grid-overlay opacity-70" />

      {hasHydrated && (
        <div className="absolute inset-0 overflow-hidden z-30">
          {commits
            .filter((c) => c.status === "approved")
            .map((c, i) => {
              const left = c.bubbleX ?? Math.random() * 85 + 5;
              const delay = (c.bubbleDelay ?? Math.random() * 2) + i * 0.5;
              const dur = 18 + Math.random() * 10;
              return (
              <motion.div
                key={`${c.hash}-${bubblesKey}`}
                whileHover={{ scale: 1.08, zIndex: 50 }}
                whileTap={{
                  scale: [1, 1.18, 0.7, 0],
                  opacity: [1, 1, 0.5, 0],
                  filter: ["blur(0px)", "blur(1px)", "blur(4px)", "blur(8px)"],
                  transition: { duration: 0.5, ease: "easeOut" },
                }}
                style={{
                  left: `${left}%`,
                  top: 0,
                  pointerEvents: "auto",
                  touchAction: "none",
                  willChange: "transform",
                }}
                initial={{ y: "110vh", opacity: 0, scale: 1 }}
                animate={{
                  y: ["110vh", "-150vh"],
                  opacity: [0, 1, 1, 0],
                  scale: 1,
                }}
                transition={{
                  duration: dur,
                  ease: "linear",
                  delay,
                  repeat: Infinity,
                  repeatType: "loop",
                  repeatDelay: 0,
                  y: { times: [0, 1] },
                  opacity: { times: [0, 0.05, 0.9, 1] },
                }}
                className="bubble-float pointer-events-auto"
              >
                <div className="bubble-content">
                  <span className="bubble-message" title={c.message}>
                    &quot;{c.message}&quot;
                  </span>
                  <span className="bubble-alias">- {c.alias}</span>
                </div>
              </motion.div>
              );
            })}
        </div>
      )}

      <div className="relative w-full max-w-5xl overflow-hidden rounded-lg retro-window backdrop-blur crt-mask">
        <div className="window-header">
          <div className="traffic-lights">
            <span className="traffic-light close" />
            <span className="traffic-light minimize" />
            <span className="traffic-light maximize" />
          </div>
          <div className="title">
            <span>root@azulmalta: ~</span>
          </div>
        </div>

        <div className="flex flex-col p-0">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-6 sm:p-8 border-b border-green-900/30 relative overflow-hidden">
            {/* Christmas lights string */}
            <div className="absolute top-0 left-0 w-full h-3 flex justify-around px-2 pointer-events-none z-10">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-2 rounded-full shadow-[0_0_8px_current] animate-pulse ${
                    i % 3 === 0
                      ? "bg-red-500 text-red-500"
                      : i % 3 === 1
                        ? "bg-green-400 text-green-400"
                        : "bg-yellow-300 text-yellow-300"
                  }`}
                  style={{ animationDelay: `${i * 0.2}s`, opacity: 0.8 }}
                />
              ))}
            </div>

          <div className="flex items-center gap-4 relative z-20">
            <div className="relative h-14 w-36 overflow-hidden rounded-md border-2 border-green-500/70 bg-black/60 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Azul Malta Logo"
                  fill
                  className="object-contain p-1"
                  sizes="128px"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-green-50 tracking-wide flex items-center gap-2">
                  AZUL MALTA <span className="text-xs text-red-400">☃</span>
                </h1>
                <p className="text-xs text-green-300/60 tracking-wider uppercase">
                  v1.0.26
                </p>
              </div>
            </div>
            <div className="text-xs text-green-500 font-mono flex gap-3">
              <span>MEM: 640K OK</span>
              <span className="text-red-400">TEMP: -2°C</span>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex w-full items-center gap-3 rounded-none border-b border-green-900/50 bg-[#0a0f0a] px-4 py-3 focus-within:bg-[#0f140f]">
              <span className="text-green-300">root@azulmalta:~$</span>
              <input
                autoFocus
                ref={inputRef}
                className="w-full bg-transparent text-sm text-green-50 outline-none placeholder:text-green-800/50"
                placeholder={isMobile ? "$" : "brew commit \"message\" --alias username"}
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
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-green-500/80 px-3 py-2">
              <span className="text-green-400/90 pr-3 uppercase tracking-[0.18em]">Suggested commands:</span>
              <span className="rounded-full border border-green-700/60 bg-[#0f140f]/80 px-3 py-1">
                brew commit &quot;message&quot; --alias username
              </span>
              <span className="rounded-full border border-green-700/60 bg-[#0f140f]/80 px-3 py-1">
                tap log
              </span>
              <span className="rounded-full border border-green-700/60 bg-[#0f140f]/80 px-3 py-1">
                help
              </span>
            </div>
          </form>

          <div className="h-[60vh] w-full overflow-y-auto bg-black p-4 sm:p-6 shadow-inner shadow-black/40 font-mono text-sm leading-relaxed">
            {/* Historial de Commits aprobados al inicio (sin mostrar mensajes) */}
            {commits.filter((c) => c.status === "approved").length > 0 && logs.length <= 2 && (
               <div className="mb-4 pb-4 border-b border-green-900/30">
                 <div className="text-green-300/50 mb-2">--- Historial Reciente ---</div>
                 {commits
                   .filter((c) => c.status === "approved")
                   .slice(0, 8)
                   .map((c) => (
                   <div key={c.hash} className="text-green-100/80 mb-1">
                     <span className="text-yellow-500/80">[{c.hash}]</span>{" "}
                     <span className="text-blue-300/80">({c.tap})</span>{" "}
                     <span className="text-green-50">{c.alias}</span>
                   </div>
                 ))}
                 <div className="text-green-300/50 mt-2">------------------------</div>
               </div>
            )}

            <div className="flex flex-col gap-1">
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
