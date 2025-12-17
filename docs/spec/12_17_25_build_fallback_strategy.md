# Build Fallback Strategy: EAS Cloud → Local → Self-Hosted

**Date:** December 17, 2025  
**Author:** Claude (Opus 4.5)  
**Status:** Active  
**Amends:** `12_16_25_14_30_deployment_strategy.md`

---

## Principle

Use EAS cloud builds when free tier is available. Fall back to local or self-hosted builds when limits are hit. **Never let build limits block shipping.**

---

## Build Priority Order

| Priority | Method | When to Use | Cost |
|----------|--------|-------------|------|
| 1 | EAS Cloud | Free tier available (< 15 builds/month) | Free |
| 2 | Local Build | Free tier exhausted, Mac available | Free |
| 3 | Self-Hosted Runner | CI/CD needed, Mac available | Free |
| 4 | EAS On-demand | Urgent, no Mac access | ~$1.50/build |

---

## Commands

### EAS Cloud Build (Default)
```bash
eas build --platform ios --profile production --auto-submit --non-interactive
eas build --platform android --profile production --auto-submit --non-interactive
```

### Local Build (Fallback)
```bash
# iOS (requires macOS + Xcode)
eas build --platform ios --profile production --local --output ./build-ios.ipa

# Android (requires Java + Android SDK)
eas build --platform android --profile production --local --output ./build-android.apk

# Then submit manually
eas submit --platform ios --path ./build-ios.ipa
eas submit --platform android --path ./build-android.apk
```

### Check Build Credits
```bash
# View current usage at:
# https://expo.dev/accounts/israelafangideh/settings/billing
```

---

## Local Build Requirements

### iOS
- macOS (any recent version)
- Xcode 15+ installed
- `xcode-select --install` for CLI tools
- CocoaPods: `sudo gem install cocoapods`
- ~20-30 min build time

### Android
- Java 17+ (`brew install openjdk@17`)
- Android SDK (`brew install --cask android-studio` or standalone SDK)
- Set `ANDROID_HOME` environment variable
- ~15-20 min build time

---

## GitHub Actions Self-Hosted Runner (Future)

For fully automated fallback, set up a self-hosted Mac runner:

```yaml
# .github/workflows/deploy.yml
ios-store-build:
  runs-on: self-hosted  # Your Mac instead of ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: eas build --platform ios --profile production --local
    - run: eas submit --platform ios --latest
```

### Setup Steps
1. Go to repo Settings → Actions → Runners → New self-hosted runner
2. Follow instructions to install runner on your Mac
3. Keep Mac on and connected for CI/CD

---

## Decision Tree

```
Need to build?
    │
    ▼
Check EAS credits (expo.dev/accounts/.../billing)
    │
    ├─► Credits available → eas build (cloud)
    │
    └─► Credits exhausted
            │
            ├─► Mac available? → eas build --local
            │
            ├─► Urgent + no Mac? → Upgrade to On-demand ($1.50)
            │
            └─► Can wait? → Wait for monthly reset
```

---

## Monthly Build Budget

| Source | iOS | Android | Total |
|--------|-----|---------|-------|
| EAS Free | 15 | 15 | 30 |
| Local | ∞ | ∞ | ∞ |
| **Effective** | **Unlimited** | **Unlimited** | **Unlimited** |

With local fallback, build limits are a **convenience constraint**, not a blocker.

---

## Output Equivalence

Local builds produce **byte-for-byte identical** apps to cloud builds:
- Same signing credentials
- Same native code
- Same OTA update compatibility
- Same App Store acceptance

The only difference is where the compilation happens.

---

## Related Specs
- `12_16_25_14_30_deployment_strategy.md` - OTA vs Native build cadence

