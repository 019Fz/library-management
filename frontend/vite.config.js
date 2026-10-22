import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // tailwindcss() enables Tailwind v4 (no separate config file needed)
  plugins: [react(), tailwindcss()],
  // Read the one .env in the repository root. Only variables starting with VITE_ reach the browser.
  envDir: '..',
  server: { port: 5173 },
})
