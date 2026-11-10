#!/usr/bin/env bash
# Renders the pre-rendered apartment tour with HyperFrames, in resumable segments.
#   scripts/render-tour.sh            render every missing segment, then join and encode
# Output: public/tour/tour.mp4 and public/tour/poster.jpg. Rendering is slow without a GPU
# (about 5 s per frame in software); finished segments are kept in video/renders/ and skipped.
set -euo pipefail
cd "$(dirname "$0")/.."

FPS=24
SEG=8          # seconds per segment
END=55.85      # one loop of the tour (data-duration in video/index.html)
OUT=video/renders
mkdir -p "$OUT" public/tour

npx vite build -c video/vite.config.ts >/dev/null

i=0
start=0
: > "$OUT/list.txt"
while awk "BEGIN{exit !($start < $END)}"; do
  stop=$(awk "BEGIN{s=$start+$SEG; print (s<$END)?s:$END}")
  f=$(printf '%s/seg-%02d.mp4' "$OUT" "$i")
  if [ ! -s "$f" ]; then
    echo "segment $i: $start → $stop"
    HYPERFRAMES_SKIP_SKILLS=1 npx -y hyperframes@0.9.29 render video -f "$FPS" -w 1 --no-browser-gpu \
      --start "$start" --end "$stop" -o "$f.part.mp4" --quiet
    mv "$f.part.mp4" "$f"
  fi
  echo "file '$(basename "$f")'" >> "$OUT/list.txt"
  i=$((i + 1))
  start=$stop
done

# Join, then encode for the web: H.264, fast start, no audio.
ffmpeg -v error -y -f concat -safe 0 -i "$OUT/list.txt" -an -c:v libx264 -preset slow -crf 23 \
  -pix_fmt yuv420p -movflags +faststart public/tour/tour.mp4
ffmpeg -v error -y -ss 9 -i public/tour/tour.mp4 -frames:v 1 -q:v 4 public/tour/poster.jpg
ls -la public/tour
echo "tour rendered"
