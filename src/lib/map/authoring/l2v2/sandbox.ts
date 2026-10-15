/**
 * MAP L2 v2: every live session runs in an operating-system sandbox
 * (bubblewrap, Linux), because the CLI's own permission rules are not a
 * security boundary: a live test showed Claude Code running a shell command
 * its allow list did not grant (docs/map-authoring/l2-pipeline-v2.md).
 *
 * A session sees only:
 * - the project's sources, docs and scripts, read-only, with secret-like
 *   files masked;
 * - its own pack, read-only;
 * - one empty writable directory for its output (and, for the plan session,
 *   a writable copy of the group files);
 * - the runtime (`/usr`, a few files of `/etc`) and a private CLI config dir.
 *
 * It has no network: everything goes through the driver's egress server
 * (egress.ts). API calls go to its relay, which adds the real token outside
 * the sandbox: inside there is only a placeholder, so no process in the
 * sandbox, shell commands included, can read the credential. Each session
 * chain (a session and its resumptions) has its own CLI config dir, so no
 * session sees another's transcripts or settings. Output is read back only after
 * the sandbox has exited, and only what the session may write; the driver
 * writes it to the tree once its integrity checks pass. Nothing falls back to
 * an unsandboxed session: if the sandbox cannot be set up, no session starts.
 * Development tooling only.
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { runClaude, type SessionResult } from "./claude.ts";
import type { Role } from "./core.ts";
import { startEgressProxy } from "./egress.ts";

export type SandboxConfig = {
  /** The repository checkout (host). */
  root: string;
  bwrap: string;
  /** The CLI binary (host path); its directory is mounted read-only. */
  claude: string;
  /** A file holding a dedicated `claude setup-token` token, mode 0600: used by the relay outside the sandbox, never given to a session. */
  tokenFile: string;
  /** `host:port` pairs CONNECT tunnels may reach. */
  egress: readonly string[];
  /** The API relay: the upstream (the Anthropic API) and the path prefixes it forwards. */
  relay: { upstream: string; paths: readonly string[] };
  /** Host directory of the per-session-chain CLI config dirs (transcripts, for --resume). */
  configRoot: string;
  /** The launcher run inside the sandbox (scripts/l2v2/sandbox-launch.mjs). */
  launcher: string;
};
/** Repository-relative paths: the session's pack, its output file, and the one tree file it may edit (the plan's group file). */
export type SessionFiles = { pack: string; out?: string; editable?: string };
export type SessionOutcome = SessionResult & {
  /** Files the session wrote, read back after it exited: the driver writes them only once its checks pass. */
  outputs?: { path: string; data: Buffer }[];
  /** Writes the session may not make: none of its output is used. */
  violations?: string[];
  /** Connections the egress proxy refused. */
  egressDenied?: string[];
};

/** The project paths a session can read: nothing else of the checkout (no .git, run state, env files or other worktrees). */
export const PROJECT_MOUNTS = ["src", "docs", "scripts", "package.json"] as const;
/** Files masked even inside the readable paths. */
const SECRET_FILE = /(^|\/)(\.env[^/]*|\.dev\.vars[^/]*|[^/]*\.pem|[^/]*\.key|\.npmrc|\.netrc|id_(rsa|dsa|ecdsa|ed25519)[^/]*)$/;
/** What the runtime needs from /etc (certificates, users, time): not the rest. */
const ETC = ["/etc/ssl", "/etc/ca-certificates", "/etc/pki", "/etc/passwd", "/etc/group", "/etc/nsswitch.conf", "/etc/hosts", "/etc/localtime"];
const PORT = 18080;
/** What the CLI inside the sandbox holds instead of the token; the relay replaces it. Not a credential. */
export const PLACEHOLDER_TOKEN = "sk-ant-oat01-l2v2-sandbox-placeholder-not-a-credential";
/** A session id as the CLI reports it, before it names a directory. */
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/;
const MAX_OUTPUT = 4 * 1024 * 1024;
const SOCKET = "/run/l2v2-egress.sock";

