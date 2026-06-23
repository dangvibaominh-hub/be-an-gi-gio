import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { ZodError } from "zod";

import { logger } from "../../config/logger.js";
import { AppError } from "./app-error.js";

export const notFoundHandler: RequestHandler = (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `Không tìm thấy endpoint ${request.method} ${request.originalUrl}.`,
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  void next;
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ.",
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  logger.error(
    { error, method: request.method, path: request.originalUrl },
    "Unhandled request error",
  );

  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    },
  });
};
