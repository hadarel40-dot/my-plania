import json, subprocess, os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); N=f"{S}/norm2"; OV=f"{S}/ov4"; os.makedirs(OV, exist_ok=True)
OUT = "/home/user/my-plania/marketing/reels-2026-11-15/01_SUPER_kniyot_lashavua.mp4"
# (clip, in, out, speed); "MID" = brand card
segs = [("4745",7.4,9.0,1.3),("4747",0.0,1.5,1.3),("4749",1.75,3.3,1.3),("4750",0.0,1.5,1.3),("4753",0.0,2.5,1.0),
        ("MID",0,1.0,1),
        ("APPA",0,4.0,1),("APPB",0,2.85,1),              # plania auto-planning (screen recording, fast)
        ("4724",3.3,4.6,1),                               # list builds itself
        ("4743",2.7,3.7,1),                               # price comparison
        ("4734",1.8,3.0,1),("4727",2.2,3.4,1),("4737",0.5,1.5,1),   # only what's needed
        ("4732",2.0,6.0,1.3)]                             # whole week set
T = sum((b-a)/sp for _,a,b,sp in segs)
st=[0]; [st.append(st[-1]+(b-a)/sp) for _,a,b,sp in segs]
BEFORE_END = st[5]; AFTER = st[6]
texts = [
 dict(name="b1", title="בלי plania:", sub="מעמיסה מה שנראה טוב", ts=130, top=240, t0=0, t1=st[4]),
 dict(name="b2", title="עגלה מלאה...", sub="ועדיין אין מה לבשל", ts=124, top=240, t0=st[4], t1=st[5]),
 dict(name="a1", title="עם plania:", sub="עונה על 5 שאלות", ts=124, top=110, t0=st[6], t1=st[7]),
 dict(name="a2", title="וכל השבוע מתוכנן", sub="בוקר, צהריים וערב", top=110, t0=st[7], t1=st[8]),
 dict(name="a3", title="רשימת הקניות נבנית לבד", top=240, t0=st[8], t1=st[9]),
 dict(name="a4", title="עם השוואת מחירים", top=240, t0=st[9], t1=st[10]),
 dict(name="a5", title="לוקחת רק מה שצריך", top=240, t0=st[10], t1=st[13]),
 dict(name="a6", title="כל השבוע סגור", sub="בלי לרוץ למכולת באמצע השבוע", ts=124, top=240, t0=st[13], t1=T-0.05),
 dict(name="end", kind="endlogo", sub="", t0=T-1.7, t1=T),
 dict(name="mid", kind="mid", title="ועם plania?"),
]
subprocess.run(["node", f"{S}/scripts/overlay2.js", "/dev/stdin", OV], input=json.dumps(texts).encode(), check=True)
BRIGHT = "curves=master='0/0.03 0.25/0.26 0.5/0.53 0.75/0.79 1/0.96',colorbalance=rh=0.02:bh=-0.015:rs=-0.005:bs=0.01,eq=saturation=1.06"
inp, fc = [], []
COOL = "colorbalance=rs=-0.02:bs=0.03:rh=-0.01:bh=0.02,eq=saturation=0.95,"
for i,(c,a,b,sp) in enumerate(segs):
    if c == "MID":
        inp += ["-loop","1","-t",str(b-a),"-framerate","30","-i",f"{OV}/mid.png"]
        fc.append(f"[{i}:v]format=yuv420p,setpts=PTS-STARTPTS,fps=30,settb=1/30[s{i}]"); continue
    inp += ["-i", f"{N}/IMG_{c}.mp4"]
    look = "null" if c.startswith("APP") else (COOL if i < 5 else "") + BRIGHT
    fc.append(f"[{i}:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},{look},fps=30,settb=1/30,format=yuv420p[s{i}]")
n=len(segs)
fc.append("".join(f"[s{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0,settb=1/30[ab]")
cur="ab"; k=n
for j,t in enumerate([t for t in texts if t.get("kind") in (None,"endlogo")]):
    inp += ["-loop","1","-t","25","-i",f"{OV}/{t['name']}.png"]
    fc.append(f"[{k}:v]format=rgba,fade=in:st={t['t0']:.3f}:d={0.5 if t.get('kind') else 0.1}:alpha=1[o{j}]")
    fc.append(f"[{cur}][o{j}]overlay=0:0:enable='between(t,{t['t0']:.3f},{t['t1']-0.001:.3f})'[c{j}]"); cur=f"c{j}"; k+=1
fc.append(f"[{cur}]format=yuv420p[vout]")
TOT = T
# sound: before = soft crowd murmur that builds (hectic), cut at the card; after = calm supermarket ambience
R = f"{S}/raw"; AF = "aformat=sample_rates=48000:channel_layouts=stereo"
SOFT = "highpass=f=180,lowpass=f=2600,alimiter=limit=0.5,acompressor=threshold=0.1:ratio=3:attack=20:release=200,adeclick"
L = BEFORE_END + 0.1; labs = []
for j,(c,s0) in enumerate([("4711",4.0),("4711",11.0),("4741",3.0),("4741",12.0),("4716",4.0),("4745",2.0),("4741",20.0),("4711",19.0)]):
    inp += ["-i", f"{R}/IMG_{c}.MOV"]
    fc.append(f"[{k}:a:0]atrim={s0}:{s0+L:.2f},asetpts=PTS-STARTPTS,{AF},{SOFT},volume=0.95[m{j}]"); labs.append(f"[m{j}]"); k += 1
fc.append("".join(labs) + f"amix=inputs={len(labs)}:normalize=0,lowpass=f=2400,aecho=0.8:0.6:45|80:0.25|0.18,volume='0.35+0.75*pow(t/{BEFORE_END:.2f},1.3)':eval=frame,"
          f"acompressor=threshold=0.2:ratio=3,alimiter=limit=0.7,afade=t=in:d=0.2,afade=t=out:st={BEFORE_END-0.25:.2f}:d=0.25[murmur]")
inp += ["-i", f"{R}/IMG_4732.MOV", "-i", f"{R}/IMG_4742.MOV"]
fc.append(f"[{k}:a:0]atrim=0:7.5,asetpts=PTS-STARTPTS,aloop=loop=3:size=360000[c1]")
fc.append(f"[{k+1}:a:0]atrim=0:5.3,asetpts=PTS-STARTPTS,aloop=loop=4:size=254400[c2]")
fc.append(f"[c1][c2]amix=inputs=2:normalize=0,{AF},highpass=f=150,lowpass=f=3200,adeclick,acompressor=threshold=0.1:ratio=3,volume=0.45,alimiter=limit=0.4,"
          f"atrim=0:{TOT-AFTER:.2f},afade=t=in:d=0.6,afade=t=out:st={TOT-AFTER-1.2:.2f}:d=1.2,adelay=delays={int(AFTER*1000)}:all=1[calm]")
fc.append(f"[murmur][calm]amix=inputs=2:normalize=0,apad,atrim=0:{TOT:.2f}[aout]")
subprocess.run(["ffmpeg","-v","error","-y",*inp,"-filter_complex",";".join(fc),"-map","[vout]","-map","[aout]","-t",f"{TOT:.2f}",
  "-c:v","libx264","-crf","16","-preset","medium","-r","30","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709",
  "-c:a","aac","-b:a","192k","-movflags","+faststart",OUT],check=True)
print(round(T,2), subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",OUT],capture_output=True,text=True).stdout)
