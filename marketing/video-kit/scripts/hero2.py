import json, subprocess, os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); N=f"{S}/norm"; OV=f"{S}/ov3"; os.makedirs(OV, exist_ok=True)
OUT = "/home/user/my-plania/marketing/reels-2026-11-15/00_PLANIA_HERO.mp4"
FILM = "curves=master='0/0.02 0.25/0.235 0.5/0.505 0.75/0.775 1/0.95',colorbalance=rs=-0.01:bs=0.02:rh=0.025:gh=0.008:bh=-0.025,eq=saturation=1.04,vignette=angle=PI/7"
G = "eq=contrast=1.15:brightness=0.05:saturation=1.1,colorbalance=gm=-0.03:rm=0.02:bm=-0.01," + FILM
HDR = {"4705","4717","4720","4693"}
LIFT = "eq=brightness=0.035:gamma=1.08:saturation=1.03,"
notes = [("4662",1.15,1.75),("4667",0.85,1.4),("4669",0.75,1.3),("4677",0.25,1.2)]
XF = 0.0
segs = [("4685",0.6,2.0,"boom"),("4705",2.3,4.6,""),("4717",0.9,1.8,""),("4720",1.6,3.6,""),("4638",0.0,1.1,""),
        ("4641",0.6,2.2,""),("4693",0.1,1.5,""),("4642",2.5,5.5,"zoom")]
A = sum(b-a for _,a,b in notes) - XF*(len(notes)-1)
SP = {"4685":1.6}
T = A + sum((b-a)/SP.get(c,1) for c,a,b,_ in segs)
o = A - 3.88 + ((2.0-0.6)/1.6 - 2.05)   # shift vs. previous timeline
HIT = A + (1.0-0.6)/1.6
texts = [
 dict(name="t1", title="המקרר שלי בכל שבוע:", ts=130, color="#f5afb9", top=250, t0=0, t1=A),
 dict(name="t2", title="פותחת את המקפיא", sub="ושוב לא יודעת מה מכינים", top=1050, t0=5.93+o, t1=8.23+o),
 dict(name="t3", title="ואז הבנתי", ts=140, top=760, t0=8.23+o, t1=9.13+o),
 dict(name="t4", title="שאפשר לרכז הכול במקום אחד", top=280, t0=9.13+o, t1=11.13+o),
 dict(name="t5", title="כל השבוע מתוכנן", sub="מה מבשלים, ומתי", top=280, t0=11.13+o, t1=13.83+o),
 dict(name="t6", title="ובערב יודעת מה מבשלים", top=280, t0=13.83+o, t1=15.23+o),
 dict(name="t7", sub="וסוף סוף, ראש שקט", ss=130, top=300, t0=15.5+o, t1=T-0.05),
 dict(name="end", kind="endlogo", sub="", t0=T-1.7, t1=T),
]
subprocess.run(["node", f"{S}/scripts/overlay2.js", "/dev/stdin", OV], input=json.dumps(texts).encode(), check=True)
inp, fc = [], []
for j,(c,a,b) in enumerate(notes):
    inp += ["-i", f"{N}/IMG_{c}.mp4"]
    fc.append(f"[{j}:v]trim={a}:{b},setpts=PTS-STARTPTS,{G},fps=30,settb=1/30,format=yuv420p[n{j}]")
prev="n0"; acc=notes[0][2]-notes[0][1]
if XF == 0:
    fc.append("".join(f"[n{j}]" for j in range(len(notes))) + f"concat=n={len(notes)}:v=1:a=0,settb=1/30[nall]"); prev="nall"
for j in (range(1,len(notes)) if XF else []):
    acc -= XF
    fc.append(f"[{prev}][n{j}]xfade=transition=fade:duration={XF}:offset={acc:.3f},settb=1/30[nx{j}]"); prev=f"nx{j}"
    acc += notes[j][2]-notes[j][1]
NB=len(notes)
for i,(c,a,b,fl) in enumerate(segs):
    inp += ["-i", f"{N}/IMG_{c}.mp4"]
    f = f"[{i+NB}:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{SP.get(c,1)}," + (G if c=="4685" else (LIFT+FILM if c in HDR else FILM))
    if fl=="boom":
        h=(1.0-0.6)/1.6
        f += (f",scale=w='trunc(1080*(1.06+0.16*exp(-(t-{h})*9)*gte(t,{h}))/2)*2':h=-2:eval=frame:flags=bicubic"
              f",crop=1080:1920:x='(iw-1080)/2+34*sin(t*97)*exp(-(t-{h})*7)*gte(t,{h})':y='(ih-1920)/2+26*cos(t*83)*exp(-(t-{h})*7)*gte(t,{h})'"
              f",drawbox=c=white@0.85:t=fill:enable='between(t,{h},{h+0.06})'")
    if fl=="zoom": D=b-a; f += f",scale=w='trunc(1080*(1+0.07*t/{D:.2f})/2)*2':h=-2:eval=frame,crop=1080:1920"
    fc.append(f + f",fps=30,settb=1/30,format=yuv420p[s{i}]")
