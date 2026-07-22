import { type NextRequest } from 'next/server';

import { requireAuthenticatedUser } from '@/lib/auth';
import { predictRomeCode } from '@/lib/france-travail/romeo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();

  if (auth.response) {
    return auth.response;
  }

  const payload = (await request.json()) as { profession?: unknown };

  if (typeof payload.profession !== 'string' || !payload.profession.trim()) {
    return Response.json({ error: 'Profession manquante.' }, { status: 400 });
  }

  const prediction = await predictRomeCode(payload.profession);

  return Response.json(prediction);
}
