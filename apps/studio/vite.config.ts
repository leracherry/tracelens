import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';

function collector(): Plugin {
  const events: AnyTraceLensEvent[] = [];
  return {
    name: 'tracelens-local-collector',
    configureServer(server) {
      server.middlewares.use('/__tracelens', (request, response, next) => {
        response.setHeader('access-control-allow-origin', '*');
        response.setHeader('access-control-allow-headers', 'content-type');
        if (request.method === 'OPTIONS') {
          response.statusCode = 204;
          response.end();
          return;
        }
        if (request.method === 'GET') {
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify(events));
          return;
        }
        if (request.method === 'DELETE') {
          events.length = 0;
          response.statusCode = 204;
          response.end();
          return;
        }
        if (request.method !== 'POST') return next();
        let body = '';
        request.on('data', (chunk) => (body += String(chunk)));
        request.on('end', () => {
          try {
            const incoming = JSON.parse(body) as AnyTraceLensEvent[];
            events.push(...incoming);
            response.statusCode = 202;
            response.end();
          } catch {
            response.statusCode = 400;
            response.end('Invalid telemetry payload');
          }
        });
      });
    },
  };
}

export default defineConfig({ plugins: [react(), collector()] });