/** Secret-like files inside the readable project paths, to mask with an empty file. */
export function secretMasks(root: string): string[] {
  const masks: string[] = [];
  const walk = (rel: string) => {
    const stat = lstatSync(join(root, rel), { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isDirectory()) {
      if (basename(rel) === "node_modules" || basename(rel) === ".git") return;
      for (const name of readdirSync(join(root, rel))) walk(`${rel}/${name}`);
    } else if (SECRET_FILE.test(rel)) masks.push(rel);
  };
  for (const path of PROJECT_MOUNTS) walk(path);
  return masks.sort();
}

export type SandboxPlan = {
  root: string; masks: readonly string[]; files: SessionFiles;
  /** Host temp dir mounted writable at the batch dir: the only place the session can write. */
  outDir: string;
  /** Host temp copy of the group files (the plan session only). */
  groupsCopy?: string;
  claude: string; launcher: string; node: string; configDir: string; socket: string;
  /** Where node and npm are installed (the prefix holding bin/node): mounted read-only unless it is /usr. */
  nodePrefix?: string;
  /** The host's /bin, /lib… layout (rootLayout()). */
  layout?: readonly string[];
  claudeArgs: readonly string[];
};
/**
 * The host's own root layout for the runtime: /bin, /sbin, /lib, /lib64 and
 * /lib32 as links where they are links (merged /usr: Arch, Ubuntu…) and
 * read-only directories where they are not, so binaries find their loader.
 */
export function rootLayout(): string[] {
  return ["/bin", "/sbin", "/lib", "/lib64", "/lib32"].flatMap((path) => {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (!stat) return [];
    return stat.isSymbolicLink() ? ["--symlink", readlinkSync(path), path] : ["--ro-bind", path, path];
  });
}
/** The installation prefix of the running node (…/bin/node → …). */
export const nodePrefix = () => dirname(dirname(realpathSync(process.execPath)));

/** The bubblewrap command line for one session (pure). */
export function sandboxArgs(plan: SandboxPlan): string[] {
  const work = (rel: string) => `/work/${rel}`;
  const batchDir = dirname(plan.files.pack);
  return [
    // New user, mount, pid, ipc, uts, cgroup and network namespaces; killed with its parent; no controlling terminal.
    "--unshare-all", "--die-with-parent", "--new-session",
    "--ro-bind", "/usr", "/usr", ...(plan.layout ?? rootLayout()),
    ...ETC.flatMap((path) => ["--ro-bind-try", path, path]),
    "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--tmpfs", "/home/sandbox", "--dir", "/run",
    // The project, read-only, built path by path on an empty /work.
    "--tmpfs", "/work",
    ...PROJECT_MOUNTS.flatMap((path) => ["--ro-bind-try", join(plan.root, path), work(path)]),
    ...(plan.groupsCopy && plan.files.editable ? ["--bind", plan.groupsCopy, work(dirname(plan.files.editable))] : []),
    ...plan.masks.flatMap((path) => ["--ro-bind", "/dev/null", work(path)]),
    "--bind", plan.outDir, work(batchDir),
    "--ro-bind", join(plan.root, plan.files.pack), work(plan.files.pack),
    "--remount-ro", "/work",
    "--bind", plan.configDir, "/cfg",
    "--ro-bind", dirname(plan.claude), "/opt/claude",
    "--ro-bind", plan.launcher, "/opt/l2v2/sandbox-launch.mjs",
    "--ro-bind", plan.node, "/opt/l2v2/node",
    ...(plan.nodePrefix && plan.nodePrefix !== "/usr" ? ["--ro-bind", plan.nodePrefix, "/opt/node"] : []),
    "--bind", plan.socket, SOCKET,
    "--chdir", "/work",
    "/opt/l2v2/node", "/opt/l2v2/sandbox-launch.mjs", SOCKET, String(PORT), `/opt/claude/${basename(plan.claude)}`, ...plan.claudeArgs,
  ];
}

/**
 * The sandbox's whole environment: nothing of the driver's and no
 * credential. The CLI sends its API calls to the relay (`ANTHROPIC_BASE_URL`)
 * with the placeholder, which the relay replaces with the real token outside;
 * anything else leaves only by CONNECT, through the same server.
 */
export const sandboxEnv = (prefix = "/usr"): Record<string, string> => ({
  PATH: prefix === "/usr" ? "/usr/bin" : "/opt/node/bin:/usr/bin", HOME: "/home/sandbox", USER: "sandbox", LANG: "C.UTF-8", CLAUDE_CONFIG_DIR: "/cfg",
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${PORT}`, CLAUDE_CODE_OAUTH_TOKEN: PLACEHOLDER_TOKEN,
  HTTPS_PROXY: `http://127.0.0.1:${PORT}`, HTTP_PROXY: `http://127.0.0.1:${PORT}`, https_proxy: `http://127.0.0.1:${PORT}`, http_proxy: `http://127.0.0.1:${PORT}`,
  // The relay is reached directly, never through the proxy settings.
  NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", DISABLE_AUTOUPDATER: "1", DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1",
});

/** The token, or why it may not be used: a regular, non-empty file no one else can read. */
function readToken(file: string): { token?: string; problem?: string } {
  const stat = statSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile()) return { problem: `no token file at ${file}: create one with \`claude setup-token\` (a dedicated token, never the general credential store)` };
  if (stat.mode & 0o077) return { problem: `${file} is readable by others: chmod 600 it` };
  const token = readFileSync(file, "utf8").trim();
  return token && !/\s/.test(token) ? { token } : { problem: `${file} must hold the token alone` };
}

