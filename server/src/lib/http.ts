import type { Response } from "express";

/** Success envelope: every 2xx response is `{ data: ... }`. */
export function sendData(res: Response, status: number, data: unknown): void {
  res.status(status).json({ data });
}
