import { defineConfig } from "orval";

export default defineConfig({
  compass: {
    input: {
      target: "./openapi/compass-api.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/lib/api/generated/index.ts",
      schemas: "./src/lib/api/generated/model",
      client: "fetch",
      clean: true,
      override: {
        mutator: {
          path: "./src/lib/api/client.ts",
          name: "compassFetch",
        },
        fetch: {
          includeHttpResponseReturnType: true,
          serializeResponseHeaders: true,
        },
      },
    },
  },
});
