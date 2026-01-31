# Build Fallback Strategy Revision

**Date:** December 17, 2025 (3:30 PM)  
**Author:** Claude (Opus 4.5)  
**Status:** Active  
**Supersedes:** `12_17_25_build_fallback_strategy.md` (now Inactive)

---

## Summary

Local EAS builds are **not reliable** on modern macOS due to keychain security restrictions. The recommended fallback is Expo Starter/On-demand billing, not local builds.

---

## What Changed

### Original Assumption (Incorrect)
> "Local builds produce byte-for-byte identical apps... With local fallback, build limits are a convenience constraint, not a blocker."

### Reality
Local builds fail with:
```
Error: Distribution certificate with fingerprint [X] hasn't been imported successfully
```

macOS prevents EAS from importing certificates into temporary keychains, even when:
- Certificate is manually imported to login keychain
- `credentials.json` is properly configured
- All dependencies (Fastlane, CocoaPods) are installed

---

## Revised Build Priority

| Priority | Method | Reliability | Cost |
|----------|--------|-------------|------|
| 1 | EAS Cloud (Free tier) | ✅ High | Free |
| 2 | EAS Cloud (Starter/On-demand) | ✅ High | ~$1.50/build |
| 3 | Local Build | ⚠️ Unreliable | Free |
| 4 | Self-Hosted Runner | ❓ Untested | Free |

---

## Recommendation

**Stay on Expo Starter** ($0 base + usage-based billing).

Benefits:
- Priority queue (faster builds)
- No monthly limit anxiety
- ~$1.50/build is trivial compared to time wasted on local build debugging
- Reliable, reproducible builds

---

## When Local Builds Might Work

Local builds may succeed if:
- Certificate is already in System keychain (not login keychain)
- Using an older macOS version with less strict keychain security
- Running Xcode build directly (bypassing EAS local build tooling)

These are edge cases, not reliable fallbacks.

---

## Decision Tree (Revised)

```
Need to build?
    │
    ▼
Use EAS Cloud
    │
    ├─► Free tier available → eas build (free)
    │
    └─► Free tier exhausted → eas build (pay ~$1.50)
    
Done. Don't waste time on local builds.
```

---

## Related Specs
- `12_17_25_build_fallback_strategy.md` - Original (now Inactive)
- `12_16_25_14_30_deployment_strategy.md` - OTA vs Native build cadence


