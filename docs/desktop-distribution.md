# Desktop distribution

The Tauri identifier is `ai.ruwt.desktop`. CI builds:

- macOS DMG on `macos-latest` (drag Ruwt to Applications)
- Windows NSIS installer on `windows-latest`

Workflow: `.github/workflows/release-desktop.yml` → GitHub Release `desktop-latest` → `deploy-ai.yml` copies artifacts to `https://ruwt.ai/downloads/`.

## Signing and notarization (optional)

Unsigned builds work. macOS Gatekeeper will ask the user to right-click → Open once.

To ship a signed, notarized DMG, add these GitHub Actions secrets:

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password for that `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | 10-character Team ID |

Once those are set, the next `Release Desktop` run signs and notarizes automatically. No code change required.

Windows Authenticode signing is not configured yet. The NSIS installer still installs and launches.
