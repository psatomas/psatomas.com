import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer, request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { connect, createServer } from "node:net";
import { homedir, networkInterfaces, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { startEgressProxy } from "./egress.ts";
import { PLACEHOLDER_TOKEN, runSandboxed, SANDBOX_SHELL, sandboxArgs, sandboxEnv, sandboxProblems, sanitizeConfigDir, secretMasks, type SandboxConfig } from "./sandbox.ts";

const LAUNCHER = join(import.meta.dirname, "../../../../../scripts/l2v2/sandbox-launch.mjs");
const TOKEN = "test-token-not-real";
const put = (root: string, rel: string, text: string) => (mkdirSync(dirname(join(root, rel)), { recursive: true }), writeFileSync(join(root, rel), text));
const tokenFile = (mode = 0o600) => {
  const file = join(mkdtempSync(join(tmpdir(), "l2v2-token-")), "token");
  writeFileSync(file, `${TOKEN}\n`, { mode });
  chmodSync(file, mode);
  return file;
};
const PACK = ".map-authoring/l2v2/s/g/pack.md";
const OUT = ".map-authoring/l2v2/s/g/draft.json";
const GROUPS = "src/lib/map/authoring/l2/groups";
type Listening = { listen(port: number, host: string, cb: () => void): unknown; address(): unknown; once(event: "error", cb: (e: Error) => void): unknown };
const listen = (server: Listening, host = "127.0.0.1") =>
  new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => resolve((server.address() as { port: number }).port));
  });

/** A synthetic checkout: sources, docs, scripts (with the network probes), a fake env file inside src, and outside the readable paths .git, .dev.vars and run state. */
function checkout() {
  const root = mkdtempSync(join(tmpdir(), "l2v2-sbx-root-"));
  put(root, "src/lib/map/data.ts", "export const x = 1;\n");
  put(root, "src/.env.local", "FAKE=fake-env-secret-0003\n");
  put(root, `${GROUPS}/g.json`, '{"g":1}\n');
  put(root, `${GROUPS}/other.json`, '{"o":1}\n');
  put(root, "docs/readme.md", "docs\n");
  put(root, "package.json", "{}\n");
  // Each probe exits 0 when it got through.
  put(root, "scripts/probe-dns.mjs", "import { lookup } from 'node:dns'; lookup(process.argv[2], (e) => process.exit(e ? 1 : 0)); setTimeout(() => process.exit(1), 3000);\n");
  put(root, "scripts/probe-direct.mjs", "import { connect } from 'node:net'; const s = connect(Number(process.argv[3]), process.argv[2]); s.on('connect', () => process.exit(0)); s.on('error', () => process.exit(1)); setTimeout(() => process.exit(1), 2000);\n");
  put(root, "scripts/probe-raw.mjs", "import { connect } from 'node:net'; const s = connect(18080, '127.0.0.1', () => s.write(process.argv[2].replaceAll('|', '\\r\\n') + '\\r\\n\\r\\n')); s.on('data', (d) => { process.stdout.write(d); process.exit(d.toString().startsWith(process.argv[3]) ? 0 : 1); }); s.on('error', () => process.exit(1)); setTimeout(() => process.exit(1), 3000);\n");
  put(root, "scripts/probe-follow.mjs", "fetch('http://127.0.0.1:18080' + process.argv[2], { redirect: 'follow' }).then((r) => process.exit(r.status === 200 ? 0 : 1), () => process.exit(1)); setTimeout(() => process.exit(1), 3000);\n");
  put(root, ".dev.vars", "FAKE_SECRET=fake-dev-vars-0004\n");
  put(root, ".map-authoring/campaign.json", '{"synthetic":true}\n');
  put(root, PACK, "# pack\n");
  put(root, ".map-authoring/l2v2/s/g/state.json", "{}\n");
  spawnSync("git", ["init", "-q"], { cwd: root });
  const outside = mkdtempSync(join(tmpdir(), "l2v2-host-"));
  put(outside, "host-secret.txt", "HOST-SECRET-0005\n");
  return { root, outside };
}
/** A stand-in for the Claude CLI, run inside the sandbox in its place: a fresh session id, or the resumed one. */
function fakeCli(body: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "l2v2-cli-")), "claude");
  writeFileSync(file, `#!/bin/sh\ncat > /dev/null\nid=$(cat /proc/sys/kernel/random/uuid); prev=; for a; do [ "$prev" = --resume ] && id=$a; prev=$a; done\n${body}\nprintf '{"session_id":"%s","result":"done","num_turns":1,"duration_ms":1}\\n' "$id"\n`);
  chmodSync(file, 0o755);
  return file;
}
const config = (root: string, claude: string, extra: Partial<SandboxConfig> = {}): SandboxConfig => ({
  root, bwrap: process.env.L2V2_BWRAP ?? "bwrap", claude, tokenFile: tokenFile(), egress: [], relay: { upstream: "http://127.0.0.1:9", paths: ["/v1/"] }, configRoot: join(root, ".map-authoring/l2v2/sandbox"), launcher: LAUNCHER, ...extra,
});
const request = (files: { pack: string; out?: string; editable?: string } = { pack: PACK, out: OUT }, resume?: string) => ({ role: "draft" as const, prompt: "p", tools: [], denied: [], files, timeoutMs: 30_000, resume });

