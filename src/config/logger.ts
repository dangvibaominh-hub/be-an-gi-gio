import pino from "pino";

import { getEnv } from "./env.js";

export const logger = pino({
  level: getEnv().LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
    ],
    censor: "[REDACTED]",
  },
});
