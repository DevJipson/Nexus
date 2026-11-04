import type { ErrorRequestHandler, Request, Response } from "express";
import { ZodError } from "zod";
import {
  HttpError,
  isForeignKeyViolation,
  isUniqueViolation,
  toErrorBody,
} from "../lib/errors";
import type { Logger } from "../lib/logger";

export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json(toErrorBody("NOT_FOUND", `Route ${req.method} ${req.path} was not found.`));
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (res.headersSent) return;

    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      }));
      res
        .status(400)
        .json(toErrorBody("VALIDATION_ERROR", "The request payload is invalid.", details));
      return;
    }

    if (error instanceof HttpError) {
      res.status(error.status).json(toErrorBody(error.code, error.message, error.details));
      return;
    }

    // Malformed JSON body thrown by express.json().
    if (
      error instanceof SyntaxError &&
      "body" in error &&
      (error as { type?: string }).type === "entity.parse.failed"
    ) {
      res.status(400).json(toErrorBody("VALIDATION_ERROR", "Malformed JSON body."));
      return;
    }

    if (isUniqueViolation(error)) {
      logger.warn({ err: error, reqId: req.id }, "unique constraint violated");
      res.status(409).json(toErrorBody("CONFLICT", "The resource already exists."));
      return;
    }

    if (isForeignKeyViolation(error)) {
      logger.warn({ err: error, reqId: req.id }, "foreign key violated");
      res
        .status(400)
        .json(toErrorBody("VALIDATION_ERROR", "The request references a resource that does not exist."));
      return;
    }

    logger.error({ err: error, reqId: req.id }, "unhandled request error");
    res.status(500).json(toErrorBody("INTERNAL", "Something went wrong on our side."));
  };
}
