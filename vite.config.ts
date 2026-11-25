import { defineConfig, loadEnv, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';
import { editorialApi } from './server/editorial';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'GEMINI_');
  const api = editorialApi({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
  const editorial: Plugin = {
    name: 'folio-editorial-api',
    configureServer(server) { server.middlewares.use(api); },
    configurePreviewServer(server) { server.middlewares.use(api); },
  };
  return { plugins: [solid(), editorial] };
});
