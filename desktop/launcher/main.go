package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

//go:embed ui/*
var uiFS embed.FS

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
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true,"service":"ruwt-desktop","promptsStored":0}`))
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
			return os.MkdirAll(target, 0o755)
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
