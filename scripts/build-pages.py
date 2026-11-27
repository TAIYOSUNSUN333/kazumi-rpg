"""Build the static game for the repository's GitHub Pages subpath."""

import json
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
site = root / "_site"
sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
committed = subprocess.check_output(
    ["git", "show", "-s", "--format=%cI", "HEAD"], cwd=root, text=True
).strip()
updated = datetime.fromisoformat(committed).astimezone(timezone(timedelta(hours=9)))
version = json.loads((root / "package.json").read_text())["version"]
label = f"v{version} ({sha[:8]}) ・ 最終更新 {updated:%Y-%m-%d %H:%M} JST"
asset_path = f"releases/{sha}/assets/"
sources = sorted(root.glob("*.js")) + [
    root / name for name in ("index.html", "game.css", "manifest.webmanifest")
]
shell_names = [path.name for path in sources if path.name not in ("index.html", "service-worker.js")]
shell_urls = re.compile(r"(?<=[\"'])(?:\./)?(?:" + "|".join(map(re.escape, shell_names)) + r")(?=[\"'])")

if site.exists():
    shutil.rmtree(site)
site.mkdir()
shutil.copytree(root / "assets", site / asset_path, dirs_exist_ok=True)
for source in sources:
    content = source.read_text(encoding="utf-8")
    content = content.replace("assets/", asset_path)
    if source.name in ("index.html", "service-worker.js"):
        content = shell_urls.sub(lambda match: f"{match[0]}?v={sha}", content)
    if source.name == "index.html":
        content = content.replace('data-release=""', f'data-release="{label}"')
    if source.name == "service-worker.js":
        content = content.replace("'action-14'", repr(sha))
    (site / source.name).write_text(content, encoding="utf-8")
(site / ".nojekyll").touch()
