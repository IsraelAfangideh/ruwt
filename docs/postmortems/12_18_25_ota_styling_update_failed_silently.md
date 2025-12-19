# Post-Mortem: OTA Update Blocked by API Deployment Dependency

**Date**: December 18, 2025  
**Severity**: Medium (UI bug fix delayed, user-facing issue not resolved)  
**Duration**: ~2 hours from merge to manual fix  
**Author**: Auto (claude-sonnet-4-20250514)

---

## Summary

A critical UI bug fix ("Make Kinder" button invisible in light mode) was merged to `main` but did not reach users' devices via OTA update. The OTA update job was blocked by a dependency on the API deployment job, preventing immediate delivery of frontend fixes.

## Timeline

- **~3:00 PM** - Bug fix committed: `fix(mobile): make kinder button text visible in light mode` (commit `990cf68`)
- **~3:15 PM** - Fix merged to `main` via PR #26
- **~3:20 PM** - GitHub Actions workflow triggered
- **~3:25 PM** - API deployment job running (may have succeeded or failed)
- **~3:30 PM** - OTA update job **blocked** waiting for `deploy-api` to complete
- **~5:00 PM** - User reports fix not appearing on iPhone
- **~5:15 PM** - Investigation reveals OTA update dependency issue
- **~5:20 PM** - Dependency removed from workflow (`needs: deploy-api` deleted)
- **~5:25 PM** - Manual OTA update triggered via EAS CLI
- **~5:30 PM** - Update published successfully to production branch

## Root Cause

The `mobile-ota-update` job in `.github/workflows/deploy.yml` had an unnecessary dependency:

mobile-ota-update:
  needs: deploy-api  # ← This blocked OTA updates**Why this was problematic:**

1. **No logical dependency**: Frontend code changes (UI fixes, styling) have zero dependency on API state. The app can work with an older API version while receiving new frontend updates.

2. **Single point of failure**: If API deployment fails, hangs, or is slow, all OTA updates are blocked—even for completely unrelated frontend changes.

3. **Delayed user fixes**: Critical UI/UX fixes that should go live in minutes were delayed by hours.

4. **Unnecessary coupling**: Mobile app updates should be independent of backend deployments.

## Resolution

1. **Removed dependency**: Deleted `needs: deploy-api` from `mobile-ota-update` job
2. **Manual trigger**: Published OTA update immediately via `eas update --branch production`
3. **Verified**: Update successfully published with runtime version `1.0.1`

## Impact

- **User-facing**: "Make Kinder" button remained invisible in light mode for ~2 hours
- **Developer experience**: Frustration that a simple fix didn't deploy automatically
- **Trust**: Users may have thought the bug wasn't fixed

## Lessons Learned

1. **Decouple deployment jobs**: Frontend and backend deployments should be independent unless there's a true dependency
2. **OTA updates are critical**: These are user-facing fixes that should go live immediately
3. **Dependency review**: Every `needs:` in CI/CD should be questioned—is it truly required?
4. **Manual escape hatch**: Having EAS CLI available for manual OTA updates is essential for urgent fixes

## Action Items

- [x] Remove `needs: deploy-api` from `mobile-ota-update` job (completed)
- [ ] Document manual OTA update procedure for urgent fixes
- [ ] Consider adding a separate "urgent OTA" workflow that can be manually triggered
- [ ] Add monitoring/alerting if OTA updates fail to publish
- [ ] Review all other job dependencies for unnecessary coupling

## Recommendations

### 1. Keep OTA Updates Independent ✅ (Already Done)

The `mobile-ota-update` job should run independently of API deployments. Frontend changes can always work with older API versions.

### 2. Manual EAS CLI for Urgent Fixes ✅ (Recommended)

**Yes, absolutely use EAS CLI for quick OTA updates.** Benefits:

- **Speed**: Can push fixes in ~30 seconds vs waiting for full CI/CD pipeline
- **Control**: Developer can verify the update before publishing
- **Urgency**: Critical fixes can go live immediately without waiting for other jobs

**Suggested workflow:**
# For urgent fixes
cd code/mobile
eas update --branch production --message "URGENT: [description]"

# For regular fixes, let CI/CD handle it automatically### 3. Consider Separate "Hotfix" Workflow

Create a lightweight workflow that only runs OTA updates (no API, no website) for when you need to push fixes immediately:
ml
mobile-ota-hotfix:
  name: Publish OTA Hotfix
  runs-on: ubuntu-latest
  if: github.event_name == 'workflow_dispatch'
  # ... minimal setup, just publish updateThis gives you a "panic button" for urgent fixes without waiting for full deployment pipeline.

---

*This post-mortem follows the blameless retrospective format. The goal is to learn and prevent recurrence, not assign blame.*