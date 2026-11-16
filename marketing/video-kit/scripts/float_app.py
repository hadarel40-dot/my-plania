# float_app.py: app screen recording floating (rounded, shadow) over a shot of Hadarel.
# usage: python3 float_app.py BG.mp4 bg_start dur bg_zoom bg_cropx  APP.mov app_speed app_crop(bottom|top) app_start  W X Y  out.mp4
import sys, subprocess
from PIL import Image, ImageDraw
bg, bs, dur, bz, bx, app, asp, acrop, ast, W, X, Y, out = sys.argv[1:14]
dur=float(dur); W=int(W); H=int(round(W*1920/1080)); H-=H%2; X=int(X); Y=int(Y)
m=Image.new('L',(W,H),0); ImageDraw.Draw(m).rounded_rectangle([0,0,W-1,H-1],radius=int(W*0.075),fill=255); m.save('/tmp/fa_mask.png')
sh=Image.new('L',(W+80,H+80),0); ImageDraw.Draw(sh).rounded_rectangle([40,40,W+39,H+39],radius=int(W*0.08),fill=175); sh.save('/tmp/fa_sh.png')
WARM="curves=master='0/0.03 0.25/0.25 0.5/0.52 0.75/0.78 1/0.95',colorbalance=rh=0.03:gh=0.01:bh=-0.025,eq=saturation=1.08:brightness=-0.03"
ay = "ih-1920-10" if acrop=="bottom" else "180"
fc = (f"[0:v]{WARM},scale=w='trunc(1080*({bz}+0.05*t/{dur})/2)*2':h=-2:eval=frame:flags=lanczos,crop=1080:1920:{bx}:(ih-1920)/2,fps=30,setpts=PTS-STARTPTS[bg];"
      f"[1:v]setpts=PTS/{asp},scale=1080:-2:flags=lanczos,crop=1080:1920:0:{ay},scale={W}:{H}:flags=lanczos,fps=30,format=rgba[f];"
      f"[2:v]format=gray[m];[f][m]alphamerge[fr];[3:v]format=gray,boxblur=22:2[shm];color=black:s={W+80}x{H+80},format=rgba[shc];[shc][shm]alphamerge[shd];"
      f"[bg][shd]overlay={X-40}:{Y-30}:shortest=1[b2];[b2][fr]overlay={X}:{Y}:shortest=1,format=yuv420p")
subprocess.run(["ffmpeg","-v","error","-y","-ss",bs,"-t",str(dur),"-i",bg,"-ss",ast,"-i",app,"-loop","1","-i","/tmp/fa_mask.png","-loop","1","-i","/tmp/fa_sh.png",
  "-filter_complex",fc,"-t",str(dur),"-c:v","libx264","-crf","14","-preset","fast","-pix_fmt","yuv420p",
  "-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709","-an",out],check=True)
