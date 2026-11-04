#!/usr/bin/env python3
"""Bundle index.html + css/ + js/ into one self-contained file: dist/do-i-mog-or-dog.html"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "dist" / "do-i-mog-or-dog.html"


def inline_css(match):
    css = (ROOT / match.group(1)).read_text(encoding="utf-8")
    return f"<style>\n{css}\n</style>"


def inline_js(match):
    js = (ROOT / match.group(1)).read_text(encoding="utf-8")
    if "</script" in js.lower():
        raise SystemExit(f"{match.group(1)} contains '</script' and cannot be inlined safely")
    return f"<script>\n/* {match.group(1)} */\n{js}\n</script>"


html = (ROOT / "index.html").read_text(encoding="utf-8")
html = re.sub(r'<link rel="stylesheet" href="([^"]+\.css)">', inline_css, html)
html = re.sub(r'<script src="([^"]+\.js)"></script>', inline_js, html)

left = re.findall(r'(?:href|src)="(?!https?:|data:|#)([^"]+\.(?:css|js))"', html)
if left:
    raise SystemExit(f"Unbundled local references remain: {left}")

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")
