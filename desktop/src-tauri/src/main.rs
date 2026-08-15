#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Component, Path, PathBuf};

mod update;

use serde::Serialize;

#[derive(Serialize)]
struct DirEntry {
  name: String,
  path: String,
  dir: bool,
}

fn home_path() -> Result<PathBuf, String> {
  dirs::home_dir().ok_or_else(|| "Ruwt could not find the home directory.".into())
}

fn parse_path(path: &str) -> Result<PathBuf, String> {
  let parsed = PathBuf::from(path);
  if parsed.components().any(|component| matches!(component, Component::ParentDir)) {
    return Err("That path is not approved.".into());
  }
  if parsed.is_absolute() { Ok(parsed) } else { Ok(home_path()?.join(parsed)) }
}

fn allowed(path: &Path, write: bool) -> Result<(), String> {
  let home = home_path()?;
  let roots: Vec<PathBuf> = if write {
    vec![home.join(".ruwt")]
  } else {
    vec![
      home.join(".ruwt"),
      home.join(".claude"),
      home.join(".cursor"),
      home.join(".codex"),
      home.join("Library/Application Support/Cursor"),
      home.join("AppData/Roaming/Cursor"),
      home.join(".config/Cursor"),
    ]
  };
  if roots.iter().any(|root| path.starts_with(root)) { Ok(()) } else { Err("That path is not approved.".into()) }
}

#[tauri::command]
fn home_dir() -> Result<String, String> {
  Ok(home_path()?.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
  let path = parse_path(&path)?;
  allowed(&path, false)?;
  let metadata = fs::metadata(&path).map_err(|_| "Ruwt could not read that file.".to_string())?;
  if metadata.len() > 1_500_000 { return Err("That session file is too large to scan.".into()); }
  fs::read_to_string(&path).map_err(|_| "Ruwt could not read that file.".into())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
  let path = parse_path(&path)?;
  allowed(&path, true)?;
  if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
  fs::write(&path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn mkdirp(path: String) -> Result<(), String> {
  let path = parse_path(&path)?;
  allowed(&path, true)?;
  fs::create_dir_all(&path).map_err(|error| error.to_string())
}

#[tauri::command]
fn path_exists(path: String) -> Result<bool, String> {
  let path = parse_path(&path)?;
  allowed(&path, false)?;
  Ok(path.exists())
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
  let path = parse_path(&path)?;
  allowed(&path, false)?;
  let entries = match fs::read_dir(&path) {
    Ok(entries) => entries,
    Err(_) => return Ok(vec![]),
  };
  Ok(entries.filter_map(|entry| entry.ok()).map(|entry| {
    let path = entry.path();
    DirEntry {
      name: entry.file_name().to_string_lossy().into_owned(),
      path: path.to_string_lossy().into_owned(),
      dir: path.is_dir(),
    }
  }).collect())
}

#[tauri::command]
fn autostart_set(enabled: bool) -> Result<bool, String> {
  let exe = std::env::current_exe().map_err(|error| error.to_string())?;
  let home = home_path()?;
  if cfg!(target_os = "macos") {
    let launch_agents = home.join("Library/LaunchAgents");
    let plist = launch_agents.join("ai.ruwt.desktop.plist");
    if enabled {
      fs::create_dir_all(&launch_agents).map_err(|error| error.to_string())?;
      let body = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ai.ruwt.desktop</string>
  <key>ProgramArguments</key><array><string>{}</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
"#,
        exe.display()
      );
      fs::write(&plist, body).map_err(|error| error.to_string())?;
    } else if plist.exists() {
      fs::remove_file(&plist).map_err(|error| error.to_string())?;
    }
    return Ok(enabled);
  }
  Err("Start at login is available on macOS in this build.".into())
}

#[tauri::command]
fn app_identity() -> update::AppIdentity {
  update::identity()
}

#[tauri::command]
async fn check_update() -> Result<update::UpdateStatus, String> {
  tauri::async_runtime::spawn_blocking(update::check)
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn install_update() -> Result<update::UpdateStatus, String> {
  tauri::async_runtime::spawn_blocking(update::install)
    .await
    .map_err(|error| error.to_string())?
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      home_dir, read_text_file, write_text_file, mkdirp, path_exists, list_dir, autostart_set,
      app_identity, check_update, install_update
    ])
    .run(tauri::generate_context!())
    .expect("Ruwt Desktop could not start");
}
