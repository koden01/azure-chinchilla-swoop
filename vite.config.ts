import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

// Generate self-signed certificate for development
const generateSelfSignedCert = () => {
  try {
    // Try to use existing certs if available
    if (fs.existsSync('./localhost-key.pem') && fs.existsSync('./localhost.pem')) {
      return {
        key: fs.readFileSync('./localhost-key.pem'),
        cert: fs.readFileSync('./localhost.pem')
      };
    }
  } catch (error) {
    console.log('No existing SSL certificates found, using HTTP');
  }
  return undefined;
};

const sslCert = generateSelfSignedCert();

// Create proper server configuration
const serverConfig = sslCert ? {
  host: "0.0.0.0",
  port: 8080,
  https: {
    key: sslCert.key,
    cert: sslCert.cert
  },
  strictPort: true,
} : {
  host: "0.0.0.0",
  port: 8080,
  strictPort: true,
};

export default defineConfig({
  server: serverConfig,
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: [],
  },
});