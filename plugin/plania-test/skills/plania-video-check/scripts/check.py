"""בדיקת סביבה: מייצר ריל של 4 שניות, 1080x1920, עם כתוביות בעברית שקופצות מילה אחרי מילה."""
import argparse, json, os, platform, shutil, subprocess, sys, time

def find_ffmpeg(report):
    path = shutil.which("ffmpeg")
    if path:
        report["ffmpeg"] = "system"; return path
    try:
        import imageio_ffmpeg  # noqa
    except ImportError:
        r = subprocess.run([sys.executable, "-m", "pip", "install", "-q", "imageio-ffmpeg"], capture_output=True, text=True)
        if r.returncode != 0:
            report["ffmpeg"] = "missing"; report["pip_error"] = r.stderr[-400:]; return None
    import imageio_ffmpeg
    report["ffmpeg"] = "pip imageio-ffmpeg"
    return imageio_ffmpeg.get_ffmpeg_exe()

def has_chromium():
    try:
        from playwright.sync_api import sync_playwright  # noqa
        return "playwright (python)"
    except Exception:
        pass
    for name in ("chromium", "chromium-browser", "google-chrome"):
        if shutil.which(name): return name
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    report = {"python": platform.python_version(), "chromium": has_chromium()}
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pillow"])
        from PIL import Image, ImageDraw, ImageFont
    ff = find_ffmpeg(report)
    if not ff:
        report["ok"] = False; print(json.dumps(report, ensure_ascii=False)); return
    t0 = time.time()
    W, H, FPS, SEC = 1080, 1920, 30, 4
    words = ["ככה", "נראה", "ריל", "של", "Plania"]
    font = ImageFont.truetype(a.font, 150)
    # עברית מימין לשמאל: מילה בודדת בכל פריים, אז מספיק להפוך אותיות של מילה עברית
    from PIL import features
    raqm = features.check("raqm")  # עם raqm פילואו מסדר עברית לבד; בלי, הופכים את האותיות
    report["raqm"] = raqm
    show = lambda w: w if (w.isascii() or raqm) else w[::-1]
    proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", os.path.join(a.out, "plania-test.mp4")], stdin=subprocess.PIPE)
    per = SEC * FPS // len(words)
    for i in range(SEC * FPS):
        k = min(i // per, len(words) - 1); t = (i % per) / per
        img = Image.new("RGB", (W, H), (62, 107, 79))
        d = ImageDraw.Draw(img)
        scale = 0.7 + 0.3 * min(1, t * 4)  # המילה קופצת פנימה
        f = font.font_variant(size=int(150 * scale))
        txt = show(words[k])
        box = d.textbbox((0, 0), txt, font=f)
        x, y = (W - (box[2] - box[0])) / 2, H * 0.48 - (box[3] - box[1]) / 2
        d.text((x, y), txt, font=f, fill="white", stroke_width=6, stroke_fill=(247, 201, 214))
        proc.stdin.write(img.tobytes())
    proc.stdin.close(); proc.wait()
    report["render_seconds"] = round(time.time() - t0, 1)
    report["ok"] = proc.returncode == 0
    report["file"] = os.path.join(a.out, "plania-test.mp4")
    print(json.dumps(report, ensure_ascii=False))

main()
