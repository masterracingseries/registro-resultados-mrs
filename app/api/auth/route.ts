import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: isAuthenticated(req) });
}
