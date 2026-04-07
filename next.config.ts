import path from 'path'
import { fileURLToPath } from 'url'
import type { NextConfig } from 'next'

const root = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Evita que Turbopack tome `src/app` como raíz y falle el build (Next 16+).
  turbopack: {
    root,
  },
}

export default nextConfig
