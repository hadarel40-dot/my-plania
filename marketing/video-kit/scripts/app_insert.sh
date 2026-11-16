#!/bin/bash
# app_insert.sh <screen-recording.mov> <speed> <crop: bottom|top> <out.mp4> [start-seconds]
# Framed app screen (rounded corners + shadow) over a blurred, darkened copy of itself. 1080x1920.
K=$(cd "$(dirname "$0")/.." && pwd); in=$1; sp=$2; out=$4; ss=${5:+-ss $5}
[ "$3" = bottom ] && y="ih-1920-10" || y="180"
ffmpeg -v error -y $ss -i "$in" -loop 1 -i $K/assets/mask.png -loop 1 -i $K/assets/shadow.png -filter_complex \
"[0:v]setpts=PTS/$sp,scale=1080:-2:flags=lanczos,crop=1080:1920:0:$y,fps=30,split[bg][fg];[bg]boxblur=40:4,eq=brightness=-0.32:saturation=0.7[bgb];\
[fg]scale=820:1458:flags=lanczos,format=rgba[f2];[1:v]format=gray[m];[f2][m]alphamerge[fr];[2:v]format=gray,boxblur=20:2[shm];\
color=black:s=900x1540,format=rgba[shc];[shc][shm]alphamerge[shd];[bgb][shd]overlay=90:370:shortest=1[b2];[b2][fr]overlay=130:400:shortest=1,format=yuv420p" \
-c:v libx264 -crf 14 -preset fast -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -an "$out"
