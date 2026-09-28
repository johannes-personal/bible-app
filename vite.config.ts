import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths let the build be hosted from any sub-path (e.g. GitHub Pages).
  base: './',
})
