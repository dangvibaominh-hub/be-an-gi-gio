import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

describe("API docs", () => {
  it("serves Swagger UI at /docs with the production server configured", async () => {
    const app = createApp();

    const pageResponse = await request(app).get("/docs/");

    expect(pageResponse.status).toBe(200);
    expect(pageResponse.headers["content-type"]).toContain("text/html");
    expect(pageResponse.text).toContain("An Gi Gio API Docs");

    const initResponse = await request(app).get("/docs/swagger-ui-init.js");

    expect(initResponse.status).toBe(200);
    expect(initResponse.text).toContain(
      "https://api-production-afd7.up.railway.app",
    );
    expect(initResponse.text).toContain("tryItOutEnabled");
  });
});
