import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Adapts an async Express handler so rejected promises reach the error
 * middleware. Express 5 forwards rejections automatically, but wrapping keeps
 * intent explicit and behavior stable across Express majors.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
