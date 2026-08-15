use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

const MANIFEST_URLS: &[&str] = &[
  "https://ruwt.ai/downloads/desktop-latest.json",
  "https://ruwt-ai.pages.dev/downloads/desktop-latest.json",
];

#[derive(Debug, Serialize, Clone)]
pub struct AppIdentity {
  pub version: String,
  pub commit: String,
  pub os: String,
  pub packaged: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct UpdateStatus {
  pub current_version: String,
  pub current_commit: String,
  pub available: bool,
  pub version: Option<String>,
  pub commit: Option<String>,
  pub notes: Option<String>,
  pub published_at: Option<String>,
  pub message: String,
}

#[derive(Debug, Deserialize)]
struct Manifest {
  version: String,
  #[serde(default)]
  commit: String,
  #[serde(rename = "publishedAt")]
  published_at: Option<String>,
  notes: Option<String>,
  platforms: Option<Platforms>,
}

#[derive(Debug, Deserialize)]
struct Platforms {
  darwin: Option<Asset>,
  windows: Option<Asset>,
}

#[derive(Debug, Deserialize, Clone)]
struct Asset {
  url: String,
  filename: String,
  sha256: String,
}

pub fn identity() -> AppIdentity {
  AppIdentity {
    version: env!("CARGO_PKG_VERSION").into(),
    commit: env!("RUWT_GIT_SHA").into(),
    os: std::env::consts::OS.into(),
    packaged: app_bundle().is_some(),
  }
}

pub fn check() -> Result<UpdateStatus, String> {
  let current = identity();
  if current.commit == "dev" {
    return Ok(UpdateStatus {
      current_version: current.version,
      current_commit: current.commit,
      available: false,
      version: None,
      commit: None,
      notes: None,
      published_at: None,
      message: "This is a development build. Packaged apps check ruwt.ai for updates.",
    });
  }
  let manifest = fetch_manifest()?;
  let available = is_newer(&current, &manifest);
  Ok(UpdateStatus {
    current_version: current.version.clone(),
    current_commit: current.commit.clone(),
    available,
    version: Some(manifest.version.clone()),
    commit: Some(manifest.commit.clone()),
    notes: manifest.notes.clone(),
    published_at: manifest.published_at.clone(),
    message: if available {
      format!("Ruwt {} is available.", manifest.version)
    } else {
      format!("Ruwt {} is current.", current.version)
    },
  })
}

pub fn install() -> Result<UpdateStatus, String> {
  let current = identity();
  if current.commit == "dev" || !current.packaged {
    return Err("Updates install into the packaged Ruwt app. Open the DMG from ruwt.ai for this first update.".into());
  }
  let manifest = fetch_manifest()?;
  if !is_newer(&current, &manifest) {
    return check();
  }
  let asset = platform_asset(&manifest)?;
  let bytes = http_get(&asset.url)?;
  let digest = sha256_hex(&bytes);
  if digest != asset.sha256.to_lowercase() {
    return Err("The downloaded update did not match the published checksum. Ruwt did not install it.".into());
  }
  let dir = dirs::home_dir().ok_or("Ruwt could not find the home directory.")?.join(".ruwt").join("updates");
  fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
  let installer = dir.join(&asset.filename);
  fs::write(&installer, &bytes).map_err(|error| error.to_string())?;
  apply_update(&installer)?;
  Ok(UpdateStatus {
    current_version: current.version,
    current_commit: current.commit,
    available: false,
    version: Some(manifest.version),
    commit: Some(manifest.commit),
    notes: manifest.notes,
    published_at: manifest.published_at,
    message: "Update installed. Ruwt is restarting.",
  })
}

fn is_newer(local: &AppIdentity, remote: &Manifest) -> bool {
  if remote.version.is_empty() { return false; }
  match version_cmp(&remote.version, &local.version) {
    std::cmp::Ordering::Greater => true,
    std::cmp::Ordering::Equal => !remote.commit.is_empty() && remote.commit.to_lowercase() != local.commit.to_lowercase(),
    std::cmp::Ordering::Less => false,
  }
}

fn version_cmp(left: &str, right: &str) -> std::cmp::Ordering {
  let parse = |value: &str| value.split('.').map(|part| part.parse::<u64>().unwrap_or(0)).collect::<Vec<_>>();
  let a = parse(left);
  let b = parse(right);
  let len = a.len().max(b.len());
  for index in 0..len {
    let delta = a.get(index).copied().unwrap_or(0).cmp(&b.get(index).copied().unwrap_or(0));
    if delta != std::cmp::Ordering::Equal { return delta; }
  }
  std::cmp::Ordering::Equal
}

fn platform_asset(manifest: &Manifest) -> Result<Asset, String> {
  let platforms = manifest.platforms.as_ref().ok_or("The update manifest has no installers.")?;
  let asset = if cfg!(target_os = "macos") {
    platforms.darwin.clone()
  } else if cfg!(target_os = "windows") {
    platforms.windows.clone()
  } else {
    None
  };
  asset.ok_or_else(|| "No installer is published for this system.".into())
}

fn fetch_manifest() -> Result<Manifest, String> {
  let mut last = "Ruwt could not reach the update service.".to_string();
  for url in MANIFEST_URLS {
    match http_get(url) {
      Ok(bytes) => {
        return serde_json::from_slice(&bytes).map_err(|error| format!("The update manifest is invalid. {error}"));
      }
      Err(error) => last = error,
    }
  }
  Err(last)
}

fn http_get(url: &str) -> Result<Vec<u8>, String> {
  let response = ureq::get(url)
    .timeout(Duration::from_secs(180))
    .call()
    .map_err(|error| format!("Ruwt could not download from {url}. {error}"))?;
  let mut bytes = Vec::new();
  response.into_reader().take(200_000_000).read_to_end(&mut bytes).map_err(|error| error.to_string())?;
  Ok(bytes)
}

fn sha256_hex(bytes: &[u8]) -> String {
  Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn app_bundle() -> Option<PathBuf> {
  let mut path = std::env::current_exe().ok()?;
  for _ in 0..5 {
    if path.extension().is_some_and(|ext| ext == "app") { return Some(path); }
    path = path.parent()?.to_path_buf();
  }
  None
}

fn apply_update(installer: &Path) -> Result<(), String> {
  if cfg!(target_os = "macos") {
    install_macos(installer)
  } else if cfg!(target_os = "windows") {
    install_windows(installer)
  } else {
    Err("In-app updates are available on macOS and Windows.".into())
  }
}

fn install_macos(dmg: &Path) -> Result<(), String> {
  let dest = app_bundle().ok_or("Ruwt could not find the installed application bundle.")?;
  let work = dmg.parent().ok_or("Ruwt could not find the update folder.")?;
  let mount = work.join("volume");
  let staging = work.join("Ruwt.app");
  let _ = fs::remove_dir_all(&mount);
  let _ = fs::remove_dir_all(&staging);
  fs::create_dir_all(&mount).map_err(|error| error.to_string())?;
  let attach = Command::new("hdiutil")
    .args(["attach", "-nobrowse", "-readonly", "-mountpoint"])
    .arg(&mount)
    .arg(dmg)
    .status()
    .map_err(|error| error.to_string())?;
  if !attach.success() {
    let _ = fs::remove_dir_all(&mount);
    return Err("Ruwt could not open the downloaded disk image.".into());
  }
  let source = find_app(&mount);
  let copied = source.as_ref().map(|app| {
    Command::new("ditto").args(["--rsrc", &app.to_string_lossy(), &staging.to_string_lossy()]).status().map(|status| status.success()).unwrap_or(false)
  }).unwrap_or(false);
  let _ = Command::new("hdiutil").args(["detach", "-quiet", "-force"]).arg(&mount).status();
  let _ = fs::remove_dir_all(&mount);
  if !copied || !staging.exists() {
    return Err("The disk image does not contain Ruwt.app.".into());
  }
  let script = work.join("apply.sh");
  let body = format!(
    "#!/bin/sh\nsleep 2\nditto --rsrc \"{}\" \"{}\"\nrm -rf \"{}\"\nopen -n \"{}\"\n",
    staging.display(), dest.display(), staging.display(), dest.display()
  );
  fs::write(&script, body).map_err(|error| error.to_string())?;
  let _ = Command::new("chmod").args(["+x"]).arg(&script).status();
  Command::new("sh").arg(&script).spawn().map_err(|error| error.to_string())?;
  std::process::exit(0);
}

fn find_app(root: &Path) -> Option<PathBuf> {
  let entries = fs::read_dir(root).ok()?;
  entries.filter_map(|entry| entry.ok()).map(|entry| entry.path()).find(|path| {
    path.extension().is_some_and(|ext| ext == "app") && path.file_name().is_some_and(|name| name.to_string_lossy().starts_with("Ruwt"))
  })
}

fn install_windows(setup: &Path) -> Result<(), String> {
  let bat = setup.with_extension("bat");
  let body = format!(
    "@echo off\r\nping -n 3 127.0.0.1 >nul\r\nstart \"\" /WAIT \"{}\" /S\r\n",
    setup.display()
  );
  fs::write(&bat, body).map_err(|error| error.to_string())?;
  Command::new("cmd").args(["/C", "start", "", &bat.to_string_lossy()]).spawn().map_err(|error| error.to_string())?;
  std::process::exit(0);
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn newer_version_wins() {
    assert_eq!(version_cmp("0.2.0", "0.1.0"), std::cmp::Ordering::Greater);
    assert_eq!(version_cmp("0.1.0", "0.2.0"), std::cmp::Ordering::Less);
    assert_eq!(version_cmp("0.2.0", "0.2.0"), std::cmp::Ordering::Equal);
  }

  #[test]
  fn same_version_different_commit_is_newer() {
    let local = AppIdentity { version: "0.2.0".into(), commit: "aaa".into(), os: "macos".into(), packaged: true };
    let remote = Manifest { version: "0.2.0".into(), commit: "bbb".into(), published_at: None, notes: None, platforms: None };
    assert!(is_newer(&local, &remote));
  }
}
