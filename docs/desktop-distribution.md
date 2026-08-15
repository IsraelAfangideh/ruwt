# Desktop distribution

The Tauri identifier is `ai.ruwt.desktop`. CI builds:

- macOS DMG on `macos-latest` (drag Ruwt to Applications)
- Windows NSIS installer on `windows-latest`

Workflow: `.github/workflows/release-desktop.yml` → GitHub Release `desktop-latest` → `deploy-ai.yml` copies artifacts to `https://ruwt.ai/downloads/`.

The DMG window is Linear-style: **Ruwt on the left**, gold chevron, **Applications on the right**. Background: `desktop/src-tauri/dmg/background.png` (regenerate with `python3 desktop/scripts/render-dmg-background.py`).

GitHub Actions cannot run Finder AppleScript (`create-dmg --skip-jenkins`), so CI builds the `.app` with Tauri and then `python3 desktop/scripts/build-macos-dmg.py` (`dmgbuild`) writes icon positions and the arrow into the disk image without Finder.

## Signing and notarization (optional)

Unsigned builds work (`signingIdentity` defaults to `-` in `tauri.conf.json`). CI re-seals the `.app` after `dmgbuild` copies it so Gatekeeper sees a consistent ad-hoc signature (Open Anyway) instead of a broken “damaged / cannot verify” seal. Set `APPLE_SIGNING_IDENTITY` to override that when a Developer ID cert is available.

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

Do not create empty placeholder secrets. An empty `APPLE_CERTIFICATE` makes Tauri try to import a blank keychain item and the DMG job fails. Leave the secrets unset until you have a real Developer ID `.p12`.

Windows Authenticode signing is not configured yet. The NSIS installer still installs and launches.