const PROBLEMS = sandboxProblems(config(tmpdir(), process.execPath));
/** Never run unsandboxed: skipped where the sandbox cannot exist, unless L2V2_REQUIRE_SANDBOX=1 (Linux CI), where they run and fail. */
const NO_SANDBOX = process.env.L2V2_REQUIRE_SANDBOX !== "1" && PROBLEMS.length ? `the session sandbox is unavailable here: ${PROBLEMS[0]}` : false;

/** A stand-in for the Anthropic API: records what reached it; /v1/redirect sends the client elsewhere. */
async function fakeApi(redirectTo?: string) {
  const seen: { path: string; headers: IncomingHttpHeaders; body: string }[] = [];
  const server = createHttpServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ path: req.url ?? "", headers: req.headers, body });
      if (req.url === "/v1/redirect") return res.writeHead(302, { location: redirectTo ?? "http://localhost:1/" }).end();
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write("data: one\n\n");
      setTimeout(() => res.end("data: two\n\n"), 20);
    });
  });
  const port = await listen(server);
  return { seen, port, close: () => (server.closeAllConnections(), server.close()) };
}
/** A server that must never be reached unless allowed: it counts every connection. */
async function counted(host = "127.0.0.1") {
  const hits = { n: 0 };
  const server = createServer((socket) => (hits.n++, socket.end()));
  const port = await listen(server, host);
  return { hits, port, close: () => (server.close(), undefined) };
}
/** One request through the egress server's Unix socket. */
function viaSocket(socketPath: string, options: { method?: string; path: string; headers?: Record<string, string>; body?: string }): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ socketPath, method: options.method ?? "GET", path: options.path, headers: options.headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end(options.body);
  });
}
/** A raw CONNECT through the socket; resolves with the status line. */
function connectVia(socketPath: string, target: string): Promise<string> {
  return new Promise((resolve) => {
    const s = connect(socketPath, () => s.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
    s.once("data", (d) => (resolve(d.toString().split("\r\n")[0]), s.destroy()));
    s.on("error", () => resolve("error"));
  });
}
const socketPath = () => join(mkdtempSync(join(tmpdir(), "l2v2-eg-")), "s.sock");

// ---------------------------------------------------------------- the relay and CONNECT, without a sandbox

test("the relay adds the token outside the sandbox: any credential sent is dropped, only allowed paths go through, responses stream back", async (t) => {
  const api = await fakeApi();
  t.after(api.close);
  const socket = socketPath();
  const proxy = await startEgressProxy(socket, [], { upstream: `http://127.0.0.1:${api.port}`, paths: ["/v1/"], token: TOKEN });
  t.after(proxy.close);
  const ok = await viaSocket(socket, { method: "POST", path: "/v1/messages", headers: { authorization: `Bearer ${PLACEHOLDER_TOKEN}`, "x-api-key": "sk-leaked", "proxy-authorization": "x", "anthropic-beta": "oauth" }, body: '{"q":1}' });
  assert.deepEqual([ok.status, ok.body], [200, "data: one\n\ndata: two\n\n"]);
  const seen = api.seen[0];
  assert.deepEqual([seen.path, seen.headers.authorization, seen.headers["x-api-key"], seen.headers["proxy-authorization"], seen.headers["anthropic-beta"], seen.body], ["/v1/messages", `Bearer ${TOKEN}`, undefined, undefined, "oauth", '{"q":1}']);
  for (const path of ["/admin", "/v2/messages", "//evil.example/v1/", "http://evil.example/v1/messages"]) assert.equal((await viaSocket(socket, { path })).status, 403, path);
  assert.equal(api.seen.length, 1, "nothing refused reached the upstream");
  assert.deepEqual(proxy.denied, ["relay:GET /admin", "relay:GET /v2/messages", "relay:GET //evil.example/v1/", "relay:GET http://evil.example/v1/messages"]);
});

test("the relay never follows a redirect: it goes back as it is, and the target is never contacted", async (t) => {
  const evil = await counted();
  t.after(evil.close);
  const api = await fakeApi(`http://localhost:${evil.port}/stolen`);
  t.after(api.close);
  const socket = socketPath();
  const proxy = await startEgressProxy(socket, [], { upstream: `http://127.0.0.1:${api.port}`, paths: ["/v1/"], token: TOKEN });
  t.after(proxy.close);
  const answer = await viaSocket(socket, { path: "/v1/redirect" });
  assert.deepEqual([answer.status, answer.headers.location], [302, `http://localhost:${evil.port}/stolen`]);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(evil.hits.n, 0);
});

test("CONNECT reaches only allowed host names: never an IP literal, IPv6, another port or host, or a malformed target", async (t) => {
  const target = await counted();
  t.after(target.close);
  const socket = socketPath();
  const proxy = await startEgressProxy(socket, [`localhost:${target.port}`]);
  t.after(proxy.close);
  assert.equal(await connectVia(socket, `localhost:${target.port}`), "HTTP/1.1 200 Connection Established");
  // Malformed targets are refused by the HTTP parser itself (400), the rest by the allowlist (403).
  for (const refused of [`127.0.0.1:${target.port}`, `[::1]:${target.port}`, `localhost:${target.port + 1}`, "evil.example:443", "localhost", "a b:1", `localhost.:${target.port}`])
    assert.match(await connectVia(socket, refused), /^HTTP\/1\.1 40[03] /, refused);
  // Host names only: an IP literal is refused even when the configuration lists it.
  const literal = socketPath();
  const strict = await startEgressProxy(literal, [`127.0.0.1:${target.port}`, `[::1]:${target.port}`]);
  t.after(strict.close);
  for (const refused of [`127.0.0.1:${target.port}`, `[::1]:${target.port}`]) assert.match(await connectVia(literal, refused), /^HTTP\/1\.1 403 /, `listed ${refused}`);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(target.hits.n, 1, "only the allowed tunnel reached it");
});

// ---------------------------------------------------------------- the sandbox

test("the sandbox layout: new namespaces, an empty read-only /work built from the project's readable paths, secrets masked, no host home, git, run state or credential", () => {
  const { root } = checkout();
  const args = sandboxArgs({ root, masks: secretMasks(root), files: { pack: PACK, out: OUT, editable: `${GROUPS}/g.json` }, outDir: "/tmp/x/out", groupsCopy: "/tmp/x/groups", claude: "/opt/bin/claude", launcher: LAUNCHER, node: process.execPath, configDir: "/tmp/x/cfg", socket: "/tmp/x/egress.sock", claudeArgs: ["-p"] });
  for (const flag of ["--unshare-all", "--die-with-parent", "--new-session"]) assert.ok(args.includes(flag), flag);
  assert.ok(args.indexOf("--remount-ro") > args.indexOf(`/work/${PACK}`) && args.indexOf("--remount-ro") > args.indexOf("/work/.map-authoring/l2v2/s/g"), "/work is made read-only after its mounts");
  const sources = args.map((arg, i) => (["--ro-bind", "--ro-bind-try", "--bind"].includes(args[i - 1] ?? "") ? arg : undefined)).filter((a): a is string => !!a && a.startsWith(root));
  assert.deepEqual(sources.sort(), [join(root, PACK), ...["docs", "package.json", "scripts", "src"].map((p) => join(root, p))].sort(), "only the readable paths and the pack come from the checkout");
  // Single read-only files (the launcher, the CLI's own directory) may live under home; home itself, or anything holding it, never.
  assert.ok(!args.some((arg) => arg === root || arg.includes("/.git") || (arg.startsWith("/") && (homedir() === arg || homedir().startsWith(`${arg}/`)))), "never the checkout as a whole, git metadata or the host home");
  assert.deepEqual(secretMasks(root), ["src/.env.local"]);
  assert.ok(args.join(" ").includes(`--ro-bind /dev/null /work/src/.env.local`));
  assert.ok(!args.join(" ").includes(TOKEN), "the token is never on a command line");
});

test("a sandbox that cannot be set up starts no session: no bubblewrap, no token, a token others can read", async () => {
  const { root } = checkout();
  const marker = join(mkdtempSync(join(tmpdir(), "l2v2-marker-")), "ran");
  // A stand-in CLI that would leave a mark outside the sandbox if it ever ran unsandboxed.
  const cli = join(dirname(marker), "claude");
  writeFileSync(cli, `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
  for (const [name, broken] of [
    ["no bubblewrap", config(root, cli, { bwrap: "/nonexistent/bwrap" })],
    ["no token", config(root, cli, { tokenFile: join(root, "missing-token") })],
    ["a token others can read", config(root, cli, { tokenFile: tokenFile(0o644) })],
  ] as const) {
    assert.ok(sandboxProblems(broken).length > 0, name);
    await assert.rejects(runSandboxed(broken, request()), /the session sandbox cannot be set up \(no session started\)/, name);
  }
  assert.ok(!existsSync(marker), "the CLI never ran");
});

test("in the sandbox: host secrets, the token, the host home and git are out of reach; sources, run state and everything but the output are read-only", { skip: NO_SANDBOX }, async () => {
  const { root, outside } = checkout();
  const probes: [string, string][] = [
    ["read_dev_vars", "cat /work/.dev.vars"],
    ["read_masked_env", "grep -q fake-env-secret /work/src/.env.local"],
    ["read_host_secret", `cat ${outside}/host-secret.txt`],
    ["list_host_home", `ls ${homedir()}`],
    ["read_credential_store", `cat ${homedir()}/.claude/.credentials.json`],
    ["token_in_env", `env | grep -q ${TOKEN}`],
    // The needle is assembled at run time, so the probe script itself never holds the token.
    ["token_anywhere", `t=${TOKEN.slice(0, 5)}; grep -rqs -e "\${t}${TOKEN.slice(5)}" /work /cfg /home /tmp /run /proc/self/environ /proc/1/environ`],
    ["git_metadata", "git -C /work status"],
    ["read_batch_state", "cat /work/.map-authoring/l2v2/s/g/state.json"],
    ["read_campaign", "cat /work/.map-authoring/campaign.json"],
    ["write_source", "echo x >> /work/src/lib/map/data.ts"],
    ["write_campaign", "echo x > /work/.map-authoring/campaign.json"],
    ["write_new_file", "echo x > /work/new.txt"],
    ["write_group", `echo x > /work/${GROUPS}/g.json`],
    ["read_sources", "cat /work/src/lib/map/data.ts"],
    ["read_pack", `cat /work/${PACK}`],
    ["placeholder_in_env", `test "$CLAUDE_CODE_OAUTH_TOKEN" = "${PLACEHOLDER_TOKEN}"`],
    // The same search finds what is there: the placeholder, assembled the same way.
    ["search_control", `t=${PLACEHOLDER_TOKEN.slice(0, 5)}; grep -rqs -e "\${t}${PLACEHOLDER_TOKEN.slice(5)}" /proc/self/environ`],
  ];
  const blocked = 14;
  const body = [
    "r() { if sh -c \"$2\" >/dev/null 2>&1; then printf '\"%s\":\"ok\",' \"$1\"; else printf '\"%s\":\"blocked\",' \"$1\"; fi; }",
    `{ printf '{'; ${probes.map(([n, c]) => `r ${n} '${c}'`).join("; ")}; printf '"end":"ok"}'; } > /work/${OUT}`,
  ].join("\n");
  const sources = { data: readFileSync(join(root, "src/lib/map/data.ts"), "utf8"), campaign: readFileSync(join(root, ".map-authoring/campaign.json"), "utf8") };
  const outcome = await runSandboxed(config(root, fakeCli(body)), request());
  assert.deepEqual(outcome.violations, []);
  assert.deepEqual(outcome.outputs!.map((o) => o.path), [OUT], "the output is handed back, not written by the sandbox");
  assert.ok(!existsSync(join(root, OUT)), "nothing reached the tree before the driver's checks");
  const seen = JSON.parse(outcome.outputs![0].data.toString("utf8")) as Record<string, string>;
  for (const [name] of probes.slice(0, blocked)) assert.equal(seen[name], "blocked", name);
  for (const [name] of probes.slice(blocked)) assert.equal(seen[name], "ok", name);
  assert.deepEqual({ data: readFileSync(join(root, "src/lib/map/data.ts"), "utf8"), campaign: readFileSync(join(root, ".map-authoring/campaign.json"), "utf8") }, sources);
});

test("the sandbox's network is the egress server alone: no DNS, IPv4 or IPv6, CONNECT only to allowed names, the relay only on its paths and never redirected", { skip: NO_SANDBOX }, async (t) => {
  const { root } = checkout();
  const allowed = await counted();
  const evil = await counted();
  const api = await fakeApi(`http://localhost:${evil.port}/stolen`);
  const v6 = await counted("::1").catch(() => undefined);
  const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
  const lanServer = lan ? await counted(lan) : undefined;
  t.after(() => [allowed, evil, api, v6, lanServer].forEach((s) => s?.close()));
  const probes: [string, string, "ok" | "blocked"][] = [
    ["dns", "node /work/scripts/probe-dns.mjs example.com", "blocked"],
    ["dns_api_host", "node /work/scripts/probe-dns.mjs api.anthropic.com", "blocked"],
    ["ipv4_loopback_host", `node /work/scripts/probe-direct.mjs 127.0.0.1 ${allowed.port}`, "blocked"],
    ...(lanServer ? [["ipv4_host_address", `node /work/scripts/probe-direct.mjs ${lan} ${lanServer.port}`, "blocked"] as [string, string, "blocked"]] : []),
    ...(v6 ? [["ipv6_loopback_host", `node /work/scripts/probe-direct.mjs ::1 ${v6.port}`, "blocked"] as [string, string, "blocked"]] : []),
    ["connect_ip_literal", `node /work/scripts/probe-raw.mjs "CONNECT 127.0.0.1:${allowed.port} HTTP/1.1" "HTTP/1.1 200"`, "blocked"],
    ["connect_ipv6_literal", `node /work/scripts/probe-raw.mjs "CONNECT [::1]:${allowed.port} HTTP/1.1" "HTTP/1.1 200"`, "blocked"],
    ["connect_other_host", 'node /work/scripts/probe-raw.mjs "CONNECT example.com:443 HTTP/1.1" "HTTP/1.1 200"', "blocked"],
    ["forward_proxy_request", `node /work/scripts/probe-raw.mjs "GET http://localhost:${evil.port}/ HTTP/1.1|Host: localhost" "HTTP/1.1 200"`, "blocked"],
    ["relay_other_path", 'node /work/scripts/probe-raw.mjs "GET /admin HTTP/1.1|Host: x" "HTTP/1.1 200"', "blocked"],
    ["follow_redirect", "node /work/scripts/probe-follow.mjs /v1/redirect", "blocked"],
    ["connect_allowed", `node /work/scripts/probe-raw.mjs "CONNECT localhost:${allowed.port} HTTP/1.1" "HTTP/1.1 200"`, "ok"],
    ["relay_api", `node /work/scripts/probe-raw.mjs "GET /v1/messages HTTP/1.1|Host: x|Authorization: Bearer ${PLACEHOLDER_TOKEN}" "HTTP/1.1 200"`, "ok"],
  ];
  // Each probe command is written to its own script, so no quoting crosses the shell.
  const cli = fakeCli([
    "r() { if sh \"$2\" >/dev/null 2>&1; then printf '\"%s\":\"ok\",' \"$1\"; else printf '\"%s\":\"blocked\",' \"$1\"; fi; }",
    `{ printf '{'; ${probes.map(([n]) => `r ${n} /opt/claude/${n}.sh`).join("; ")}; printf '"end":"ok"}'; } > /work/${OUT}`,
  ].join("\n"));
  for (const [name, command] of probes) writeFileSync(join(dirname(cli), `${name}.sh`), `${command}\n`);
  const outcome = await runSandboxed(config(root, cli, { egress: [`localhost:${allowed.port}`], relay: { upstream: `http://127.0.0.1:${api.port}`, paths: ["/v1/"] } }), request());
  const seen = JSON.parse(outcome.outputs![0].data.toString("utf8")) as Record<string, string>;
  for (const [name, , expected] of probes) assert.equal(seen[name], expected, name);
  assert.equal(evil.hits.n, 0, "the redirect target and the forward-proxy target were never reached");
  assert.ok(api.seen.length >= 2 && api.seen.every((r) => r.headers.authorization === `Bearer ${TOKEN}`), "every relayed call carried the real token, added outside");
  assert.ok(outcome.egressDenied!.includes("example.com:443") && outcome.egressDenied!.includes("relay:GET /admin"));
});

test("only the designated output comes back: another file, a link, or another group's file voids the session's writes", { skip: NO_SANDBOX }, async () => {
  const { root } = checkout();
  const extra = await runSandboxed(config(root, fakeCli(`printf '{}' > /work/${OUT}; printf x > /work/.map-authoring/l2v2/s/g/state.json`)), request());
  assert.deepEqual(extra.violations, [".map-authoring/l2v2/s/g/state.json: not the session's output"]);
  const link = await runSandboxed(config(root, fakeCli(`ln -s /etc/passwd /work/${OUT}`)), request());
  assert.match(link.violations!.join(), /draft\.json: not a regular file/);
  assert.deepEqual(link.outputs, []);
  const plan = { pack: PACK, editable: `${GROUPS}/g.json` };
  const own = await runSandboxed(config(root, fakeCli(`printf '{"g":2}' > /work/${GROUPS}/g.json`)), request(plan));
  assert.deepEqual([own.violations, own.outputs!.map((o) => [o.path, o.data.toString()])], [[], [[`${GROUPS}/g.json`, '{"g":2}']]]);
  const other = await runSandboxed(config(root, fakeCli(`printf '{"g":2}' > /work/${GROUPS}/g.json; printf '{"o":2}' > /work/${GROUPS}/other.json`)), request(plan));
  assert.deepEqual(other.violations, [`${GROUPS}/other.json: another group's file`]);
  assert.equal(readFileSync(join(root, `${GROUPS}/other.json`), "utf8"), '{"o":1}\n', "the host file never changed");
});

test("each session chain has its own CLI config dir: no other session's transcripts or settings, and --resume finds exactly its own", { skip: NO_SANDBOX }, async () => {
  const { root } = checkout();
  const shared = config(root, "");
  const run = (body: string, resume?: string) => runSandboxed({ ...shared, claude: fakeCli(body) }, request({ pack: PACK, out: OUT }, resume));
  // Each session leaves a transcript and plants a hook in its settings, after reporting what it can see.
  const body = [
    'mkdir -p /cfg/projects/-work; echo "$id" > /cfg/projects/-work/$id.jsonl',
    `printf '{"files":"%s","settings":"%s"}' "$(ls /cfg/projects/-work | tr '\\n' ' ')" "$(cat /cfg/settings.json)" > /work/${OUT}`,
    `echo '{"hooks":{}}' > /cfg/settings.json`,
  ].join("\n");
  const seen = (outcome: { outputs?: { data: Buffer }[] }) => JSON.parse(outcome.outputs![0].data.toString()) as { files: string; settings: string };
  const first = await run(body);
  const second = await run(body);
  assert.notEqual(first.sessionId, second.sessionId);
  assert.deepEqual(seen(second).files.trim().split(" "), [`${second.sessionId}.jsonl`], "a new session sees no other session's transcript");
  const resumed = await run(body, first.sessionId);
  assert.equal(resumed.sessionId, first.sessionId);
  assert.deepEqual(seen(resumed).files.trim().split(" "), [`${first.sessionId}.jsonl`], "a resumption sees exactly its own chain's transcript");
  assert.equal(seen(resumed).settings.trim(), "{}", "settings planted by the earlier session are gone");
  assert.deepEqual(readdirSync(shared.configRoot).sort(), [first.sessionId, second.sessionId].sort(), "one dir per chain, named by its session id");
  await assert.rejects(run(body, "00000000-0000-0000-0000-000000000000"), /no transcript for session/);
  await assert.rejects(run(body, "../escape"), /not a session id/);
});

test("no process outlives a sandboxed session, on exit or on a timeout", { skip: NO_SANDBOX }, async () => {
  const { root } = checkout();
  const tag = `l2v2-sbx-${process.pid}`;
  const left = () => spawnSync("pgrep", ["-f", tag], { encoding: "utf8" }).stdout.trim();
  await runSandboxed(config(root, fakeCli(`sh -c 'exec -a ${tag} sleep 30' &\nsleep 0.2`)), request());
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(left(), "", "a background process died with the session");
  await assert.rejects(runSandboxed(config(root, fakeCli(`sh -c 'exec -a ${tag} sleep 30' &\nsleep 30`)), { ...request(), timeoutMs: 1000 }), /exceeded 1000 ms/);
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(left(), "", "and on a timeout");
});

test("a CLI config dir keeps only its transcripts: settings, hooks, MCP servers, plugins and shell snapshots a session planted are gone", () => {
  const dir = mkdtempSync(join(tmpdir(), "l2v2-cfg-"));
  put(dir, "settings.json", '{"hooks":{"Stop":[{"command":"evil"}]}}');
  put(dir, ".claude.json", '{"mcpServers":{"x":{}}}');
  put(dir, "plugins/p/plugin.json", "{}");
  put(dir, "shell-snapshots/snap.sh", "evil");
  put(dir, "projects/-work/session.jsonl", "{}\n");
  sanitizeConfigDir(dir);
  assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), "{}\n");
  assert.deepEqual([existsSync(join(dir, ".claude.json")), existsSync(join(dir, "plugins")), existsSync(join(dir, "shell-snapshots")), existsSync(join(dir, "projects/-work/session.jsonl"))], [false, false, false, true]);
});

