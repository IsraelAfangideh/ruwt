# Desktop distribution

The Tauri identifier is `dev.ruwt.desktop`. The configuration targets macOS
DMG and Windows MSI installers. It does not contain signing credentials.

Before release, provide an Apple Developer certificate, notarization profile,
Windows code-signing certificate, update signing key, artifact storage, and a
staging API endpoint. Build an unsigned package only after `npm install` in
`desktop`, then run `npm run build`. Verify the package on an isolated machine.
