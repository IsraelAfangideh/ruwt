/**
 * GET /api/cert/:shareToken
 * Public endpoint returning certificate data for verification.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../../_shared/db';
import { certificates, profiles } from '../../../drizzle/schema.d1';

export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: Promise<{ shareToken?: string }>;
}) {
  try {
    const params = await context.params;
    const shareToken = params?.shareToken;
    if (!shareToken) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    const db = getDb(context.env);

    const [cert] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.shareToken, shareToken))
      .limit(1);

    if (!cert) {
      return Response.json({ error: 'Certificate not found' }, { status: 404 });
    }

    const [holder] = await db
      .select({
        name: profiles.name,
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(eq(profiles.id, cert.userId))
      .limit(1);

    return Response.json({
      id: cert.id,
      type: cert.type,
      title: cert.title,
      metadata: cert.metadata ? JSON.parse(cert.metadata) : null,
      shareToken: cert.shareToken,
      earnedAt: cert.earnedAt,
      holder: holder || null,
    });
  } catch (error) {
    console.error('Certificate get error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