test("a session whose output is its final message gets a read-only batch dir; the shell is bash, under the read-only /usr", () => {
  const { root } = checkout();
  const args = (files: { pack: string; out?: string; editable?: string }) => sandboxArgs({ root, masks: [], files, outDir: "/tmp/x/out", groupsCopy: files.editable ? "/tmp/x/groups" : undefined, claude: "/opt/bin/claude", launcher: LAUNCHER, node: process.execPath, configDir: "/tmp/x/cfg", socket: "/tmp/x/egress.sock", claudeArgs: ["-p"] });
  const remounted = (a: string[]) => a.some((arg, i) => arg === "/work/.map-authoring/l2v2/s/g" && a[i - 1] === "--remount-ro");
  assert.ok(!remounted(args({ pack: PACK, out: OUT })), "an output file needs its writable dir");
  for (const files of [{ pack: PACK }, { pack: PACK, editable: `${GROUPS}/g.json` }]) {
    const a = args(files);
    assert.ok(remounted(a), JSON.stringify(files));
    const at = a.findIndex((arg, i) => arg === "/work/.map-authoring/l2v2/s/g" && a[i - 1] === "--remount-ro");
    assert.ok(at > a.indexOf(`/work/${PACK}`), "made read-only once the pack is mounted in it");
  }
  assert.equal(SANDBOX_SHELL, "/usr/bin/bash");
  for (const prefix of ["/usr", "/opt/node-x"]) assert.equal(sandboxEnv(prefix).SHELL, SANDBOX_SHELL);
});

