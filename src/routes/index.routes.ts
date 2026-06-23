import { Router } from "express";

export const indexRouter = Router();

indexRouter.get("/health", (_request, response) => {
  response.json({
    success: true,
    data: { status: "ok", service: "an-gi-gio-backend" },
  });
});
