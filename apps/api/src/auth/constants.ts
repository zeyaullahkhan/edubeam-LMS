// In production this comes from a secret manager / env var (Render injects it).
// We never fall back to a hard-coded secret in production: a known default would
// let anyone forge admin tokens. Fail fast on boot instead.
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required in production. Refusing to start with an insecure default.',
  );
}

export const JWT_SECRET = process.env.JWT_SECRET ?? 'edubeam-dev-secret-change-me';