/** A stand-in CLI whose final message reports what the probes found (plain words, no quotes). */
function reportingCli(probes: [string, string][]): string {
  const file = join(mkdtempSync(join(tmpdir(), "l2v2-cli-")), "claude");
  writeFileSync(file, [
    "#!/bin/sh",
    "cat > /dev/null",
    "id=$(cat /proc/sys/kernel/random/uuid)",
    'res=""',
    ...probes.map(([name, command]) => `if sh -c '${command}' >/dev/null 2>&1; then res="$res ${name}=ok"; else res="$res ${name}=blocked"; fi`),
    `printf '{"session_id":"%s","result":"%s","num_turns":1,"duration_ms":1}\\n' "$id" "$res"`,
    "",
  ].join("\n"));
  chmodSync(file, 0o755);
  return file;
}

test("in the sandbox, a final-message session writes nothing: its batch dir is read-only like the rest of /work; its shell is bash", { skip: NO_SANDBOX }, async () => {
  const { root } = checkout();
  const outcome = await runSandboxed(config(root, reportingCli([
    ["write_batch_dir", "echo x > /work/.map-authoring/l2v2/s/g/review.json"],
    ["write_pack", `echo x >> /work/${PACK}`],
    ["write_tmp", "echo x > /tmp/scratch"],
    ["shell_is_bash", `test "$SHELL" = ${SANDBOX_SHELL}`],
    ["bash_runs", `${SANDBOX_SHELL} -c "echo =====; true"`],
  ])), request({ pack: PACK }));
  assert.equal(outcome.text.trim(), "write_batch_dir=blocked write_pack=blocked write_tmp=ok shell_is_bash=ok bash_runs=ok");
  assert.deepEqual([outcome.outputs, outcome.violations], [[], []]);
  assert.ok(!existsSync(join(root, ".map-authoring/l2v2/s/g/review.json")));
});

