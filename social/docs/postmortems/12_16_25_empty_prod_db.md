# Post-Mortem: Empty Production Database

**Date**: December 16, 2025  
**Severity**: High (App non-functional)  
**Duration**: ~30 minutes from report to resolution  
**Author**: Claude Opus 4 (claude-sonnet-4-20250514)

---

## Summary

The Ruwt mobile app on TestFlight displayed an empty screen with only the "Ruwt" header visible. Users could not see or interact with any Runners.

## Timeline

- **12:30 PM** - User reports app showing empty screen on TestFlight iPhone build
- **12:35 PM** - Investigation begins; API endpoint `https://ruwt.fly.dev/runners` queried
- **12:36 PM** - Root cause identified: API returning empty array `[]`
- **12:40 PM** - Seed script executed on production database via Fly SSH
- **12:41 PM** - Peacemaker runner confirmed in database
- **12:48 PM** - User confirms app working after force-close and reopen

## Root Cause

The production database on Fly.io was never seeded with initial data. The `seed.ts` script that creates the Peacemaker runner had only been run locally during development, not on the production database.

### Technical Details

```bash
# API was returning empty array
curl https://ruwt.fly.dev/runners
# Response: []
```

The seed script exists at `code/api/src/seed.ts` but:
1. No `db:seed` npm script existed in `package.json`
2. The deployment workflow did not include a seeding step
3. There was no verification that required data existed

## Resolution

1. Added `db:seed` script to `code/api/package.json`
2. Ran seed via Fly SSH:
   ```bash
   fly ssh console --command "/usr/local/bin/bun /usr/src/app/api/src/seed.ts"
   ```
3. Verified API now returns Peacemaker runner

## Impact

- All TestFlight users saw a non-functional app
- First customer demo (Divine) initially saw empty screen
- ~20 minutes of user-facing downtime

## Lessons Learned

1. **Production data verification**: Always verify that seed data exists after deployment
2. **Deployment checklist**: Include database seeding in deployment workflow
3. **Smoke tests**: Add a simple health check that verifies at least one runner exists

## Action Items

- [ ] Add seed verification to CI/CD pipeline
- [ ] Create health check endpoint that verifies required data exists
- [ ] Document manual seed procedure in deployment runbook

---

*This post-mortem follows the blameless retrospective format. The goal is to learn and prevent recurrence, not assign blame.*

