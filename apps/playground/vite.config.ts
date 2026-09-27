import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function slowApi(): Plugin {
  return {
    name: 'tracelens-playground-api',
    configureServer(server) {
      server.middlewares.use('/api/settings', (request, response, next) => {
        if (request.method !== 'PATCH') return next();
        setTimeout(() => {
          response.statusCode = 204;
          response.end();
        }, 180);
      });
    },
  };
}

export default defineConfig({ plugins: [react(), slowApi()] });
