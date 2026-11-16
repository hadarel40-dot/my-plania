# usage: python3 clean_floor.py <shot> in.mp4 out.mp4   -- cleans only floor pixels inside a per-shot region
import sys, subprocess, numpy as np
from PIL import Image, ImageFilter
shot, src, dst = sys.argv[1:4]; W, H = 1080, 1920
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
if shot == "4705":
    region = (yy > 1060) & (xx > (yy - 1080) * 540 / 840 + 30)            # floor below the person, right of the egg drawer
    region &= ~((xx > 640) & (yy < 1360))                                  # not the concrete pillar
    region |= (yy < 330) & (xx < 300) & (yy < 330)                         # back floor top-left
    region &= ~((xx < 330) & (yy > 150) & (yy < 1060))
elif shot == "4720":
    region = ((yy > 900) & (xx < 600)) | ((yy > 790) & (xx >= 600))         # floor incl. wall base, not cardigan/pillar
    region &= ~((xx > 210) & (xx < 620) & (yy > 930) & (yy < 1400))        # not the phone/hand
else:
    region = np.zeros((H, W), bool)
def blur(a, r): return np.asarray(Image.fromarray(a).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32)
wallbase = (xx > 560) & (yy > 760) & (yy < 1250) & (xx < 1080)
rf = blur((region * 255).astype(np.uint8), 45) / 255                      # heavily feathered region, no seams
dec = subprocess.Popen(["ffmpeg","-v","error","-i",src,"-f","rawvideo","-pix_fmt","rgb24","-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r","30","-i","-",
                        "-c:v","libx264","-crf","14","-preset","fast","-pix_fmt","yuv420p","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709",dst], stdin=subprocess.PIPE)
n = 0
while True:
    buf = dec.stdout.read(W*H*3)
    if len(buf) < W*H*3: break
    img = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32) / 255
    mx, mn = img.max(2), img.min(2); sat = (mx - mn) / (mx + 1e-4); lum = img.mean(2)
    SAT = np.where(wallbase, 0.45, 0.24) if shot == "4720" else 0.24
    floorish = ((sat < SAT) & (lum > 0.18)).astype(np.uint8) * 255
    m = rf * blur(floorish, 4) / 255
    # local clean-tile brightness: max filter (removes grout, specks, stains) then smooth, at half res
    L8 = Image.fromarray((lum * 255).astype(np.uint8)).resize((W//2, H//2), Image.BILINEAR)
    clean = L8.filter(ImageFilter.MaxFilter(25 if shot == '4720' else 17)).filter(ImageFilter.GaussianBlur(10)).resize((W, H), Image.BILINEAR)
    clean = np.asarray(clean, dtype=np.float32) / 255 * 0.985
    ratio = np.clip(clean / (lum + 1e-3), 1.0, 2.2)                         # only lighten what is darker than clean tile
    out = img * ratio[..., None]
    g = out.mean(2, keepdims=True); k = np.clip((ratio - 1) * 1.5, 0, 0.8)[..., None]
    out = out * (1 - k) + (g * np.array([1.0, 0.99, 0.965])) * k            # neutralise brown tint of former dirt
    out = img + (out.clip(0, 1) - img) * 0.9
    res = img * (1 - m[..., None]) + out * m[..., None]
    enc.stdin.write((res * 255).clip(0, 255).astype(np.uint8).tobytes()); n += 1
enc.stdin.close(); enc.wait(); print(shot, "frames", n)
