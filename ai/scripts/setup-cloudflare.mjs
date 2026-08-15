#!/usr/bin/env node
/**
 * Configure Cloudflare resources for ruwt.ai.
 *
 * Requires:
 *   CLOUDFLARE_API_TOKEN — Zone:Edit, Pages:Edit, D1:Edit
 *   CLOUDFLARE_ACCOUNT_ID — defaults to Ruwt account if unset
 *
 * This script does NOT purchase a domain. Add ruwt.ai to Cloudflare first,
 * then run this to wire DNS + Pages custom domain + D1 databases.
 *
 * ruwt.dev remains a separate Pages project and is not modified here.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WRANGLER_PATH = join(ROOT, 'wrangler.toml');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID ?? '32f5999dbd09eae38c1de8c15de98d48';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_ADMIN_API_TOKEN;
const DOMAIN = 'ruwt.ai';
const PAGES_PROJECT = 'ruwt-ai';
const PAGES_TARGET = `${PAGES_PROJECT}.pages.dev`;

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

async function getZone() {
  const zones = await cf(`/zones?name=${DOMAIN}`);
  return zones[0] ?? null;
}

async function ensureDns(zoneId) {
  const existing = await cf(`/zones/${zoneId}/dns_records?type=CNAME&name=${DOMAIN}`);
  const root = existing.find((record) => record.name === DOMAIN);
  if (!root) {
    await cf(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'CNAME',
        name: DOMAIN,
        content: PAGES_TARGET,
        proxied: true,
      }),
    });
    console.log(`Created CNAME ${DOMAIN} → ${PAGES_TARGET}`);
  } else {
    console.log(`CNAME ${DOMAIN} already exists (${root.content})`);
  }

  const wwwExisting = await cf(`/zones/${zoneId}/dns_records?type=CNAME&name=www.${DOMAIN}`);
  if (!wwwExisting.length) {
    await cf(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'CNAME',
        name: `www.${DOMAIN}`,
        content: PAGES_TARGET,
        proxied: true,
      }),
    });
    console.log(`Created CNAME www.${DOMAIN} → ${PAGES_TARGET}`);
  }
}

async function ensurePagesDomain() {
  try {
    const domains = await cf(`/accounts/${ACCOUNT_ID}/pages/projects/${PAGES_PROJECT}/domains`);
    const names = domains.map((entry) => entry.name);
    for (const name of [DOMAIN, `www.${DOMAIN}`]) {
      if (names.includes(name)) {
        console.log(`Pages domain already attached: ${name}`);
        continue;
      }
      await cf(`/accounts/${ACCOUNT_ID}/pages/projects/${PAGES_PROJECT}/domains`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      console.log(`Attached Pages custom domain: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('8000007') || message.includes('Project not found') || message.includes('10000')) {
      console.log(`Pages project "${PAGES_PROJECT}" not found yet — domain attach runs after first deploy.`);
      return;
    }
    throw error;
  }
}

async function ensureD1(name) {
  const databases = await cf(`/accounts/${ACCOUNT_ID}/d1/database`);
  const existing = databases.find((db) => db.name === name);
  if (existing) {
    console.log(`D1 ${name}: ${existing.uuid}`);
    return existing.uuid;
  }
  const created = await cf(`/accounts/${ACCOUNT_ID}/d1/database`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  console.log(`Created D1 ${name}: ${created.uuid}`);
  return created.uuid;
}

function patchWranglerIds(ids) {
  let contents = readFileSync(WRANGLER_PATH, 'utf8');
  contents = contents.replace(
    /(\[\[d1_databases\]\][\s\S]*?database_name = "ruwt-ai"\n)database_id = "[^"]+"/,
    `$1database_id = "${ids.production}"`,
  );
  contents = contents.replace(
    /(\[\[env\.preview\.d1_databases\]\][\s\S]*?database_name = "ruwt-ai-preview"\n)database_id = "[^"]+"/,
    `$1database_id = "${ids.preview}"`,
  );
  contents = contents.replace(
    /(\[\[env\.production\.d1_databases\]\][\s\S]*?database_name = "ruwt-ai"\n)database_id = "[^"]+"/,
    `$1database_id = "${ids.production}"`,
  );
  writeFileSync(WRANGLER_PATH, contents);
  console.log('Updated ai/wrangler.toml with D1 database IDs.');
}

async function main() {
  console.log(`Setting up ${DOMAIN} (Pages project: ${PAGES_PROJECT})`);
  console.log('ruwt.dev is untouched — separate app, separate deploy pipeline.\n');

  const productionId = await ensureD1('ruwt-ai');
  const previewId = await ensureD1('ruwt-ai-preview');
  patchWranglerIds({ production: productionId, preview: previewId });

  const zone = await getZone();
  if (!zone) {
    console.log('\nNo Cloudflare zone found for ruwt.ai.');
    console.log('Next steps:');
    console.log('  1. Register ruwt.ai at your registrar (or transfer to Cloudflare Registrar).');
    console.log('  2. Add the domain to Cloudflare and point nameservers to Cloudflare.');
    console.log('  3. Re-run this script to create DNS records and attach the Pages domain.');
    console.log(`  4. Until then, use https://${PAGES_TARGET} as the fallback URL.`);
    return;
  }

  await ensureDns(zone.id);
  await ensurePagesDomain();

  console.log('\nDone. Next steps:');
  console.log('  • Add Supabase redirect URLs for https://ruwt.ai/callback and preview branches.');
  console.log('  • Merge to main to trigger deploy-ai.yml, or deploy manually from ai/.');
  console.log('  • Desktop collector defaults to https://ruwt.ai/api/intelligence/events');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
