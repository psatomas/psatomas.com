// Runs inside a v2 session's sandbox (docs/map-authoring/l2-pipeline-v2.md): the sandbox has no network,
// so this forwards 127.0.0.1:<port> to the driver's egress proxy socket, then runs the CLI with the
// session's stdio. The CLI reaches the network only through HTTPS_PROXY, and only where the proxy allows.
//   node sandbox-launch.mjs <proxy-socket> <port> <command> [args...]
import { spawn } from "node:child_process";
import { connect, createServer } from "node:net";

const [socket, port, command, ...args] = process.argv.slice(2);
const bridge = createServer((client) => {
  const upstream = connect(socket);
  client.pipe(upstream).pipe(client);
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
});
bridge.listen(Number(port), "127.0.0.1", () => {
  const child = spawn(command, args, { stdio: "inherit" });
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, () => child.kill(signal));
  child.on("error", (error) => {
    process.stderr.write(`sandbox-launch: cannot start ${command}: ${error.message}\n`);
    process.exit(127);
  });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 128 : 1)));
});
