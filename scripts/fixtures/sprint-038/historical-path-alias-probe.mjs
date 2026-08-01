#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const argvUrl = pathToFileURL(process.argv[1]).href;
const equal = import.meta.url === argvUrl;
process.stdout.write(`${JSON.stringify({ importMetaUrl: import.meta.url, argvUrl, equal })}\n`);
process.exitCode = equal ? 0 : 1;
