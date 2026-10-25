#!/usr/bin/env bash
# Cuts the real app footage into frame sequences and cropped stills for the reels.
# Usage: ./prep-assets.sh <screen-recording.mp4> <weekly.png> <meals.png> <suggestions.png> <guide.png>
set -euo pipefail
cd "$(dirname "$0")"
REC=$1
A=assets
rm -rf "${A:?}/clip-tap" "${A:?}/clip-list"
mkdir -p "$A/clip-tap" "$A/clip-list"

# Drop the phone status bar (and the recording dot), keep 640px wide for the phone mockup.
CROP="crop=1206:2438:0:184,scale=640:-2"

# One tap: "Breaking down..." -> "Added! Got 48 ingredients".
ffmpeg -v error -y -ss 3.4 -to 6.1 -i "$REC" -vf "fps=30,$CROP" -q:v 3 "$A/clip-tap/%04d.jpg"

# Produce section scrolling (no section headers in frame), slowed to 0.4x, with the estimated-price column blurred out.
ffmpeg -v error -y -ss 7.65 -to 8.25 -i "$REC" -filter_complex \
  "[0:v]setpts=PTS/0.4,split[a][b];[b]crop=124:1850:390:590,boxblur=18:2[p];[a][p]overlay=390:590,fps=30,$CROP" \
  -q:v 3 "$A/clip-list/%04d.jpg"

i=0
for name in weekly meals suggestions guide; do
  i=$((i + 1))
  src=${@:$((i + 1)):1}
  convert "$src" -crop 1206x2438+0+184 +repage -resize 640x -quality 90 "$A/$name.jpg"
done
ls "$A/clip-tap" | wc -l; ls "$A/clip-list" | wc -l
