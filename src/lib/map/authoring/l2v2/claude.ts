/**
 * Runs one headless Claude Code session (`claude -p --output-format json`) and
 * returns its result and exact usage. Failures (timeout, non-zero exit, no
 * JSON, an error result) reject with a SessionError; usage is never invented.
 *
 * The session runs in its own process group (POSIX), and the whole group is
 * killed on a timeout, as soon as the session exits, and if the driver itself
 * stops: no process it started can still change files after the integrity
 * guard has looked. Development tooling only.
 */
import { spawn } from "node:child_process";
import { DENIED_TOOLS, type Usage } from "./core.ts";

/** usage is null when the CLI reported none: it is never invented. */
export type SessionResult = { sessionId: string; usage: Usage | null; durationMs: number; turns: number; isError: boolean; text: string };
export class SessionError extends Error {
  readonly reason: "timeout" | "exit" | "no-json" | "error-result";
  constructor(reason: SessionError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

/**
 * killGraceMs: how long a timed-out session has after SIGTERM before its group is killed (default 5 s).
 * wrap: runs the CLI through another command (the sandbox, sandbox.ts) with exactly the given environment;
 * the wrapper leads the process group, so killing the group kills everything inside it.
 */
export type ClaudeOptions = {
  bin: string; cwd: string; timeoutMs: number; model?: string; maxBudgetUsd?: string; killGraceMs?: number;
  wrap?: (claudeArgs: string[]) => { command: string; args: string[]; env: Record<string, string> };
};

export function claudeArgs(options: ClaudeOptions, tools: readonly string[], resume?: string, denied: readonly string[] = DENIED_TOOLS): string[] {
  return [
    "-p",
    "--output-format", "json",
    // Anything not pre-approved below is denied; nothing can be approved interactively.
    "--permission-mode", "dontAsk",
    "--allowedTools", tools.join(","),
    // Denials win over any allowance: secrets, credentials and executable files.
    "--disallowedTools", denied.join(","),
    // No MCP server is ever started: only the configuration given here, which is none.
    "--strict-mcp-config",
    ...(resume ? ["--resume", resume] : []),
    ...(options.model ? ["--model", options.model] : []),
    ...(options.maxBudgetUsd ? ["--max-budget-usd", options.maxBudgetUsd] : []),
  ];
}

/** Whether process groups exist here: they do on Linux and macOS, the supported systems. */
const GROUPS = process.platform !== "win32";

export function runClaude(options: ClaudeOptions, prompt: string, tools: readonly string[], resume?: string, denied: readonly string[] = DENIED_TOOLS): Promise<SessionResult> {
  return new Promise((resolve, reject) => {
    // detached: the session leads a new process group, so its descendants can be killed with it.
    const args = claudeArgs(options, tools, resume, denied);
    const wrapped = options.wrap?.(args);
    const child = wrapped
      ? spawn(wrapped.command, wrapped.args, { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"], detached: GROUPS, env: wrapped.env as NodeJS.ProcessEnv })
      : spawn(options.bin, args, { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"], detached: GROUPS });
    /** Signals the session's whole process group; a group that is already gone is no error. */
    const killGroup = (signal: NodeJS.Signals) => {
      try {
        if (GROUPS && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch {
        // Already gone.
      }
    };
    // If the driver stops (exit, Ctrl-C, SIGTERM), the session's group goes with it, then the signal takes its usual course.
    const onExit = () => killGroup("SIGKILL");
    const onSignal = (signal: NodeJS.Signals) => {
      killGroup("SIGKILL");
      process.kill(process.pid, signal);
    };
    process.once("exit", onExit);
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    const release = () => {
      process.removeListener("exit", onExit);
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
    };
    let out = "";
    let err = "";
    let timedOut = false;
    // SIGTERM first, then SIGKILL for a group that has not ended; cancelled once the session has closed, so it never signals a reused group id.
    let escalation: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGTERM");
      escalation = setTimeout(() => killGroup("SIGKILL"), options.killGraceMs ?? 5000);
      escalation.unref();
    }, options.timeoutMs);
    const settle = () => {
      clearTimeout(timer);
      clearTimeout(escalation);
      release();
    };
    // Once the session itself has exited, nothing it started may outlive it.
    child.on("exit", () => killGroup("SIGKILL"));
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", (error) => {
      settle();
      reject(new SessionError("exit", `could not start ${options.bin}: ${error.message}`));
    });
    child.on("close", (code) => {
      settle();
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
