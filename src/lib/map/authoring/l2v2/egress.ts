/**
 * MAP L2 v2: the only network path out of a session's sandbox
 * (docs/map-authoring/l2-pipeline-v2.md). The sandbox has no network of its
 * own; everything it sends reaches this server through a Unix socket:
 *
 * - **API relay** (origin-form requests, `ANTHROPIC_BASE_URL`): forwarded to
 *   the configured upstream over TLS, only on allowed paths, with whatever
 *   credential the sandbox sent removed and the real token added here. The
 *   token never enters the sandbox. Redirects are passed back, never followed.
 * - **CONNECT tunnels** (`HTTPS_PROXY`): only to the allowed `host:port`
 *   pairs; IP literals, IPv6 and anything malformed are refused.
 *
 * Everything else is refused and recorded. Development tooling only.
 */
import { createServer as createHttpServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect, type Socket } from "node:net";

export type Relay = { upstream: string; paths: readonly string[]; token: string };
export type EgressProxy = { socket: string; denied: string[]; relayed: number; close(): Promise<void> };

/** Hop-by-hop headers and every credential the sandbox could send: never forwarded. */
const DROPPED = new Set(["connection", "keep-alive", "proxy-connection", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host", "authorization", "x-api-key"]);
const HOSTNAME = /^(?=.*[a-z])[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** Starts the proxy on a Unix socket: CONNECT to the allowed `host:port` pairs, and the API relay when one is given. */
export function startEgressProxy(socket: string, allow: readonly string[], relay?: Relay): Promise<EgressProxy> {
  const allowed = new Set(allow.map((target) => target.toLowerCase()));
  const open = new Set<Socket>();
  const proxy: EgressProxy = { socket, denied: [], relayed: 0, close: async () => undefined };
  const refuse = (res: ServerResponse, what: string) => {
    proxy.denied.push(what);
    res.writeHead(403, { "content-length": "0", connection: "close" }).end();
  };

  const server = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
    const path = req.url ?? "";
    // Origin-form only: an absolute URL would be a forward-proxy request to an arbitrary host.
    if (!relay || !path.startsWith("/") || path.startsWith("//") || !relay.paths.some((prefix) => path.startsWith(prefix))) return refuse(res, `relay:${req.method} ${path.slice(0, 120)}`);
    const target = new URL(path, relay.upstream);
    const headers: IncomingHttpHeaders = {};
    for (const [name, value] of Object.entries(req.headers)) if (!DROPPED.has(name.toLowerCase())) headers[name] = value;
    headers.authorization = `Bearer ${relay.token}`;
    headers.host = target.host;
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    // One connection per request (no keep-alive pool): nothing of a session outlives it.
    const upstream = send(target, { method: req.method, headers, agent: false }, (answer) => {
      proxy.relayed++;
      const back: Record<string, string | string[]> = {};
      for (const [name, value] of Object.entries(answer.headers)) if (value !== undefined && !DROPPED.has(name.toLowerCase())) back[name] = value;
      // A redirect goes back as it is: the relay never follows it anywhere.
      res.writeHead(answer.statusCode ?? 502, { ...back, connection: "close" });
      answer.pipe(res);
    });
    upstream.on("error", () => (res.headersSent ? res.destroy() : res.writeHead(502, { "content-length": "0", connection: "close" }).end()));
    req.pipe(upstream);
  });

  server.on("connect", (req: IncomingMessage, client: Socket, head: Buffer) => {
    open.add(client);
    client.on("close", () => open.delete(client));
    client.on("error", () => client.destroy());
    const match = (req.url ?? "").toLowerCase().match(/^([^:\s]+):(\d{1,5})$/);
    const target = match && HOSTNAME.test(match[1]) ? `${match[1]}:${match[2]}` : undefined;
    if (!target || !allowed.has(target)) {
      proxy.denied.push(target ?? (req.url ?? "").slice(0, 120));
      client.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
      return;
    }
    const upstream = connect(Number(match![2]), match![1]);
    open.add(upstream);
    upstream.on("close", () => open.delete(upstream));
    upstream.on("error", () => (client.destroyed ? undefined : client.end("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")));
    upstream.once("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      client.pipe(upstream).pipe(client);
    });
    client.on("close", () => upstream.destroy());
  });
  server.on("connection", (socket: Socket) => {
    open.add(socket);
    socket.on("close", () => open.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socket, () => {
      proxy.close = () =>
        new Promise<void>((done) => {
          for (const s of open) s.destroy();
          server.close(() => done());
        });
      resolve(proxy);
    });
  });
}
