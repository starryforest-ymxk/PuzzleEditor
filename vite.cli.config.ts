/** CLI 使用纯 Node 构建；不加载 GUI 插件、环境变量或入口页面。 */
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const product = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  publicDir: false,
  plugins: [
    {
      name: 'cli-module-boundary',
      generateBundle(_options, bundle) {
        const forbidden =
          /(?:^|\/)node_modules\/(?:react(?:-dom)?|electron)(?:\/|$)|(?:^|\/)(?:components|hooks)\//;
        for (const output of Object.values(bundle)) {
          if (
            output.type === 'chunk' &&
            Object.keys(output.modules).some((id) => forbidden.test(id.replaceAll('\\', '/')))
          ) {
            throw new Error('CLI output contains a GUI runtime dependency.');
          }
        }
        this.emitFile({
          type: 'asset',
          fileName: 'package.json',
          source:
            JSON.stringify({
              type: 'module',
              private: true,
              name: 'puzzle-editor-cli',
              version: product.version,
              engines: product.engines,
            }) + '\n',
        });
      },
    },
  ],
  ssr: { noExternal: true },
  build: {
    ssr: 'cli/main.ts',
    target: 'node20',
    outDir: 'dist-cli',
    emptyOutDir: true,
    minify: false,
    rollupOptions: { output: { entryFileNames: 'cli.js' } },
  },
});
