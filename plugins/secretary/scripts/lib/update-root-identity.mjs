import { lstatSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { workingRoot } from "./safe-fs.mjs";

export class UpdateRootIdentityError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function normalizeUpdateDirectoryIdentity(stat) {
  if (!stat || typeof stat.dev !== "bigint" || typeof stat.ino !== "bigint" || typeof stat.isDirectory !== "function" || !stat.isDirectory()) {
    throw new UpdateRootIdentityError("workspace rootが通常directoryではないため、更新を開始しません。", "update-root-not-directory");
  }
  if (stat.dev === 0n || stat.ino === 0n) {
    throw new UpdateRootIdentityError("workspace rootのfilesystem identityを確認できないため、更新を開始しません。", "update-root-identity-unavailable");
  }
  return { dev: stat.dev.toString(10), ino: stat.ino.toString(10) };
}

export function sameUpdateDirectoryIdentity(left, right) {
  if (!left || !right || typeof left.dev !== "string" || typeof left.ino !== "string"
    || typeof right.dev !== "string" || typeof right.ino !== "string"
    || !left.dev || !left.ino || !right.dev || !right.ino) return false;
  return left.dev === right.dev && left.ino === right.ino;
}

export function observeUpdateDirectory(value) {
  const requested = resolve(value);
  const path = workingRoot(requested);
  let identity;
  try {
    identity = normalizeUpdateDirectoryIdentity(lstatSync(path, { bigint: true }));
  } catch (error) {
    if (error instanceof UpdateRootIdentityError) throw error;
    throw new UpdateRootIdentityError("workspace rootのfilesystem identityを確認できないため、更新を開始しません。", "update-root-identity-unavailable");
  }
  return { requested, path, identity };
}

export function revalidateUpdateDirectory(observation) {
  const current = observeUpdateDirectory(observation.requested);
  if (!sameUpdateDirectoryIdentity(observation.identity, current.identity)) {
    throw new UpdateRootIdentityError("workspace rootが確認後に変わったため、更新を開始しません。", "update-root-identity-changed");
  }
  return current;
}

export function parseUpdateGitPath(result) {
  if (!result || result.status !== 0 || typeof result.stdout !== "string") {
    throw new UpdateRootIdentityError("workspace rootのGitリポジトリで実行してください。更新は開始していません。", "update-git-probe-failed");
  }
  const value = result.stdout.endsWith("\r\n")
    ? result.stdout.slice(0, -2)
    : result.stdout.endsWith("\n")
      ? result.stdout.slice(0, -1)
      : result.stdout;
  if (!value || value.includes("\n") || value.includes("\r") || !isAbsolute(value)) {
    throw new UpdateRootIdentityError("Gitが返したworkspace rootを一意に確認できないため、更新を開始しません。", "update-git-output-unsafe");
  }
  return value;
}
