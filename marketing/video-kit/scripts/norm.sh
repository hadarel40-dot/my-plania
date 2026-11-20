#!/usr/bin/env bash
# Normalize iPhone clips: HDR (HLG/PQ) -> SDR with tone mapping, 1080x1920, 30fps, lanczos.
# Usage: scripts/norm.sh 4705 [4717 ...]   (reads raw/IMG_N.MOV, writes norm/IMG_N.mp4)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p norm
for n in "$@"; do
  in="raw/IMG_$n.MOV"; out="norm/IMG_$n.mp4"
  trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 "$in" | tr -d ",\n")
  scale="scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920"
  if [[ "$trc" == "arib-std-b67" || "$trc" == "smpte2084" ]]; then
    vf="zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,$scale,fps=30"
  else
    vf="$scale,fps=30,format=yuv420p"
  fi
  ffmpeg -v error -y -i "$in" -vf "$vf" -c:v libx264 -crf 16 -preset fast -c:a aac -b:a 160k -ar 48000 "$out"
  echo "ok $out ($trc)"
done
