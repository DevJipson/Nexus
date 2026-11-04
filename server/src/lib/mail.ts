import type { Env } from "../config/env";
import type { Logger } from "./logger";

/**
 * Email transport abstraction.
 *
 * Development and test use a console transport that logs the full message —
 * including verification and password-reset links — so no paid email service is
 * required to develop or test account flows. Production would use a
 * transactional provider (Resend, per D6); the interface is provider-agnostic
 * and the provider can be wired without touching call sites.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body (always provided). */
  text: string;
  /** Optional HTML body. */
  html?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export interface ConsoleEmailTransportOptions {
  logger: Logger;
  /** When false, the console transport is silent except at debug level. */
  verbose?: boolean;
}

export function createConsoleEmailTransport(
  options: ConsoleEmailTransportOptions,
): EmailTransport {
  const { logger } = options;
  const verbose = options.verbose ?? true;
  return {
    async send(message) {
      // The body is intentionally logged in full during development so
      // verification and reset links are visible in the terminal.
      const context = `to=${message.to} subject="${message.subject}"`;
      if (verbose) {
        logger.info({ email: context, body: message.text }, "[email] outbound message");
      } else {
        logger.debug({ email: context, body: message.text }, "[email] outbound message");
      }
    },
  };
}

/**
 * Placeholder for the production provider. It fails loudly rather than
 * silently dropping mail, so a misconfigured deployment is obvious.
 */
export function createDisabledEmailTransport(): EmailTransport {
  return {
    async send(message) {
      throw new Error(
        `Email transport is not configured; refusing to silently drop message to ${message.to} ("${message.subject}").`,
      );
    },
  };
}

export function createEmailTransport(env: Env, logger: Logger): EmailTransport {
  // Phase 2 ships the console transport for every environment. Wiring Resend
  // (or another provider) replaces this with an API-backed transport.
  if (env.nodeEnv === "production") {
    logger.warn(
      "using console email transport in production — configure a real provider before relying on email delivery",
    );
  }
  return createConsoleEmailTransport({ logger, verbose: !env.isTest });
}
