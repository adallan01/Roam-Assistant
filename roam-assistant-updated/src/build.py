#!/usr/bin/env python3
"""
Build roam-assistant.js and the preview page from src/roam-assistant.src.js.

The source uses placeholder tokens (__WORDMARK__, __IMG_GEN3__, …) where the
brand assets go. This script swaps them for base64 data-URIs so the shipped
widget is a single self-contained file with no hotlinking.

Usage:   python3 src/build.py        (run from the repo root)
"""

import base64
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "roam-assistant.src.js")
OUT = os.path.join(ROOT, "roam-assistant.js")
PREVIEW = os.path.join(ROOT, "roam-assistant-preview.html")
BRAND = os.path.join(ROOT, "brand")

ASSETS = {
    "__WORDMARK__":    ("roam_wordmark_opt.png", "image/png"),
    "__IMG_GEN3__":    ("card_gen3.jpg",         "image/jpeg"),
    "__IMG_CHARGER__": ("card_charger.jpg",      "image/jpeg"),
    "__IMG_ROAD__":    ("card_road.jpg",         "image/jpeg"),
    "__IMG_STREET__":  ("card_street.jpg",       "image/jpeg"),
    "__IMG_RIDER__":   ("card_rider.jpg",        "image/jpeg"),
    "__IMG_RIDERS__":  ("card_riders.jpg",       "image/jpeg"),
}

PREVIEW_SHELL = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Roam Assistant: Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
 body{{margin:0;font-family:Montserrat,system-ui,sans-serif;background:#F6F6F3;color:#14170F;}}
 .w{{max-width:900px;margin:0 auto;padding:56px 24px 180px;}}
 .eb{{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#B25110;display:flex;align-items:center;gap:10px;}}
 .eb::before{{content:"";width:18px;height:1px;background:#ED7D31;}}
 h1{{font-size:clamp(28px,6vw,38px);font-weight:800;text-transform:uppercase;letter-spacing:-.01em;margin:14px 0;}}
 p{{color:#5B6560;line-height:1.7;max-width:640px;}}
 code{{background:#EDEDE8;padding:2px 7px;border-radius:5px;font-size:13px;}}
 .box{{background:#fff;border:1px solid rgba(20,24,20,.1);border-radius:14px;padding:20px 22px;margin-top:20px;}}
 .box h3{{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;}}
 ul{{color:#5B6560;line-height:1.9;padding-left:20px;margin:0;}}
</style></head><body>
<div class="w">
  <div class="eb">Preview</div>
  <h1>Roam Assistant</h1>
  <p>This page exists only so you can try the widget. In production it is a single
  script tag in the Webflow footer.</p>
  <div class="box"><h3>Test the no-dead-end behaviour</h3><ul>
    <li>&ldquo;Do you ship to Uganda?&rdquo;: something it cannot know</li>
    <li>&ldquo;What colour options are there?&rdquo;: not in the knowledge base</li>
    <li>Both should offer WhatsApp, Call and <em>Get me an answer</em></li>
  </ul></div>
  <div class="box"><h3>Mobile</h3><ul>
    <li>Narrow the window under 600px: it becomes a full-screen sheet</li>
    <li>Inputs are 16px so iOS does not zoom on tap</li>
  </ul></div>
</div>
<script>
{script}
</script>
</body></html>"""


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing source: {SRC}")

    js = open(SRC, encoding="utf-8").read()

    missing = []
    for token, (filename, mime) in ASSETS.items():
        path = os.path.join(BRAND, filename)
        if not os.path.exists(path):
            missing.append(filename)
            continue
        if token not in js:
            print(f"  warning: token {token} not found in source")
        data = base64.b64encode(open(path, "rb").read()).decode()
        js = js.replace(token, f"data:{mime};base64,{data}")

    if missing:
        sys.exit("missing brand assets: " + ", ".join(missing))

    left = re.findall(r"__[A-Z_]+__", js)
    if left:
        sys.exit("unsubstituted tokens remain: " + ", ".join(sorted(set(left))))

    open(OUT, "w", encoding="utf-8").write(js)
    print(f"  built {os.path.relpath(OUT, ROOT)}  ({os.path.getsize(OUT)//1024} KB)")

    # The source header comment contains a literal </script> for the install
    # snippet. Harmless via <script src>, but it would close the tag early when
    # inlined into HTML, so escape it for the preview build.
    safe = js.replace("</script>", "<\\/script>")
    open(PREVIEW, "w", encoding="utf-8").write(PREVIEW_SHELL.format(script=safe))
    print(f"  built {os.path.relpath(PREVIEW, ROOT)}  ({os.path.getsize(PREVIEW)//1024} KB)")


if __name__ == "__main__":
    main()
