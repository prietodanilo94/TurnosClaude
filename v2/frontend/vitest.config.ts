import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["tests/**", "node_modules/**"],
    env: {
      NEXT_PUBLIC_APPWRITE_DATABASE_ID: "test-db",
      NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://test.example.com/v1",
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: "test-project",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