test("in the sandbox, the accounting state is out of reach: no session reads or appends to the ledger, the budget or the policy", { skip: NO_SANDBOX }, async () => {
  const { root } = checkout();
  put(root, ".map-authoring/l2v2/ledger.jsonl", '{"kind":"meter","at":"2026-10-15T00:00:00.000Z","percent":1}\n');
  put(root, ".map-authoring/l2v2/budget.json", '{"perConcept":122000}\n');
  const before = { ledger: readFileSync(join(root, ".map-authoring/l2v2/ledger.jsonl"), "utf8"), budget: readFileSync(join(root, ".map-authoring/l2v2/budget.json"), "utf8") };
  const forged = '{"kind":"policy","version":2}';
  const outcome = await runSandboxed(config(root, reportingCli([
    ["read_ledger", "cat /work/.map-authoring/l2v2/ledger.jsonl"],
    ["append_ledger", `echo '${forged}' >> /work/.map-authoring/l2v2/ledger.jsonl`],
    ["read_budget", "cat /work/.map-authoring/l2v2/budget.json"],
    ["write_budget", "echo {} > /work/.map-authoring/l2v2/budget.json"],
    ["create_ledger_beside_batch", `echo '${forged}' > /work/.map-authoring/l2v2/s/ledger.jsonl`],
  ])), request({ pack: PACK }));
  assert.equal(outcome.text.trim(), "read_ledger=blocked append_ledger=blocked read_budget=blocked write_budget=blocked create_ledger_beside_batch=blocked");
  assert.deepEqual([outcome.outputs, outcome.violations], [[], []]);
  assert.deepEqual({ ledger: readFileSync(join(root, ".map-authoring/l2v2/ledger.jsonl"), "utf8"), budget: readFileSync(join(root, ".map-authoring/l2v2/budget.json"), "utf8") }, before);
});
