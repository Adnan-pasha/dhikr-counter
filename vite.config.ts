import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

const BUILD_MANIFEST_PLACEHOLDER = "/*__BUILD_MANIFEST__*/ { id: 'dev', assets: [] }";
// `.woff` twins of `.woff2` fonts are only fallbacks for ancient browsers; skip them.
const PRECACHE_EXTENSIONS = new Set(['.js', '.css', '.woff2', '.png', '.svg', '.wav', '.mp3', '.ogg']);

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );

/** Injects a content-hashed build id and the emitted asset list into dist/sw.js. */
const swBuildManifest = (): Plugin => ({
  name: 'sw-build-manifest',
  apply: 'build',
  closeBundle() {
    const dist = path.resolve(__dirname, 'dist');
    const swPath = path.join(dist, 'sw.js');
    if (!existsSync(swPath)) return;

    const assets = listFiles(path.join(dist, 'assets'))
      .filter((file) => PRECACHE_EXTENSIONS.has(path.extname(file)))
      .map((file) => path.relative(dist, file).split(path.sep).join('/'))
      .sort();

    const source = readFileSync(swPath, 'utf8');
    if (!source.includes(BUILD_MANIFEST_PLACEHOLDER)) {
      throw new Error('sw.js is missing the BUILD_MANIFEST placeholder');
    }

    const hash = createHash('sha256');
    hash.update(source);
    for (const asset of assets) hash.update(asset);
    const manifest = { id: hash.digest('hex').slice(0, 12), assets };

    writeFileSync(swPath, source.replace(BUILD_MANIFEST_PLACEHOLDER, JSON.stringify(manifest)));
  },
});

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss(), swBuildManifest()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