n=len(segs)+NB
fc.append(f"[{prev}]" + "".join(f"[s{i}]" for i in range(len(segs))) + f"concat=n={len(segs)+1}:v=1:a=0,settb=1/30[ab]")
cur="ab"; k=n
for j,t in enumerate([t for t in texts if t.get("kind") in (None,"endlogo")]):
    inp += ["-loop","1","-t","25","-i",f"{OV}/{t['name']}.png"]
    fc.append(f"[{k}:v]format=rgba,fade=in:st={t['t0']}:d={0.5 if t.get('kind') else 0.1}:alpha=1[o{j}]")
    fc.append(f"[{cur}][o{j}]overlay=0:0:enable='between(t,{t['t0']},{t['t1']-0.001:.3f})'[c{j}]"); cur=f"c{j}"; k+=1
fc.append(f"[{cur}]format=yuv420p[vout]")
inp += ["-f","lavfi","-i","anullsrc=r=48000:cl=stereo"]
subprocess.run(["ffmpeg","-v","error","-y",*inp,"-filter_complex",";".join(fc),"-map","[vout]","-map",f"{k}:a","-t",f"{T:.2f}",
  "-c:v","libx264","-crf","16","-color_primaries","bt709","-color_trc","bt709","-colorspace","bt709","-preset","medium","-r","30","-c:a","aac","-b:a","128k","-movflags","+faststart",OUT],check=True)
print(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",OUT],capture_output=True,text=True).stdout)

# ---------------- sound design ----------------
SFX = "/home/user/my-plania/video-editor/public/sfx"; RAW = f"{S}/raw"
cuts = [0.0]
for c,a,b in notes[:-1]: cuts.append(cuts[-1] + (b-a))
s1 = A + (2.0-0.6)/1.6; s2 = s1 + 2.3; s3 = s2 + 0.9; s4 = s3 + 2.0; s5 = s4 + 1.1; s6 = s5 + 1.6; s7 = s6 + 1.4
L = HIT + 0.05; TOT = T
ai, af = [], []
def add_in(args): ai.extend(args); return len([x for x in ai if x == "-i"]) - 1
AF = "aformat=sample_rates=48000:channel_layouts=stereo"
# crowd murmur: many offset layers of on-set voices, softened (no harsh highs), with a little room echo
chaos = [("4711",4.0),("4711",11.0),("4711",19.0),("4741",3.0),("4741",12.0),("4741",20.0),("4716",4.0),("4716",13.0),("4745",2.0),("4646",1.0)]
labs = []
SOFT = "highpass=f=180,lowpass=f=2600,alimiter=limit=0.5,acompressor=threshold=0.1:ratio=3:attack=20:release=200"
for j,(c,st) in enumerate(chaos):
    k = add_in(["-i", f"{RAW}/IMG_{c}.MOV"])
    pan = ["0.9*c0+0.3*c1","0.3*c0+0.9*c1"][j%2]
    af.append(f"[{k}:a:0]atrim={st}:{st+L},asetpts=PTS-STARTPTS,{AF},{SOFT},adeclick,volume=0.95[ch{j}]"); labs.append(f"[ch{j}]")
af.append("".join(labs) + f"amix=inputs={len(labs)}:normalize=0,lowpass=f=2400,aecho=0.8:0.6:45|80:0.25|0.18,"
          f"volume='0.25+0.85*pow(t/{HIT:.3f},1.5)':eval=frame,acompressor=threshold=0.2:ratio=3,alimiter=limit=0.7,afade=t=in:d=0.3,afade=t=out:st={HIT-0.04:.3f}:d=0.04[chaos]")
mixl = ["[chaos]"]
# one deep soft thump at the hit
k = add_in(["-f","lavfi","-t","1.2","-i","aevalsrc='0.9*sin(2*PI*(62*t-18*t*t))*exp(-t*4.5)':s=48000"])
af.append(f"[{k}:a]{AF},lowpass=f=160,volume=1.0,adelay=delays={int(HIT*1000)}:all=1[thump]"); mixl.append("[thump]")
# real pan sizzle, soft
k = add_in(["-i", f"{RAW}/IMG_4693.MOV"])
af.append(f"[{k}:a:0]atrim=0.1:1.5,asetpts=PTS-STARTPTS,{AF},highpass=f=150,lowpass=f=5000,volume=2.5,afade=t=in:d=0.2,afade=t=out:st=1.0:d=0.4,adelay=delays={int(s6*1000)}:all=1[sizz]"); mixl.append("[sizz]")
af.append("".join(mixl) + f"amix=inputs={len(mixl)}:normalize=0,alimiter=limit=0.85,apad,atrim=0:{TOT:.3f}[aout]")
AOUT = f"{S}/hero_audio.wav"
subprocess.run(["ffmpeg","-v","error","-y",*ai,"-filter_complex",";".join(af),"-map","[aout]","-ar","48000",AOUT], check=True)
TMP = OUT.replace(".mp4","_tmp.mp4")
subprocess.run(["ffmpeg","-v","error","-y","-i",OUT,"-i",AOUT,"-map","0:v","-map","1:a","-c:v","copy","-c:a","aac","-b:a","192k","-movflags","+faststart","-shortest",TMP], check=True)
os.replace(TMP, OUT)
print("audio ok", round(HIT,2), round(T,2))
