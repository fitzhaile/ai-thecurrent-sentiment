import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' -> relative asset paths, so the built site deploys from any host or
// subfolder without reconfiguration ("deploy on its own").
export default defineConfig({
  plugins: [react()],
  base: './',
})
