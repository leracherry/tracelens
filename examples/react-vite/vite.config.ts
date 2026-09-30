import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tracelens } from '@leracherry/tracelens-vite';

export default defineConfig({
  plugins: [tracelens(), react()],
});
