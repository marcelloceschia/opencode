import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import desktopPlugin from "./vite"

export default defineConfig({
  plugins: [
    ...desktopPlugin,
    // kilocode_change - PWA support for push notifications
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw-push.ts",
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "web-app-manifest-192x192.png"],
      manifest: {
        name: "OpenCode",
        short_name: "OpenCode",
        description: "AI-powered coding assistant",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      },
      devOptions: {
        enabled: true,
      },
    }),
  ] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
    // sourcemap: true,
  },
})
