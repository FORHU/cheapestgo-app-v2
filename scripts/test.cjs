// scripts/test.cjs
/**
 * Runs Vitest with Node's own experimental `localStorage`/`sessionStorage` globals turned off.
 *
 * Node 22+ defines `globalThis.localStorage` itself (functional only with `--localstorage-file`,
 * which nothing here passes), and on this project's Vitest/jsdom/Node combination that stub wins
 * over jsdom's real implementation instead of being replaced by it. Every test that touches
 * `localStorage` or `sessionStorage` directly then fails with "Cannot read properties of
 * undefined" — not a bug in the test or in whatever it's testing, just this Node version's own
 * global getting in jsdom's way.
 *
 * `NODE_OPTIONS` has to be set before a Node process starts; it cannot be flipped afterwards by
 * assigning `process.env` in a config file. This script exists only to set it on the *child*
 * process that actually runs Vitest, portably, without adding a `cross-env` dependency for one
 * flag. Used by the `test` and `test:watch` scripts in package.json.
 */
const { spawnSync } = require('node:child_process');

const nodeOptions = [process.env.NODE_OPTIONS, '--no-experimental-webstorage'].filter(Boolean).join(' ');

const result = spawnSync('npx', ['vitest', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

process.exit(result.status ?? 1);
