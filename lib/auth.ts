import { NextRequest } from 'next/server';

export const COOKIE_NAME = 'mrs_auth';

export function generateToken(): string {
  return Buffer.from(`mrs:${process.env.ADMIN_PASSWORD}:2026`).toString('base64');
}

export function isAuthenticated(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  return !!cookie && cookie.value === generateToken();
}
