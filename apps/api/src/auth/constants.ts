// In production this comes from a secret manager / env var.
export const JWT_SECRET = process.env.JWT_SECRET ?? 'edubeam-dev-secret-change-me';
