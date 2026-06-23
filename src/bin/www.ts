#!/usr/bin/env node

import http from "node:http";

import { createApp } from "../app.js";
import { getEnv } from "../config/env.js";
import { logger } from "../config/logger.js";
import { pool } from "../database/pool.js";

const app = createApp();
const port = normalizePort(getEnv().PORT);

app.set("port", port);

const server = http.createServer(app);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(value: number | string): number | string {
  const parsedPort =
    typeof value === "number" ? value : Number.parseInt(value, 10);

  if (Number.isNaN(parsedPort)) {
    return value;
  }

  return parsedPort >= 0 ? parsedPort : 4000;
}

function onError(error: NodeJS.ErrnoException) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind =
    typeof port === "string" ? `Pipe ${port}` : `Port ${String(port)}`;

  if (error.code === "EACCES") {
    logger.fatal({ bind }, "Requires elevated privileges");
    process.exit(1);
  }

  if (error.code === "EADDRINUSE") {
    logger.fatal({ bind }, "Address is already in use");
    process.exit(1);
  }

  throw error;
}

function onListening() {
  const address = server.address();
  const bind =
    typeof address === "string"
      ? `pipe ${address}`
      : `port ${String(address?.port ?? port)}`;

  logger.info({ bind }, "Ăn Gì Giờ? API started");
}

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
