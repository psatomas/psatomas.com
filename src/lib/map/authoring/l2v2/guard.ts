/**
 * MAP L2 v2: the file-level primitives of the driver's integrity guard
 * (docs/map-authoring/l2-pipeline-v2.md). The guard detects and undoes what a
 * session changed once it has run; it prevents nothing while the session
 * runs, which is the job of the session's permissions. Files are compared as
 * bytes with their mode, links are never followed, and dependencies are
 * watched by metadata only. Development tooling only.
 */
import { chmodSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type Entry =
  /** `head`: the content at HEAD, whose mode git records only as executable or not. */
  | { kind: "file"; data: Buffer; mode: number; head?: boolean }
  | { kind: "link"; target: string }
  | { kind: "dir" }
  /** Watched by its metadata only (mode, size, time, link target): never read, never restored. */
  | { kind: "sig"; sig: string };

const lstat = (abs: string) => {
  try {
    return lstatSync(abs);
  } catch {
    return undefined;
  }
};

/** A path as the guard compares it; undefined when absent. */
export function entryOf(abs: string): Entry | undefined {
  const stat = lstat(abs);
  if (!stat) return undefined;
  if (stat.isSymbolicLink()) return { kind: "link", target: readlinkSync(abs) };
  if (stat.isDirectory()) return { kind: "dir" };
  if (stat.isFile()) return { kind: "file", data: readFileSync(abs), mode: stat.mode & 0o7777 };
  return { kind: "sig", sig: `special:${stat.mode}` };
}

/** A path watched by its metadata only: changing, adding or removing it is seen; its content is never read. */
export function signatureOf(abs: string): Entry | undefined {
  const stat = lstat(abs);
  if (!stat) return undefined;
  return { kind: "sig", sig: `${stat.mode}:${stat.size}:${stat.mtimeMs}${stat.isSymbolicLink() ? `:${readlinkSync(abs)}` : ""}` };
}

const executable = (mode: number) => (mode & 0o111) !== 0;
export function sameEntry(a: Entry | undefined, b: Entry | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.kind === "file" && b.kind === "file") return a.data.equals(b.data) && (a.head || b.head ? executable(a.mode) === executable(b.mode) : a.mode === b.mode);
  if (a.kind === "link" && b.kind === "link") return a.target === b.target;
  if (a.kind === "sig" && b.kind === "sig") return a.sig === b.sig;
  return a.kind === "dir" && b.kind === "dir";
}

/**
 * Puts `abs` back as `want` (undefined removes it): bytes and mode, or the
 * link. Directories and metadata-only paths are never restored automatically.
 */
export function restoreEntry(abs: string, want: Entry | undefined): void {
  if (want?.kind === "dir" || want?.kind === "sig") throw new Error(want.kind === "dir" ? "a directory is never restored automatically" : "a dependency is never restored automatically");
  const now = lstat(abs);
  if (now?.isDirectory()) throw new Error("a directory is never removed or replaced automatically");
  if (!want) {
    if (now) rmSync(abs);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  if (want.kind === "link") {
    if (now) rmSync(abs);
    symlinkSync(want.target, abs);
    return;
  }
  // A HEAD entry records only whether the file is executable: other mode bits stay as they are.
  const base = now && !now.isSymbolicLink() ? now.mode & 0o7777 : 0o644;
  const mode = want.head ? (executable(want.mode) ? base | 0o111 : base & ~0o111) : want.mode;
  const tmp = `${abs}.l2v2-restore`;
  writeFileSync(tmp, want.data);
  chmodSync(tmp, mode);
  renameSync(tmp, abs);
}

/** Every file and link under `abs` (links are never followed); [] when it is absent. */
export function walk(abs: string): string[] {
  const stat = lstat(abs);
  if (!stat) return [];
  if (!stat.isDirectory()) return [abs];
  return readdirSync(abs).flatMap((name) => walk(join(abs, name)));
}
