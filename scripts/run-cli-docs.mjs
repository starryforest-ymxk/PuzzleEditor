/** 用 Vite 的既有 TS 加载能力运行文档生成器；独立文件名避免 TS 导入命中启动入口。 */
import { createServer } from 'vite';
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { generateReference } = await server.ssrLoadModule('/scripts/cli-docs.ts');
  await generateReference(process.argv.includes('--check'));
} finally {
  await server.close();
}
