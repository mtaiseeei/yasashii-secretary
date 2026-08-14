#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  authorMetadata, readIdentity, suggestSecretaryName, validateSecretaryName, writeNewIdentity,
} from "./lib/secretary-identity.mjs";
import { classifyNameRouting } from "./lib/name-router.mjs";
import { applyRename, previewRename } from "./lib/secretary-rename.mjs";
import {
  applyIdentityMigration, diagnoseIdentityMigration, previewIdentityMigration,
} from "./lib/secretary-identity-migration.mjs";
import { inspectUserScopeRouting, updateUserScopeRouting } from "./lib/user-scope-routing.mjs";
import { registerWorkspace, resolveCanonicalWorkspace } from "./lib/workspace-registry.mjs";

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
function flag(args, name) { return args.includes(name); }
function listOption(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) if (args[index] === name) values.push(args[index + 1]);
  return values;
}
function output(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function required(value, label) { if (!value) throw new Error(`${label}を指定してください。`); return value; }

export async function run(argv) {
  const [command, ...args] = argv;
  if (command === "validate") return output(validateSecretaryName(args.join(" ")));
  if (command === "suggest") return output(suggestSecretaryName({ seed: option(args, "--seed", "default"), excluded: listOption(args, "--exclude") }));
  if (command === "init") {
    const secretaryRoot = required(option(args, "--secretary"), "--secretary");
    const displayName = required(option(args, "--name"), "--name");
    return output(writeNewIdentity(secretaryRoot, { displayName, secretaryId: option(args, "--secretary-id"), now: option(args, "--now"), confirm: flag(args, "--confirm") }));
  }
  if (command === "migration-diagnose" || command === "migration-preview") {
    const operation = command === "migration-diagnose" ? diagnoseIdentityMigration : previewIdentityMigration;
    return output(operation({
      workspace: required(option(args, "--workspace"), "--workspace"),
      pluginRoot: required(option(args, "--plugin-root"), "--plugin-root"),
      name: option(args, "--name"),
    }));
  }
  if (command === "migration-apply") {
    return output(applyIdentityMigration({
      workspace: required(option(args, "--workspace"), "--workspace"),
      pluginRoot: required(option(args, "--plugin-root"), "--plugin-root"),
      name: option(args, "--name"),
      secretaryId: option(args, "--secretary-id"),
      now: option(args, "--now"),
      confirm: flag(args, "--confirm"),
      failAt: option(args, "--fail-at"),
    }));
  }
  if (command === "status") {
    const secretaryRoot = required(option(args, "--secretary"), "--secretary");
    const identity = readIdentity(secretaryRoot);
    const routing = option(args, "--home") ? inspectUserScopeRouting({ home: option(args, "--home") }) : [];
    return output({ identity, author: authorMetadata(identity), routing });
  }
  if (command === "routing-enable" || command === "routing-disable") {
    const identity = readIdentity(required(option(args, "--secretary"), "--secretary"));
    const hosts = listOption(args, "--host");
    return output(updateUserScopeRouting({ home: required(option(args, "--home"), "--home"), identity, hosts: hosts.length ? hosts : ["codex", "claude"], operation: command.endsWith("disable") ? "disable" : "enable", confirm: flag(args, "--confirm"), failAt: option(args, "--fail-at") }));
  }
  if (command === "registry-register") {
    return output(registerWorkspace({ home: required(option(args, "--home"), "--home"), workspace: required(option(args, "--workspace"), "--workspace"), edition: required(option(args, "--edition"), "--edition"), confirm: flag(args, "--confirm"), failAt: option(args, "--fail-at") }));
  }
  if (command === "resolve") return output(resolveCanonicalWorkspace({ home: required(option(args, "--home"), "--home"), edition: option(args, "--edition") }));
  if (command === "route") {
    const identity = readIdentity(required(option(args, "--secretary"), "--secretary"));
    const text = option(args, "--text") ?? readFileSync(0, "utf8");
    return output(classifyNameRouting(text, identity, { alreadyAsked: flag(args, "--already-asked") }));
  }
  if (command === "rename-preview") return output(previewRename({ secretaryRoot: required(option(args, "--secretary"), "--secretary"), newName: required(option(args, "--name"), "--name"), home: option(args, "--home") }));
  if (command === "rename-apply") {
    return output(applyRename({
      secretaryRoot: required(option(args, "--secretary"), "--secretary"),
      newName: required(option(args, "--name"), "--name"),
      home: option(args, "--home"),
      confirm: flag(args, "--confirm"),
      confirmedClasses: listOption(args, "--confirm-class"),
      selectedUserContent: listOption(args, "--user-content"),
      failAt: option(args, "--fail-at"),
    }));
  }
  throw new Error("使い方: secretary-name.mjs validate|suggest|init|migration-diagnose|migration-preview|migration-apply|status|routing-enable|routing-disable|registry-register|resolve|route|rename-preview|rename-apply");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 3;
  });
}
