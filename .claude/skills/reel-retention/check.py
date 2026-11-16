#!/usr/bin/env python3
"""Measure what makes people leave a reel: slow first second, long static shots, no pattern breaks.

    python3 check.py video.mp4            # report
    python3 check.py video.mp4 --json     # machine-readable

Needs ffmpeg/ffprobe. Uses scene-change detection, so it sees cuts and big visual changes,
not text that changes on a still shot. It is a guide, not a verdict: watch the flagged spots.
"""
import json, re, subprocess, sys

SCENE = 0.25          # scene-change threshold (0..1); lower = more sensitive
MAX_STATIC = 2.5      # seconds without any visual change before viewers drift
FIRST_CHANGE = 1.0    # something must move or change inside the first second


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    video = next((s for s in data["streams"] if s.get("codec_type") == "video"), {})
    has_audio = any(s.get("codec_type") == "audio" for s in data["streams"])
    return float(data["format"]["duration"]), video.get("width"), video.get("height"), has_audio


def cuts(path):
    proc = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-vf", f"select='gt(scene,{SCENE})',showinfo",
                           "-f", "null", "-"], capture_output=True, text=True)
    return [float(m) for m in re.findall(r"pts_time:([0-9.]+)", proc.stderr)]


def report(path):
    duration, w, h, has_audio = probe(path)
    times = cuts(path)
    marks = [0.0] + times + [duration]
    gaps = [(marks[i], marks[i + 1]) for i in range(len(marks) - 1)]
    static = [(a, b) for a, b in gaps if b - a > MAX_STATIC]
    first = times[0] if times else duration
    issues = []
    if w and h and abs(w / h - 9 / 16) > 0.02:
        issues.append(f"היחס {w}x{h} ולא 9:16. בפיד הוא יוצג קטן או חתוך")
    if not has_audio:
        issues.append("אין פסקול. בלי סאונד טרנדי הריל מקבל פחות הפצה")
    if first > FIRST_CHANGE:
        issues.append(f"השינוי הראשון רק בשנייה {first:.1f}. בשנייה הראשונה חייב לזוז משהו (תנועה, זום, טקסט שקופץ)")
    for a, b in static:
        issues.append(f"{a:.1f}–{b:.1f} שנ׳: {b - a:.1f} שניות בלי שום שינוי. כאן אנשים עוזבים. להוסיף קאט, זום, או טקסט חדש")
    if duration > 15 and len(times) / duration < 0.35:
        issues.append("ריל ארוך עם מעט שינויים. לקצר, או להוסיף שינוי כל 1.5–2.5 שניות")
    return {
        "file": path, "duration": round(duration, 2), "size": f"{w}x{h}", "audio": has_audio,
        "cuts": [round(t, 2) for t in times], "changes_per_second": round(len(times) / duration, 2) if duration else 0,
        "first_change": round(first, 2), "longest_static": round(max((b - a for a, b in gaps), default=0), 2),
        "issues": issues,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    r = report(sys.argv[1])
    if "--json" in sys.argv:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(f"{r['file']}: {r['duration']} שנ׳, {r['size']}, {'עם' if r['audio'] else 'בלי'} סאונד")
        print(f"שינויים: {len(r['cuts'])} ({r['changes_per_second']} לשנייה), ראשון בשנייה {r['first_change']}, "
              f"הקטע הסטטי הארוך: {r['longest_static']} שנ׳")
        print("\n".join(f"- {i}" for i in r["issues"]) or "- לא נמצאו נקודות נטישה ברורות")
