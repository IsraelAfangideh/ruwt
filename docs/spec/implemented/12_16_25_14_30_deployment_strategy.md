# Deployment Strategy: OTA Updates vs Native Builds

**Date:** December 16, 2025  
**Author:** Claude (Opus 4.5)  
**Status:** Active

---

## Overview

This spec defines the deployment strategy for the Ruwt mobile application, balancing rapid iteration with Expo Free tier build limits (15 iOS + 15 Android builds/month).

---

## Deployment Types

### OTA (Over-the-Air) Updates
- **What it delivers:** JavaScript code, assets, and configuration changes
- **Who receives it:** All users with the app already installed
- **Latency:** Immediate (no app store review)
- **Cost:** Free and unlimited on Expo
- **Limitation:** Cannot deliver native code changes (new native modules, SDK upgrades)

### Native Builds
- **What it delivers:** Full app binary with native code
- **Who receives it:** New installs from app stores
- **Latency:** iOS: 1-2 day Apple review; Android: immediate after first approval
- **Cost:** Counts against Expo build limits
- **Requirement:** Needed for native dependency changes, Expo SDK upgrades, or first-time users

---

## Strategy

### Every Push to `main`
1. **Deploy API** to Fly.io
2. **Deploy Marketing Site** to Cloudflare Pages
3. **Publish OTA Update** to all installed apps

### Monthly (1st of each month, 9:00 AM UTC)
1. **Build & Submit Android** to Google Play Console
2. **Build & Submit iOS** to App Store Connect (TestFlight → App Store)

### Manual Trigger
- Use GitHub Actions workflow dispatch with `build_native: true` for emergency native builds

---

## Rationale

| Trigger | OTA | Native Build | Why |
|---------|-----|--------------|-----|
| Push to main | ✅ | ❌ | Most changes are JS-only; OTA is instant and free |
| Monthly schedule | ❌ | ✅ | Ensures new users get latest app; stays within free tier |
| Manual dispatch | Optional | ✅ | Emergency native fixes or SDK upgrades |

---

## Build Budget (Expo Free Tier)

- **Monthly limit:** 15 iOS + 15 Android builds
- **Scheduled usage:** 1 iOS + 1 Android = 2 builds/month
- **Reserve:** 13 builds per platform for emergencies/iterations

---

## New User Experience

New users downloading from the App Store receive:
1. The most recent **native build** (up to 1 month old)
2. Immediately after launch, the **latest OTA update** is applied

This means new users are at most seconds behind existing users, despite the monthly build cadence.

---

## Native Build Triggers

Force a native build (manual dispatch) when:
- Adding a new native module (e.g., camera, biometrics)
- Upgrading Expo SDK version
- Changing `app.json` native config (icons, splash, permissions)
- Critical native bug fix
- App store metadata changes requiring new binary

---

## Automation Capabilities

| Platform | Build | Submit | Go Live |
|----------|-------|--------|---------|
| Android | ✅ Automated | ✅ Automated | ✅ Automated* |
| iOS | ✅ Automated | ✅ Automated (TestFlight + App Store) | ⚠️ Apple reviews (1-2 days) |

*After first manual production release, Android `releaseStatus: "completed"` publishes automatically.

---

## Fastlane Integration

Full iOS App Store automation is configured via Fastlane:

### Files
- `code/mobile/Gemfile` - Ruby dependencies (fastlane, spaceship)
- `code/mobile/fastlane/Appfile` - Team ID and bundle identifier config
- `code/mobile/fastlane/Fastfile` - Lanes for status check and App Store submission
- `code/mobile/fastlane/check_store_status.rb` - Prevents builds during Apple review

### iOS Release Flow

```
EAS Build → TestFlight (auto) → Wait 5 min → Fastlane deliver → App Store Review
```

### Lanes

| Lane | Purpose |
|------|---------|
| `check_queue_status` | Checks if app is in review (skip if so) |
| `submit_for_review` | Submits latest TestFlight build to App Store |
| `release` | Combines status check + submission |

### Required Secrets

```yaml
APP_STORE_CONNECT_API_KEY_KEY        # API key content (p8 file contents)
APP_STORE_CONNECT_API_KEY_ISSUER_ID  # Issuer ID from App Store Connect
APP_STORE_CONNECT_API_KEY_KEY_ID     # Key ID from App Store Connect
```

---

## Future Considerations

- **Semantic versioning** to auto-increment versions based on commit messages
- **Upgrade to Expo On-demand** if build frequency needs increase
- **Fastlane metadata** management for screenshots and descriptions

---

## References

- [Expo EAS Update docs](https://docs.expo.dev/eas-update/introduction/)
- [Expo Build limits](https://docs.expo.dev/eas/pricing/)
- GitHub Actions workflow: `.github/workflows/deploy.yml`

