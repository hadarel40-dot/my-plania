# "יום ראשון": one planning session with coffee -> whole week set. Only the prettiest shopping shots, tight framing.
import json, subprocess, os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); N=f"{S}/norm2"; OV=f"{S}/ov5"; os.makedirs(OV, exist_ok=True)
OUT = "/home/user/my-plania/marketing/reels-2026-11-15/02_REVA_SHAA.mp4"
# (clip, in, out, speed, flags)  flags: tight = zoom-in crop that hides ceilings/floors, zoom = slow push-in
segs = [("4677",0.55,1.25,1,"notes"),
        ("APPQ",0,2.7,1,""),("APPP",0,2.1,1,""),
        ("4727",2.4,3.2,1,"tz"),("4755",0.2,0.8,1,"tz"),("4726",12.2,12.8,1,"tz"),("4730",8.8,9.4,1,"tz"),
        ("4756",0.2,0.8,1,"tz"),("4726",19.3,20.0,1,"tz"),
        ("4688",5.4,6.2,1,""),("4693",0.3,1.1,1,""),
        ("4642",3.5,6.3,1,"zoom")]
T = sum((b-a)/sp for _,a,b,sp,_ in segs)
st=[0]; [st.append(st[-1]+(b-a)/sp) for _,a,b,sp,_ in segs]
texts = [
 dict(name="h", title="מה מבשלים השבוע?", ts=130, color="#f5afb9", top=250, t0=0, t1=st[1]),
 dict(name="q", title="רבע שעה, פעם בשבוע", sub="עונה על 5 שאלות קצרות", ts=88, ss=76, top=40, t0=st[1], t1=st[2]),
 dict(name="p", title="והתפריט של כל השבוע מוכן", ts=84, top=40, t0=st[2], t1=st[3]),
 dict(name="l", title="רשימת הקניות כבר מחכה", sub="עם השוואת מחירים", top=240, t0=st[3], t1=st[5]),
 dict(name="o", title="קונה רק מה שבתפריט", top=240, t0=st[5], t1=st[9]),
 dict(name="c", title="ויודעת בדיוק מה מבשלים היום", top=240, t0=st[9], t1=st[11]),
 dict(name="r", sub="יורד לי עומס מהראש", ss=120, top=1120, t0=st[11], t1=T-1.9),
 dict(name="end", title="plania", ts=190, color="#f5afb9", line="רבע שעה בשבוע. שבוע שלם של נחת.", ls=72, top=1080, t0=T-1.9, t1=T),
]
subprocess.run(["node", f"{S}/scripts/overlay2.js", "/dev/stdin", OV], input=json.dumps(texts).encode(), check=True)
WARM = "curves=master='0/0.03 0.25/0.25 0.5/0.52 0.75/0.78 1/0.95',colorbalance=rh=0.03:gh=0.01:bh=-0.025:rs=-0.005:bs=0.012,eq=saturation=1.1,vignette=angle=PI/7"
inp, fc = [], []
for i,(c,a,b,sp,fl) in enumerate(segs):
    inp += ["-i", f"{N}/IMG_{c}.mp4"]
    look = "null" if c.startswith("APP") else WARM
    f = f"[{i}:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},{look}"
    if fl == "notes": f += ",eq=contrast=1.15:brightness=0.05:saturation=1.1,colorbalance=gm=-0.03:rm=0.02"
    if fl == "tight": f += ",scale=1296:-2:flags=lanczos,crop=1080:1920"
    if fl == "tz": D=(b-a)/sp; f += f",scale=w='trunc(1080*(1.2+0.08*t/{D:.2f})/2)*2':h=-2:eval=frame:flags=lanczos,crop=1080:1920"
    if fl == "zoom": D=(b-a)/sp; f += f",scale=w='trunc(1080*(1+0.07*t/{D:.2f})/2)*2':h=-2:eval=frame:flags=lanczos,crop=1080:1920"
    fc.append(f + f",fps=30,settb=1/30,format=yuv420p[s{i}]")
n=len(segs)
fc.append("".join(f"[s{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0,settb=1/30[ab]")
cur="ab"; k=n
for j,t in enumerate(texts):
    inp += ["-loop","1","-t","30","-i",f"{OV}/{t['name']}.png"]
    fc.append(f"[{k}:v]format=rgba,fade=in:st={t['t0']:.3f}:d={0.35 if t['name']=='end' else 0.1}:alpha=1[o{j}]")
    fc.append(f"[{cur}][o{j}]overlay=0:0:enable='between(t,{t['t0']:.3f},{t['t1']-0.001:.3f})'[c{j}]"); cur=f"c{j}"; k+=1
fc.append(f"[{cur}]format=yuv420p[vout]")
# sound: quiet. soft supermarket ambience under the shopping shots, real sizzle under cooking
R=f"{S}/raw"; AF="aformat=sample_rates=48000:channel_layouts=stereo"
inp += ["-i", f"{R}/IMG_4755.MOV", "-i", f"{R}/IMG_4726.MOV", "-i", f"{R}/IMG_4693.MOV"]
shop0, shopL = st[4], st[10]-st[4]
fc.append(f"[{k}:a:0][{k+1}:a:0]amix=inputs=2:normalize=0,{AF},atrim=0:{shopL:.2f},highpass=f=150,lowpass=f=3200,adeclick,acompressor=threshold=0.1:ratio=3,volume=0.5,alimiter=limit=0.4,afade=t=in:d=0.4,afade=t=out:st={shopL-0.4:.2f}:d=0.4,adelay=delays={int(shop0*1000)}:all=1[shop]")
fc.append(f"[{k+2}:a:0]atrim=0.1:1.5,asetpts=PTS-STARTPTS,{AF},highpass=f=150,lowpass=f=5000,volume=2.5,afade=t=in:d=0.2,afade=t=out:st=1.0:d=0.4,adelay=delays={int(st[11]*1000)}:all=1[sizz]")
fc.append(f"[shop][sizz]amix=inputs=2:normalize=0,apad,atrim=0:{T:.2f}[aout]")
subprocess.run(["ffmpeg","-v","error","-y",*inp,"-filter_complex",";".join(fc),"-map","[vout]","-map","[aout]","-t",f"{T:.2f}",
  "-c:v","libx264","-crf","16","-preset","medium","-r","30","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709",
  "-c:a","aac","-b:a","192k","-movflags","+faststart",OUT],check=True)
print(round(T,2))
