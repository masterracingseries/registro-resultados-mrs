import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { extractRaceResults } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { image } = await req.json();
  if (!image) {
    return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 });
  }

  const base64 = image.includes(',') ? image.split(',')[1] : image;
  const mimeType = image.startsWith('data:')
    ? (image.split(';')[0].split(':')[1] as string)
    : 'image/png';

  try {
    const results = await extractRaceResults(base64, mimeType);
    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[extract]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
