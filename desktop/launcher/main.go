package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

//go:embed ui/*
var uiFS embed.FS

type dirEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Dir  bool   `json:"dir"`
}

func main() {
	home, _ := os.UserHomeDir()
	dataDir := filepath.Join(home, ".ruwt")
	_ = os.MkdirAll(dataDir, 0o700)

	if runtime.GOOS == "darwin" {
		relocateToApplications()
	}

	listener, err := net.Listen("tcp", "127.0.0.1:17373")
	if err != nil {
		listener, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			fatal("Ruwt could not bind a local port: " + err.Error())
		}
	}

	content, err := fs.Sub(uiFS, "ui")
	if err != nil {
		fatal(err.Error())
	}

	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(content)))
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]any{"ok": true, "service": "ruwt-desktop", "shell": "launcher", "promptsStored": 0, "version": "0.2.0"})
	})
	mux.HandleFunc("/api/fs/home", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]string{"home": home})
	})
	mux.HandleFunc("/api/fs/read", func(w http.ResponseWriter, r *http.Request) {
		path, err := requestedPath(r, home, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		info, err := os.Stat(path)
		if err != nil || info.Size() > 1_500_000 {
			http.Error(w, "Ruwt could not read that file.", http.StatusBadRequest)
			return
		}
		data, err := os.ReadFile(path)
		if err != nil {
			http.Error(w, "Ruwt could not read that file.", http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]string{"contents": string(data)})
	})
	mux.HandleFunc("/api/fs/write", func(w http.ResponseWriter, r *http.Request) {
		payload := struct {
			Path     string `json:"path"`
			Contents string `json:"contents"`
		}{}
		if err := json.NewDecoder(io.LimitReader(r.Body, 8<<20)).Decode(&payload); err != nil {
			http.Error(w, "Invalid request.", http.StatusBadRequest)
			return
		}
		path, err := approvedPath(payload.Path, home, true)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := os.WriteFile(path, []byte(payload.Contents), 0o600); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	})
	mux.HandleFunc("/api/fs/mkdirp", func(w http.ResponseWriter, r *http.Request) {
		path, err := requestedPath(r, home, true)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		if err := os.MkdirAll(path, 0o700); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	})
	mux.HandleFunc("/api/fs/exists", func(w http.ResponseWriter, r *http.Request) {
		path, err := requestedPath(r, home, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		_, err = os.Stat(path)
		writeJSON(w, map[string]bool{"exists": err == nil})
	})
	mux.HandleFunc("/api/fs/list", func(w http.ResponseWriter, r *http.Request) {
		path, err := requestedPath(r, home, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			writeJSON(w, map[string]any{"entries": []dirEntry{}})
			return
		}
		out := make([]dirEntry, 0, len(entries))
		for _, entry := range entries {
			out = append(out, dirEntry{Name: entry.Name(), Path: filepath.Join(path, entry.Name()), Dir: entry.IsDir()})
		}
		writeJSON(w, map[string]any{"entries": out})
	})
	mux.HandleFunc("/api/autostart", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_, err := os.Stat(autostartPath(home))
			writeJSON(w, map[string]bool{"enabled": err == nil})
			return
		}
		payload := struct {
			Enabled bool `json:"enabled"`
		}{}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		enabled, err := setAutostart(home, payload.Enabled)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]bool{"enabled": enabled})
	})

	url := fmt.Sprintf("http://%s/", listener.Addr().String())
	go func() {
		time.Sleep(250 * time.Millisecond)
		openBrowser(url)
	}()

	if err := http.Serve(listener, mux); err != nil {
		fatal(err.Error())
	}
}

func requestedPath(r *http.Request, home string, write bool) (string, error) {
	payload := struct {
		Path string `json:"path"`
	}{}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		return "", fmt.Errorf("invalid request")
	}
	return approvedPath(payload.Path, home, write)
}

func approvedPath(path, home string, write bool) (string, error) {
	if path == "" || strings.Contains(path, "..") {
		return "", fmt.Errorf("that path is not approved")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	roots := []string{filepath.Join(home, ".ruwt")}
	if !write {
		roots = append(roots,
			filepath.Join(home, ".claude"),
			filepath.Join(home, ".cursor"),
			filepath.Join(home, ".codex"),
			filepath.Join(home, "Library", "Application Support", "Cursor"),
			filepath.Join(home, "AppData", "Roaming", "Cursor"),
			filepath.Join(home, ".config", "Cursor"),
		)
	}
	for _, root := range roots {
		rel, err := filepath.Rel(root, abs)
		if err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return abs, nil
		}
	}
	return "", fmt.Errorf("that path is not approved")
}

func autostartPath(home string) string {
	return filepath.Join(home, "Library", "LaunchAgents", "ai.ruwt.desktop.plist")
}

func setAutostart(home string, enabled bool) (bool, error) {
	if runtime.GOOS != "darwin" {
		return false, fmt.Errorf("start at login is available on macOS in this build")
	}
	exe, err := os.Executable()
	if err != nil {
		return false, err
	}
	plist := autostartPath(home)
	if !enabled {
		_ = os.Remove(plist)
		return false, nil
	}
	if err := os.MkdirAll(filepath.Dir(plist), 0o755); err != nil {
		return false, err
	}
	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>ai.ruwt.desktop</string>
  <key>ProgramArguments</key><array><string>%s</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
`, exe)
	return true, os.WriteFile(plist, []byte(body), 0o644)
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}

func relocateToApplications() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return
	}
	contents := parentNamed(exe, "Contents")
	if contents == "" {
		return
	}
	app := filepath.Dir(contents)
	if filepath.Ext(app) != ".app" {
		return
	}

	home, _ := os.UserHomeDir()
	destDir := filepath.Join(home, "Applications")
	_ = os.MkdirAll(destDir, 0o755)
	dest := filepath.Join(destDir, "Ruwt.app")
	if sameFile(app, dest) {
		return
	}

	_ = os.RemoveAll(dest)
	if err := copyDir(app, dest); err == nil {
		_ = exec.Command("open", "-g", dest).Start()
	}
}

func parentNamed(path, name string) string {
	for path != "/" && path != "." {
		if filepath.Base(path) == name {
			return path
		}
		path = filepath.Dir(path)
	}
	return ""
}

func sameFile(a, b string) bool {
	ai, err1 := os.Stat(a)
	bi, err2 := os.Stat(b)
	if err1 != nil || err2 != nil {
		return false
	}
	return os.SameFile(ai, bi)
}

func copyDir(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, info.Mode())
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, info.Mode())
	})
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", "-n", "-a", "Safari", url)
		if err := cmd.Start(); err == nil {
			return
		}
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func fatal(message string) {
	fmt.Fprintln(os.Stderr, message)
	if runtime.GOOS == "darwin" {
		_ = exec.Command("osascript", "-e", `display alert "Ruwt" message "`+message+`"`).Run()
	}
	os.Exit(1)
}
