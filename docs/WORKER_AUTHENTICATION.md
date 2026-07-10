# Worker authentication

`InternalServiceTokenService` issues 60-second JWTs containing issuer, audience, service, `jti`, organization/workspace/task scope, correlation ID and allowed actions. Ordinary user tokens are never forwarded. Validation supports current/previous secrets and consumes each `jti` once through Redis.

Configure `INTERNAL_AUTH_SECRET`, optional `INTERNAL_AUTH_PREVIOUS_SECRET`, issuer, audience and service allowlist. Heartbeat identity must match its authenticated worker type.
