#!/usr/bin/env node
/**
 * Ensure Cloudflare resources required for dev preview deploys.
 *
 * Requires CLOUDFLARE_API_TOKEN (or CLOUDFLARE_ADMIN_API_TOKEN) with
 * Workers R2 Storage: Edit for bucket creation.
 */
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? '32f5999dbd09eae38c1de8c15de98d48';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_ADMIN_API_TOKEN;
const PREVIEW_BUCKET = 'ruwt-projects-preview';

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (or CLOUDFLARE_ADMIN_API_TOKEN) before running.');
  process.exit(1);
}

async function cf(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const json = await response.json();
  if (!json.success) {
    throw new Error(JSON.stringify(json.errors ?? json));
  }
  return json.result;
}

async function ensureR2Bucket(name) {
  const buckets = await cf(`/accounts/${ACCOUNT_ID}/r2/buckets`);
  const existing = buckets.buckets?.find((bucket) => bucket.name === name);
  if (existing) {
    console.log(`R2 bucket "${name}" already exists.`);
    return;
  }

  await cf(`/accounts/${ACCOUNT_ID}/r2/buckets`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  console.log(`Created R2 bucket "${name}".`);
}

ensureR2Bucket(PREVIEW_BUCKET).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(
    `\nAdd "Workers R2 Storage: Edit" to CLOUDFLARE_ADMIN_API_TOKEN, or create "${PREVIEW_BUCKET}" manually in the Cloudflare dashboard.`,
  );
  process.exit(1);
});
