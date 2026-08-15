# dmgbuild settings — Linear-style: Ruwt left, arrow, Applications right.
# Paths come from RUWT_DESKTOP_ROOT (set by build-macos-dmg.py).
import os

_root = os.environ["RUWT_DESKTOP_ROOT"]
_app = os.path.join(_root, "src-tauri/target/release/bundle/macos/Ruwt.app")
_bg = os.path.join(_root, "src-tauri/dmg/background.png")

volume_name = "Ruwt"
format = "UDZO"
files = [_app]
symlinks = {"Applications": "/Applications"}
hide_extensions = ["Ruwt.app"]
icon_locations = {
    "Ruwt.app": (160, 168),
    "Applications": (500, 168),
}
background = _bg
window_rect = ((200, 120), (660, 400))
default_view = "icon-view"
icon_size = 128
text_size = 16
show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False