/**
 * Why no session may start; [] when the sandbox can be set up. Fail closed:
 * Linux, bubblewrap working (user namespaces), the CLI, node and npm in place,
 * and the dedicated token.
 */
export function sandboxProblems(config: SandboxConfig): string[] {
  if (process.platform !== "linux") return ["the session sandbox needs Linux (bubblewrap)"];
  const problems: string[] = [];
  const version = spawnSync(config.bwrap, ["--version"], { encoding: "utf8" });
  if (version.status !== 0) return [`bubblewrap is not available at ${config.bwrap}`];
  const prefix = nodePrefix();
  for (const [path, what] of [[config.claude, "the Claude CLI"], [config.launcher, "the sandbox launcher"], [join(prefix, "bin/npm"), "npm beside node"], [join(prefix, "bin/node"), "node"]] as const)
    if (!existsSync(path)) problems.push(`${what} is missing (${path})`);
  const probe = spawnSync(config.bwrap, ["--unshare-all", "--die-with-parent", "--new-session", "--ro-bind", "/usr", "/usr", ...rootLayout(), "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/work", "--remount-ro", "/work", "/usr/bin/true"], { encoding: "utf8" });
  if (probe.status !== 0) problems.push(`bubblewrap cannot create the sandbox (unprivileged user namespaces?): ${(probe.stderr ?? "").trim().slice(0, 200)}`);
  const token = readToken(config.tokenFile);
  if (token.problem) problems.push(token.problem);
  return problems;
}

/** The token, once sandboxProblems has passed. */
export const sandboxToken = (config: SandboxConfig) => {
  const { token, problem } = readToken(config.tokenFile);
  if (!token) throw new Error(problem);
  return token;
};

/**
 * A session chain's CLI config dir, reset before each of its sessions: only
 * the transcripts (for --resume) survive; settings, hooks, MCP servers,
 * plugins, shell snapshots and global state a session could have planted are
 * removed.
 */
export function sanitizeConfigDir(dir: string) {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) if (name !== "projects") rmSync(join(dir, name), { recursive: true, force: true });
  writeFileSync(join(dir, "settings.json"), "{}\n");
}

/**
 * What the session wrote, read after it exited: its output file in its
 * writable directory, and for the plan session its group file. Anything else
 * (another name, a link, a directory, an oversized file, a change to another
 * group's file) is a violation, and nothing of the session is used.
 */
export function collectOutputs(root: string, files: SessionFiles, outDir: string, groupsCopy?: string): { outputs: { path: string; data: Buffer }[]; violations: string[] } {
  const outputs: { path: string; data: Buffer }[] = [];
  const violations: string[] = [];
  const batchDir = dirname(files.pack);
  const regular = (path: string, rel: string) => {
    const stat = lstatSync(path);
    if (!stat.isFile()) violations.push(`${rel}: not a regular file`);
    else if (stat.size > MAX_OUTPUT) violations.push(`${rel}: larger than ${MAX_OUTPUT} bytes`);
    else return true;
    return false;
  };
  for (const name of readdirSync(outDir)) {
    const rel = `${batchDir}/${name}`;
    // The pack's mount point, created empty by the sandbox.
    if (rel === files.pack) {
      if (!lstatSync(join(outDir, name)).isFile() || lstatSync(join(outDir, name)).size !== 0) violations.push(`${rel}: the pack's mount point was changed`);
    } else if (rel !== files.out) violations.push(`${rel}: not the session's output`);
    else if (regular(join(outDir, name), rel)) outputs.push({ path: rel, data: readFileSync(join(outDir, name)) });
  }
  if (groupsCopy && files.editable) {
    const dir = dirname(files.editable);
    const names = new Set([...readdirSync(join(root, dir)), ...readdirSync(groupsCopy)]);
    for (const name of names) {
      const rel = `${dir}/${name}`;
      const copy = join(groupsCopy, name);
      if (!existsSync(copy) || !lstatSync(copy).isFile()) {
        violations.push(`${rel}: removed or replaced`);
        continue;
      }
      const data = readFileSync(copy);
      const original = existsSync(join(root, rel)) ? readFileSync(join(root, rel)) : undefined;
      if (original?.equals(data)) continue;
      if (rel === files.editable && regular(copy, rel)) outputs.push({ path: rel, data });
      else if (rel !== files.editable) violations.push(`${rel}: another group's file`);
    }
  }
  return { outputs, violations };
}

