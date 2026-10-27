#!/usr/bin/env bash
# מייצר שלושה קליפים לדוגמה (720x1280, 6 שניות) לתוך public/samples
set -euo pipefail
cd "$(dirname "$0")/../public/samples"
opts=(-t 6 -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -g 30 -c:a aac -b:a 64k -movflags +faststart -shortest -y)
ffmpeg -loglevel error -f lavfi -i "testsrc2=size=720x1280:rate=30" -f lavfi -i "sine=frequency=440" "${opts[@]}" clip-1.mp4
ffmpeg -loglevel error -f lavfi -i "mandelbrot=size=720x1280:rate=30" -f lavfi -i "sine=frequency=330" "${opts[@]}" clip-2.mp4
ffmpeg -loglevel error -f lavfi -i "gradients=size=720x1280:rate=30:speed=0.04" -f lavfi -i "sine=frequency=550" "${opts[@]}" clip-3.mp4
for f in clip-*.mp4; do
  ffmpeg -loglevel error -ss 1 -i "$f" -frames:v 1 -vf scale=180:-2 -y "${f%.mp4}.jpg"
done
ls -lh
