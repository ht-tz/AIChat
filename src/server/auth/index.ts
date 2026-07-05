// 权限认证模块 —— 统一导出

export {
  authService,
  type RegisterInput,
  type LoginInput,
  type OAuthLoginInput,
  type TokenPayload,
  type AuthResult,
  type ApiKeyResult,
} from "./auth-service";

export {
  authenticateRequest,
  requireAuth,
  requireRole,
  optionalAuth,
  type AuthContext,
} from "./auth-middleware";

export {
  oauthService,
  type OAuthProvider,
  type OAuthConfig,
  type OAuthUserInfo,
  type OAuthAuthorizeParams,
} from "./oauth-service";

export { emailService } from "./email-service";
