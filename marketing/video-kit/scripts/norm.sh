#!/bin/bash
# norm.sh <id> : 1080x1920 30fps bt709, tone-mapping HLG sources
S=$(cd "$(dirname "$0")/.." && pwd); b=$1; f=$S/raw/IMG_$b.MOV
trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 $f)
pre=""; [[ "$trc" == arib-std-b67* ]] && pre="zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=200,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,"
ffmpeg -v error -y -i $f -vf "${pre}scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,fps=30,format=yuv420p" -c:v libx264 -crf 14 -preset fast -color_primaries bt709 -color_trc bt709 -colorspace bt709 -an $S/norm2/IMG_$b.mp4 && echo "ok $b $trc"
