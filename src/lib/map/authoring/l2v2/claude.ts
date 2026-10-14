/**
 * Runs one headless Claude Code session (`claude -p --output-format json`) and
 * returns its result and exact usage. Failures (timeout, non-zero exit, no
 * JSON, an error result) reject with a SessionError; usage is never invented.
 * Development tooling only.
 */
import { spawn } from "node:child_process";
import type { Usage } from "./core.ts";

/** usage is null when the CLI reported none: it is never invented. */
export type SessionResult = { sessionId: string; usage: Usage | null; durationMs: number; turns: number; isError: boolean; text: string };
export class SessionError extends Error {
  readonly reason: "timeout" | "exit" | "no-json" | "error-result";
  constructor(reason: SessionError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

export type ClaudeOptions = { bin: string; cwd: string; timeoutMs: number; model?: string; maxBudgetUsd?: string };

export function claudeArgs(options: ClaudeOptions, tools: readonly string[], resume?: string): string[] {
  return [
    "-p",
    "--output-format", "json",
    // Anything not pre-approved below is denied; nothing can be approved interactively.
    "--permission-mode", "dontAsk",
    "--allowedTools", tools.join(","),
    ...(resume ? ["--resume", resume] : []),
    ...(options.model ? ["--model", options.model] : []),
    ...(options.maxBudgetUsd ? ["--max-budget-usd", options.maxBudgetUsd] : []),
  ];
}

export function runClaude(options: ClaudeOptions, prompt: string, tools: readonly string[], resume?: string): Promise<SessionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.bin, claudeArgs(options, tools, resume), { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new SessionError("exit", `could not start ${options.bin}: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return reject(new SessionError("timeout", `session exceeded ${options.timeoutMs} ms and was stopped`));
      let parsed: { session_id?: string; usage?: Partial<Usage>; duration_ms?: number; num_turns?: number; is_error?: boolean; result?: string; subtype?: string };
      try {
        parsed = JSON.parse(out);
      } catch {
        return reject(new SessionError(code === 0 ? "no-json" : "exit", `no JSON result (exit ${code}; a usage limit, perhaps): ${(out || err).slice(0, 300)}`));
      }
      if (!parsed.session_id) return reject(new SessionError("no-json", "the result has no session_id"));
      if (parsed.is_error) return reject(new SessionError("error-result", `the session ended in an error (${parsed.subtype ?? "unknown"}): ${(parsed.result ?? "").slice(0, 300)}`));
      const u = parsed.usage;
      resolve({
        sessionId: parsed.session_id,
        usage: u ? { input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0, cache_read_input_tokens: u.cache_read_input_tokens ?? 0 } : null,
        durationMs: parsed.duration_ms ?? 0,
        turns: parsed.num_turns ?? 0,
        isError: false,
        text: parsed.result ?? "",
      });
    });
    child.stdin.end(prompt);
  });
}
