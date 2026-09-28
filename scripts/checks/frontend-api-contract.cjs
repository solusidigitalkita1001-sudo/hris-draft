#!/usr/bin/env node
'use strict';
/**
 * Frontend-to-backend path contract.
 *
 * The frontend calls the API by string, so a renamed or removed route is only
 * discovered when a screen breaks in the browser. This walks both sides
 * statically — every `api.<method>('/path')` call in frontend/src against every
 * `router.<method>('/path')` declaration in backend/src plus the mount prefixes
 * in app.ts — and reports any call the backend does not serve.
 *
 * Static on purpose: importing the backend app pulls in config, Prisma and the
 * schedulers, which is not something a contract check should need.
 */
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function walkFiles(directory, predicate, found = []) {
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) walkFiles(full, predicate, found);
    else if (predicate(entry)) found.push(full);
  }
  return found;
}

/** `/leave/${id}/cancel` and `/leave/:id/cancel` have to compare equal. */
function normalize(pathname) {
  return pathname
    .replace(/\$\{[^}]*\}/g, ':param')
    .replace(/:[A-Za-z0-9_]+/g, ':param')
    .replace(/\/+$/, '')
    .replace(/\?.*$/, '') || '/';
}

function readIfExists(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Resolve a router import specifier (`@/modules/x/x.routes` or `./y.routes`). */
function resolveRouteFile(specifier, fromFile) {
  const candidate = specifier.startsWith('@/')
    ? path.join(ROOT, 'backend/src', specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  return `${candidate}.ts`;
}

function routerImports(source, file) {
  const imports = new Map();
  for (const match of source.matchAll(/import\s+(?:(\w+)|\{\s*([\w\s,]+?)\s*\})\s+from\s+'([^']*routes)'/g)) {
    const names = match[1] ? [match[1]] : match[2].split(',').map((name) => name.trim().split(/\s+as\s+/).pop());
    for (const name of names) imports.set(name, resolveRouteFile(match[3], file));
  }
  // `import { privateFilesRouter } from '@/shared/storage/private-files'`
  for (const match of source.matchAll(/import\s+\{\s*(\w*[Rr]outer)\s*\}\s+from\s+'([^']+)'/g)) {
    imports.set(match[1], resolveRouteFile(match[2], file));
  }
  return imports;
}

/**
 * Collect declarations from one router file, following the sub-routers it
 * mounts. Each identifier is resolved through that file's own imports — a
 * previous version cross-joined every route file against every prefix, which
 * inflated the declared set and would have hidden a real mismatch.
 */
function collectFromFile(file, prefix, declared, visited) {
  const key = `${file}|${prefix}`;
  if (visited.has(key)) return;
  visited.add(key);
  const source = readIfExists(file);
  if (!source) return;

  for (const method of METHODS) {
    const pattern = new RegExp(`router\\.${method}\\(\\s*'([^']*)'`, 'g');
    for (const match of source.matchAll(pattern)) declared.add(normalize(prefix + match[1]));
    // `router.get(['/a', '/b'], …)`
    const arrayPattern = new RegExp(`router\\.${method}\\(\\s*\\[([^\\]]+)\\]`, 'g');
    for (const match of source.matchAll(arrayPattern)) {
      for (const literal of match[1].matchAll(/'([^']*)'/g)) declared.add(normalize(prefix + literal[1]));
    }
  }

  const imports = routerImports(source, file);
  for (const match of source.matchAll(/router\.use\(\s*'([^']*)'\s*,\s*(\w+)/g)) {
    const target = imports.get(match[2]);
    if (target) collectFromFile(target, prefix + match[1], declared, visited);
  }
  for (const match of source.matchAll(/router\.use\(\s*(\w+)\s*\)/g)) {
    const target = imports.get(match[1]);
    if (target) collectFromFile(target, prefix, declared, visited);
  }
}

function backendRoutes() {
  const appFile = path.join(ROOT, 'backend/src/app.ts');
  const appSource = readFileSync(appFile, 'utf8');
  const declared = new Set();
  const visited = new Set();
  const imports = routerImports(appSource, appFile);

  // Routes declared directly on the app (health probes, meta endpoints).
  for (const method of METHODS) {
    const prefixed = new RegExp(`app\\.${method}\\(\\s*\`\\$\\{apiPrefix\\}([^\`]*)\``, 'g');
    for (const match of appSource.matchAll(prefixed)) declared.add(normalize(match[1]));
    const literal = new RegExp(`app\\.${method}\\(\\s*'([^']+)'`, 'g');
    for (const match of appSource.matchAll(literal)) declared.add(normalize(match[1]));
    const array = new RegExp(`app\\.${method}\\(\\s*\\[([^\\]]+)\\]`, 'g');
    for (const match of appSource.matchAll(array)) {
      for (const one of match[1].matchAll(/'([^']*)'/g)) declared.add(normalize(one[1]));
    }
  }

  for (const match of appSource.matchAll(/app\.use\(\s*`\$\{apiPrefix\}([^`]*)`\s*,\s*(\w+)/g)) {
    const target = imports.get(match[2]);
    if (target) collectFromFile(target, match[1], declared, visited);
  }
  return declared;
}

function frontendCalls() {
  const files = walkFiles(path.join(ROOT, 'frontend/src'), (name) => /\.(ts|tsx)$/.test(name))
    .filter((file) => !/\.test\.(ts|tsx)$/.test(file));
  const calls = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const method of METHODS) {
      const pattern = new RegExp(`\\bapi\\.${method}(?:<[^>]*>)?\\(\\s*['\`]([^'\`]+)['\`]`, 'g');
      for (const match of source.matchAll(pattern)) {
        if (!match[1].startsWith('/')) continue;
        calls.push({
          file: path.relative(ROOT, file),
          method: method.toUpperCase(),
          raw: match[1],
          path: normalize(match[1]),
        });
      }
    }
  }
  return calls;
}

const declared = backendRoutes();
const calls = frontendCalls();

const unmatched = calls.filter((call) => !declared.has(call.path));
const report = [...new Set(unmatched.map((call) => `${call.method} ${call.raw}  (${call.file})`))].sort();

console.log(`backend paths declared : ${declared.size}`);
console.log(`frontend calls found   : ${calls.length}`);
console.log(`unmatched calls        : ${report.length}`);
if (report.length) console.log(`\n${report.join('\n')}`);

// Guard the walkers themselves: a refactor that stops finding either side must
// fail loudly rather than silently reporting a clean contract.
assert.ok(declared.size > 200, `expected to parse >200 backend paths, parsed ${declared.size}`);
assert.ok(calls.length > 100, `expected to find >100 frontend calls, found ${calls.length}`);
assert.deepEqual(report, [], 'frontend calls a path the backend does not declare');
console.log('\nOK: every frontend API call matches a declared backend route.');