export type SandboxedRequest = {
  role: Role; prompt: string; resume?: string; tools: readonly string[]; denied: readonly string[]; files: SessionFiles;
  timeoutMs: number; model?: string; maxBudgetUsd?: string;
};
/**
 * One session in the sandbox. Refuses before anything starts when the
 * sandbox cannot be set up; the staging dirs are removed once the outputs are
 * read.
 */
export async function runSandboxed(config: SandboxConfig, request: SandboxedRequest): Promise<SessionOutcome> {
  const problems = sandboxProblems(config);
  if (problems.length) throw new Error(`the session sandbox cannot be set up (no session started): ${problems.join("; ")}`);
  const token = sandboxToken(config);
  // A new chain starts in a fresh config dir; a resumption gets exactly its chain's dir, named by the session id.
  if (request.resume && !SESSION_ID.test(request.resume)) throw new Error(`not a session id: ${JSON.stringify(request.resume)}`);
  const configDir = join(config.configRoot, request.resume ?? `new-${randomUUID()}`);
  if (request.resume && !existsSync(configDir)) throw new Error(`no transcript for session ${request.resume}: it cannot be resumed`);
  sanitizeConfigDir(configDir);
  const staging = mkdtempSync(join(tmpdir(), "l2v2-sbx-"));
  const socket = join(staging, "egress.sock");
  if (socket.length > 100) throw new Error(`the egress socket path is too long (${socket}): set TMPDIR to a shorter directory`);
  const outDir = join(staging, "out");
  mkdirSync(outDir);
  let groupsCopy: string | undefined;
  if (request.files.editable) {
    groupsCopy = join(staging, "groups");
    mkdirSync(groupsCopy);
    const dir = join(config.root, dirname(request.files.editable));
    for (const name of readdirSync(dir)) if (lstatSync(join(dir, name)).isFile()) copyFileSync(join(dir, name), join(groupsCopy, name));
  }
  const proxy = await startEgressProxy(socket, config.egress, { ...config.relay, token });
  let result: SessionResult;
  try {
    const claude = realpathSync(config.claude);
    const prefix = nodePrefix();
    result = await runClaude(
      {
        bin: claude, cwd: config.root, timeoutMs: request.timeoutMs, model: request.model, maxBudgetUsd: request.maxBudgetUsd,
        wrap: (claudeArgs) => ({
          command: config.bwrap,
          args: sandboxArgs({ root: config.root, masks: secretMasks(config.root), files: request.files, outDir, groupsCopy, claude, launcher: config.launcher, node: process.execPath, nodePrefix: prefix, configDir, socket, claudeArgs }),
          env: sandboxEnv(prefix),
        }),
      },
      request.prompt, request.tools, request.resume, request.denied,
    );
  } catch (error) {
    if (!request.resume) rmSync(configDir, { recursive: true, force: true });
    await proxy.close();
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  try {
    const collected = collectOutputs(config.root, request.files, outDir, groupsCopy);
    // The chain's dir takes the id the CLI reported, so the next resumption finds its transcripts and nothing else.
    if (!SESSION_ID.test(result.sessionId)) throw new Error(`the CLI reported an invalid session id ${JSON.stringify(result.sessionId)}`);
    const named = join(config.configRoot, result.sessionId);
    if (named !== configDir) {
      if (existsSync(named)) throw new Error(`session id ${result.sessionId} is already in use: its transcripts are never shared`);
      renameSync(configDir, named);
    }
    return { ...result, ...collected, egressDenied: [...proxy.denied] };
  } finally {
    await proxy.close();
    rmSync(staging, { recursive: true, force: true });
  }
}
