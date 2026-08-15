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

## In-app updates

Packaged builds (version 0.2.0 and later) check `https://ruwt.ai/downloads/desktop-latest.json` on launch and from **Check for updates**. The fallback URL is `https://ruwt-ai.pages.dev/downloads/desktop-latest.json`.

An update is offered when the published semver is higher, or when the version matches and the git commit differs (`desktop-latest` is a moving tag). Development builds (`commit` = `dev`, including `tauri dev`) do not self-replace.

Install path:

1. Download the platform installer.
2. Verify SHA-256 against the manifest.
3. macOS: copy `Ruwt.app` out of the DMG, quit, `ditto` over the running bundle, relaunch.
4. Windows: quit, then run `Ruwt-Setup.exe /S`.

`Release Desktop` writes `desktop-latest.json` next to the DMG and NSIS installer. `deploy-ai.yml` copies it to `/downloads/desktop-latest.json`.

People on 0.1.0 still install 0.2.0 once by hand (Quit Ruwt, replace `/Applications/Ruwt.app` from the DMG). Later updates install from the app.
