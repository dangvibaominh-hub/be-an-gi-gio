import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateQuery(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const validatedQuery = schema.parse(request.query) as unknown;
    response.locals.validatedQuery = validatedQuery;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const validatedParams = schema.parse(request.params) as unknown;
    response.locals.validatedParams = validatedParams;
    next();
  };
}

export function validateBody(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const validatedBody = schema.parse(request.body) as unknown;
    response.locals.validatedBody = validatedBody;
    next();
  };
}
