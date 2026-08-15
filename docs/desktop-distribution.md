# Desktop distribution

The Tauri identifier is `ai.ruwt.desktop`. CI builds:

- macOS DMG on `macos-latest` (drag Ruwt to Applications)
- Windows NSIS installer on `windows-latest`

Workflow: `.github/workflows/release-desktop.yml` → GitHub Release `desktop-latest` → `deploy-ai.yml` copies artifacts to `https://ruwt.ai/downloads/`.

The DMG window is Linear-style: **Ruwt on the left**, gold chevron, **Applications on the right**. Background: `desktop/src-tauri/dmg/background.png` (regenerate with `python3 desktop/scripts/render-dmg-background.py`).

GitHub Actions cannot run Finder AppleScript (`create-dmg --skip-jenkins`), so CI builds the `.app` with Tauri and then `python3 desktop/scripts/build-macos-dmg.py` (`dmgbuild`) writes icon positions and the arrow into the disk image without Finder.

## Signing and notarization

CI mints a **Developer ID Application** certificate from the same App Store Connect API key used for iOS TestFlight (`APP_STORE_CONNECT_API_KEY_KEY`, `_KEY_ID`, `_ISSUER_ID`, team `S5G585GH4X`). The private key is stored encrypted in the Actions cache (`desktop/.signing/developer-id.p12.enc`). The DMG is signed, submitted to `notarytool`, and stapled.

Optional override: set `APPLE_CERTIFICATE` (base64 `.p12`) and `APPLE_CERTIFICATE_PASSWORD` to skip minting.

Do not create empty placeholder `APPLE_*` secrets. An empty `APPLE_CERTIFICATE` makes Tauri try to import a blank keychain item.

`curl -fsSL https://ruwt.ai/install.sh | bash` remains a quarantine-free fallback.

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
