#!/usr/bin/env bash
# מייצר את ספריית אפקטי הסאונד (public/sfx) מאפס עם FFmpeg, בלי קבצים חיצוניים ובלי זכויות יוצרים
set -euo pipefail
cd "$(dirname "$0")/../public/sfx"
gen() { # gen <name> <ffmpeg input/filter args...>
  local name=$1; shift
  ffmpeg -loglevel error -y "$@" -ac 2 -ar 44100 -b:a 96k "$name.mp3"
}
gen pop     -f lavfi -i "aevalsrc='0.8*sin(2*PI*(500*t+4000*t*t))*exp(-t*35)':d=0.15"
gen whoosh  -f lavfi -i "anoisesrc=d=0.6:c=pink:a=0.6" -af "bandpass=f=1200:w=900,afade=t=in:d=0.25,afade=t=out:st=0.3:d=0.3,volume=40dB,alimiter=limit=0.7"
gen ding    -f lavfi -i "aevalsrc='0.5*(sin(2*PI*1320*t)+0.4*sin(2*PI*2640*t)+0.2*sin(2*PI*3960*t))*exp(-t*4)':d=1.2"
gen click   -f lavfi -i "anoisesrc=d=0.03:c=white:a=0.8" -af "highpass=f=2000,afade=t=out:d=0.03"
gen riser   -f lavfi -i "aevalsrc='0.5*sin(2*PI*(150*t+900*t*t))*min(1,t*3)':d=1.1" -af "afade=t=out:st=0.9:d=0.2"
gen boom    -f lavfi -i "aevalsrc='0.9*sin(2*PI*(90*t-30*t*t))*exp(-t*3.5)':d=1"
gen success -f lavfi -i "aevalsrc='0.45*(sin(2*PI*880*t)*exp(-t*6)*lt(t,0.18)+sin(2*PI*1320*(t-0.15))*exp(-(t-0.15)*4)*gte(t,0.15))':d=1"
gen typing  -f lavfi -i "anoisesrc=d=1.2:c=white:a=0.7" -af "highpass=f=1500,volume='if(lt(mod(t,0.13),0.018),1,0)':eval=frame,afade=t=out:st=1:d=0.2"
gen swipe   -f lavfi -i "aevalsrc='0.6*sin(2*PI*(1800*t-1500*t*t))*exp(-t*6)':d=0.4"
gen notify  -f lavfi -i "aevalsrc='0.5*sin(2*PI*700*t)*(lt(mod(t,0.12),0.06))*exp(-t*2)':d=0.7"
for f in *.mp3; do printf "%-12s %6s bytes  %ss\n" "$f" "$(stat -c%s "$f")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"; done
