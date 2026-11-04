import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { httpError } from "../lib/errors";

/**
 * Zod validation middleware.
 *
 * Parsed (and coerced/normalized) values replace the raw request locations so
 * controllers always see validated data. Validation failures surface as the
 * standard VALIDATION_ERROR envelope via the central error handler.
 */

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(normalize(error));
    }
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      // Express 5 exposes req.query as a getter; store the validated value
      // where handlers can read it deterministically.
      res.locals.query = parsed;
      next();
    } catch (error) {
      next(normalize(error));
    }
  };
}

export function validateParams<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params);
      res.locals.params = parsed;
      next();
    } catch (error) {
      next(normalize(error));
    }
  };
}

function normalize(error: unknown): Error {
  if (error instanceof ZodError) return error; // handled by the error middleware
  return httpError.validation();
}

export function queryOf<T>(res: Response): T {
  return res.locals.query as T;
}

export function paramsOf<T>(res: Response): T {
  return res.locals.params as T;
}
