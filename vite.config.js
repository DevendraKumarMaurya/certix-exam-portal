import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - split large libraries
          "react-vendor": ["react", "react-dom", "react-router"],
          "firebase-vendor": [
            "firebase/auth",
            "firebase/firestore",
            "firebase/app",
          ],
          "ui-vendor": ["lucide-react", "react-hot-toast"],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router",
      "lucide-react",
      "react-hot-toast",
    ],
  },
});
