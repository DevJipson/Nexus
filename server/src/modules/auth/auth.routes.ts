import { Router, type RequestHandler } from "express";
import {
  changePasswordBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from "./auth.schemas";
import { asyncHandler } from "../../middleware/async-handler";
import { validateBody } from "../../middleware/validate";
import type { CookiePolicy } from "../../lib/session-cookie";
import type { AuthControllerDeps } from "./auth.controller";
import { createAuthController } from "./auth.controller";
import type { createAuthRateLimiters } from "../../middleware/rate-limit";

export interface AuthRoutesDeps extends AuthControllerDeps {
  requireAuth: RequestHandler;
  rateLimiters: ReturnType<typeof createAuthRateLimiters>;
  cookiePolicy: CookiePolicy;
}

export function createAuthRoutes(deps: AuthRoutesDeps): Router {
  const router = Router();
  const controller = createAuthController(deps);
  const { requireAuth, rateLimiters } = deps;

  // Public
  router.post("/register", rateLimiters.register, validateBody(registerBodySchema), asyncHandler(controller.register));
  router.post("/login", rateLimiters.login, validateBody(loginBodySchema), asyncHandler(controller.login));
  router.post("/logout", asyncHandler(controller.logout));
  router.post("/verify-email", validateBody(verifyEmailBodySchema), asyncHandler(controller.verifyEmail));
  router.post(
    "/forgot-password",
    rateLimiters.forgotPassword,
    validateBody(forgotPasswordBodySchema),
    asyncHandler(controller.forgotPassword),
  );
  router.post(
    "/reset-password",
    rateLimiters.resetPassword,
    validateBody(resetPasswordBodySchema),
    asyncHandler(controller.resetPassword),
  );

  // Authenticated
  router.get("/me", requireAuth, asyncHandler(controller.me));
  router.get("/session", requireAuth, asyncHandler(controller.session));
  router.post("/resend-verification", requireAuth, asyncHandler(controller.resendVerification));
  router.patch(
    "/password",
    requireAuth,
    validateBody(changePasswordBodySchema),
    asyncHandler(controller.changePassword),
  );

  return router;
}
