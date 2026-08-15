fn git_sha() -> String {
  if let Ok(sha) = std::env::var("GITHUB_SHA") {
    if !sha.trim().is_empty() { return sha.trim().to_string(); }
  }
  if let Ok(output) = std::process::Command::new("git").args(["rev-parse", "HEAD"]).output() {
    if output.status.success() {
      if let Ok(sha) = String::from_utf8(output.stdout) {
        let sha = sha.trim();
        if !sha.is_empty() { return sha.to_string(); }
      }
    }
  }
  "dev".into()
}

fn main() {
  println!("cargo:rerun-if-env-changed=GITHUB_SHA");
  println!("cargo:rustc-env=RUWT_GIT_SHA={}", git_sha());
  tauri_build::build();
}
