/**
 * POST /api/machines — Machine lifecycle management. Auth required.
 *
 * Operations are determined by the `action` field in the request body:
 *   - start:  Start or resume a user's Cloud Machine.
 *   - stop:   Stop a user's machine (keep allocated, just stopped).
 *   - status: Check machine status.
 *
 * GET /api/machines — Check machine status (convenience alias).
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../_shared/infra/db';
import { getUser } from '../_shared/infra/auth';
import { ensureProfile } from '../_shared/ensure-profile';
import { cloudMachines } from '../../drizzle/schema.d1';

const FLY_API = 'https://api.machines.dev/v1';
const FLY_APP = 'ruwt-cloud';

type MachineSpec = 'light' | 'medium' | 'heavy';

function specToMemory(spec: MachineSpec): number {
  switch (spec) {
    case 'heavy': return 2048;
    case 'medium': return 1024;
    default: return 512;
  }
}

interface StartBody {
  action: 'start';
  projectId?: string;
  spec?: MachineSpec;
}

interface StopBody {
  action: 'stop';
}

interface StatusBody {
  action: 'status';
}

type RequestBody = StartBody | StopBody | StatusBody;

// ── GET /api/machines (status check) ────────────────────────────────────

export async function onRequestGet(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const [machine] = await db
      .select()
      .from(cloudMachines)
      .where(eq(cloudMachines.userId, user.id))
      .limit(1);

    if (!machine) {
      return Response.json({ status: 'none' });
    }

    return Response.json({
      status: machine.status,
      machineId: machine.flyMachineId,
      wsUrl: `wss://${FLY_APP}.fly.dev`,
    });
  } catch (error) {
    console.error('Machines GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/machines (start / stop / status) ─────────────────────────

export async function onRequestPost(context: { request: Request; env: Env; waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getDb(context.env);
    await ensureProfile(db, user, context.env, context.waitUntil);

    const body = await context.request.json().catch(() => ({})) as RequestBody;
    const action = body.action;

    if (!action || !['start', 'stop', 'status'].includes(action)) {
      return Response.json({ error: 'Invalid action. Must be start, stop, or status.' }, { status: 400 });
    }

    switch (action) {
      case 'start':
        return handleStart(db, user, context.env, body as StartBody);
      case 'stop':
        return handleStop(db, user, context.env);
      case 'status':
        return handleStatus(db, user);
    }
  } catch (error) {
    console.error('Machines POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Handlers ────────────────────────────────────────────────────────────

async function handleStart(
  db: ReturnType<typeof getDb>,
  user: { id: string },
  env: Env,
  body: StartBody,
): Promise<Response> {
  const flyToken = env.FLY_API_TOKEN;
  if (!flyToken) {
    return Response.json({ error: 'Cloud Mode not configured' }, { status: 503 });
  }

  const spec: MachineSpec = body.spec && ['light', 'medium', 'heavy'].includes(body.spec)
    ? body.spec
    : 'light';
  const bridgeToken = crypto.randomUUID();

  // Check if user already has a machine
  const [existing] = await db
    .select()
    .from(cloudMachines)
    .where(eq(cloudMachines.userId, user.id))
    .limit(1);

  if (existing) {
    // Machine exists — try to start it
    if (existing.status === 'running') {
      return Response.json({
        machineId: existing.flyMachineId,
        wsUrl: `wss://${FLY_APP}.fly.dev`,
        token: existing.bridgeToken,
      });
    }

    // Start the stopped machine
    const startRes = await fetch(
      `${FLY_API}/apps/${FLY_APP}/machines/${existing.flyMachineId}/start`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flyToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!startRes.ok) {
      const errText = await startRes.text().catch(() => 'unknown');
      return Response.json({ error: `Failed to start machine: ${errText}` }, { status: 502 });
    }

    // Update token and status
    await db
      .update(cloudMachines)
      .set({
        bridgeToken,
        status: 'running',
        lastActiveAt: new Date().toISOString(),
      })
      .where(eq(cloudMachines.id, existing.id));

    return Response.json({
      machineId: existing.flyMachineId,
      wsUrl: `wss://${FLY_APP}.fly.dev`,
      token: bridgeToken,
    });
  }

  // No existing machine — create a new one
  const createRes = await fetch(`${FLY_API}/apps/${FLY_APP}/machines`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${flyToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      config: {
        image: `registry.fly.io/${FLY_APP}:latest`,
        env: { BRIDGE_TOKEN: bridgeToken, WORKSPACE: '/home/dev/workspace' },
        services: [{
          ports: [{ port: 443, handlers: ['tls', 'http'] }],
          internal_port: 8080,
          protocol: 'tcp',
        }],
        guest: {
          cpu_kind: 'shared',
          cpus: 1,
          memory_mb: specToMemory(spec),
        },
      },
      region: 'iad',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => 'unknown');
    return Response.json({ error: `Failed to create machine: ${errText}` }, { status: 502 });
  }

  const created = await createRes.json() as { id: string };

  // Store in D1
  const machineId = crypto.randomUUID();
  await db.insert(cloudMachines).values({
    id: machineId,
    userId: user.id,
    flyMachineId: created.id,
    bridgeToken,
    spec,
    status: 'running',
    region: 'iad',
  });

  return Response.json({
    machineId: created.id,
    wsUrl: `wss://${FLY_APP}.fly.dev`,
    token: bridgeToken,
  }, { status: 201 });
}

async function handleStop(
  db: ReturnType<typeof getDb>,
  user: { id: string },
  env: Env,
): Promise<Response> {
  const flyToken = env.FLY_API_TOKEN;
  if (!flyToken) {
    return Response.json({ error: 'Cloud Mode not configured' }, { status: 503 });
  }

  const [machine] = await db
    .select()
    .from(cloudMachines)
    .where(eq(cloudMachines.userId, user.id))
    .limit(1);

  if (!machine) {
    return Response.json({ error: 'No machine found' }, { status: 404 });
  }

  if (machine.status === 'stopped') {
    return Response.json({ status: 'stopped', machineId: machine.flyMachineId });
  }

  const stopRes = await fetch(
    `${FLY_API}/apps/${FLY_APP}/machines/${machine.flyMachineId}/stop`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flyToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!stopRes.ok) {
    const errText = await stopRes.text().catch(() => 'unknown');
    return Response.json({ error: `Failed to stop machine: ${errText}` }, { status: 502 });
  }

  await db
    .update(cloudMachines)
    .set({ status: 'stopped', lastActiveAt: new Date().toISOString() })
    .where(eq(cloudMachines.id, machine.id));

  return Response.json({ status: 'stopped', machineId: machine.flyMachineId });
}

async function handleStatus(
  db: ReturnType<typeof getDb>,
  user: { id: string },
): Promise<Response> {
  const [machine] = await db
    .select()
    .from(cloudMachines)
    .where(eq(cloudMachines.userId, user.id))
    .limit(1);

  if (!machine) {
    return Response.json({ status: 'none' });
  }

  return Response.json({
    status: machine.status,
    machineId: machine.flyMachineId,
    wsUrl: machine.status === 'running' ? `wss://${FLY_APP}.fly.dev` : undefined,
  });
}
