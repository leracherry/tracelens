import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function slowApi(): Plugin {
  return {
    name: 'tracelens-playground-api',
    configureServer(server) {
      server.middlewares.use('/api', (request, response, next) => {
        const route = request.url?.split('?')[0];
        const delay =
          route === '/checkout' ? 420 : route === '/settings' ? 180 : undefined;
        if (!delay) return next();
        setTimeout(() => {
          response.statusCode = route === '/checkout' ? 201 : 204;
          response.setHeader('content-type', 'application/json');
          response.end(
            route === '/checkout'
              ? JSON.stringify({ orderId: 'demo-order' })
              : undefined,
          );
        }, delay);
      });
    },
  };
}

export default defineConfig({ plugins: [react(), slowApi()] });
