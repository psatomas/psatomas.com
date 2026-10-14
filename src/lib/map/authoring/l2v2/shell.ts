/**
 * MAP L2 v2: the commands the driver runs, with stdout and stderr kept apart
 * so diagnostics never reach parsed data or restored files, and git content
 * read as bytes. Development tooling only.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Entry } from "./guard.ts";

export type Run = { ok: boolean; stdout: string; stderr: string };

/** A command's result: stdout is the data, stderr only ever diagnostics. */
export function run(command: string, argv: readonly string[], cwd: string): Run {
  const result = spawnSync(command, argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: result.status === 0, stdout: result.stdout ?? "", stderr: `${result.stderr ?? ""}${result.error ? result.error.message : ""}` };
}
const bytes = (argv: readonly string[], cwd: string) => {
  const result = spawnSync("git", argv, { cwd, maxBuffer: 256 * 1024 * 1024 });
  return result.status === 0 ? result.stdout : undefined;
};

/** Paths that differ from HEAD, including untracked files (never ignored ones, never nested worktrees). */
export function gitChangedPaths(cwd: string): string[] {
  const entries = run("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], cwd).stdout.split("\0").filter(Boolean);
  const paths: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    paths.push(entries[i].slice(3));
    if (entries[i][0] === "R" || entries[i][0] === "C") paths.push(entries[++i]);
  }
  // Nested worktrees are separate checkouts, listed as directories: never part of a batch.
  return paths.filter((path) => !path.startsWith(".worktrees/"));
}

/** A path's content and executable bit at HEAD, as bytes; undefined when HEAD has no such file. */
export function gitHeadEntry(cwd: string, path: string): Entry | undefined {
  const listing = run("git", ["ls-tree", "-z", "HEAD", "--", path], cwd).stdout.split("\0")[0];
  const match = listing?.match(/^(\d{6}) blob ([0-9a-f]+)\t/);
  if (!match) return undefined;
  const data = bytes(["cat-file", "blob", match[2]], cwd);
  return data && { kind: "file", data, mode: match[1] === "100755" ? 0o755 : 0o644, head: true };
}

/** Git's own executable and configuration surfaces for this checkout: shared and worktree config, hooks, info. */
export function gitSurfaces(cwd: string): string[] {
  const [common, gitDir, hooks] = run("git", ["rev-parse", "--path-format=absolute", "--git-common-dir", "--git-dir", "--git-path", "hooks"], cwd).stdout.split("\n");
  if (!common || !gitDir || !hooks) throw new Error("git rev-parse found no git directory");
  return [join(common, "config"), join(gitDir, "config.worktree"), hooks, join(common, "info")];
}
