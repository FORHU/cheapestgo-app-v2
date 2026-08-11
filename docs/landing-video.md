# Landing page background video

`public/videos/landing-hero.mp4` is the aerial night-city loop behind the landing
page. It is encoded from a master that is **not** in the repo.

| | master | shipped loop |
| --- | --- | --- |
| source | `Video Project 1.mp4` | `public/videos/landing-hero.mp4` |
| size | 590 MB | 5.3 MB |
| duration | 4m 06s | 20.000s |
| video | 1080p30 H.264 @ 20 Mbps | 1080p30 H.264 @ 2.1 Mbps |
| audio | AAC 192 kbps | none |

The master is gitignored (`/public/*.mp4`). Keep it somewhere outside the repo;
re-encode from it if the loop ever needs to change.

## Why it is cut this way

- **20 Mbps is what made it stall.** A browser cannot stream that as a
  background layer. Everything below exists to get the bitrate down without
  visibly degrading the point lights, which are the whole appeal of the shot.
- **Segment 26s–48s.** The master drifts from dense city to near-black
  countryside over its 4 minutes; only the first minute has usable density, and
  26–48s is the most consistent stretch of it.
- **No audio.** Required for reliable autoplay, and saves ~500 KB.
- **`hqdn3d` denoise.** Sensor grain in dark footage is disproportionately
  expensive to encode. Denoising first drops the bitrate by roughly 40% at
  matched visual quality — at 1:1 the denoised CRF 30 is indistinguishable from
  a lightly-denoised CRF 28 that costs 7 MB.
- **1080p, not 720p.** 720p halves the size but visibly smears the road lights
  when upscaled to a full-bleed background.
- **`+faststart`.** Puts the moov atom first so playback can begin before the
  file has finished downloading.
- **Fixed 2s GOP, no scene-cut keyframes.** Keeps the loop restart cheap.

## Seamless loop

`loop` on a `<video>` cuts hard from last frame to first. Since the camera has
drifted over 20s, that cut would be visible. The encode fixes this in the filter
graph rather than relying on the browser:

Take 22s, hold back the final 2s, and crossfade that tail *over the first 2s* of
the output. The result is 20s whose first frame equals its own last frame, so the
loop point is continuous. Verified by extracting frame 0 and frame 599 and
comparing them.

## Re-encoding

Needs `ffmpeg`. `npx ffmpeg-static` or `winget install Gyan.FFmpeg`.

```sh
SRC="Video Project 1.mp4"
CHAIN="[0:v]trim=start=0:end=20,setpts=PTS-STARTPTS[main];\
[0:v]trim=start=20:end=22,setpts=PTS-STARTPTS[tail];\
[main]split[m1][m2];\
[m1]trim=start=0:end=2,setpts=PTS-STARTPTS[mhead];\
[m2]trim=start=2,setpts=PTS-STARTPTS[mrest];\
[tail][mhead]blend=all_expr='A*(1-(T/2))+B*(T/2)'[xf]"

ffmpeg -y -ss 26 -t 22 -i "$SRC" \
  -filter_complex "$CHAIN;[xf][mrest]concat=n=2:v=1:a=0,hqdn3d=4:3:6:5[v]" \
  -map "[v]" -an \
  -c:v libx264 -preset slower -crf 30 -pix_fmt yuv420p \
  -profile:v high -level 4.1 \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -movflags +faststart \
  public/videos/landing-hero.mp4

ffmpeg -y -i public/videos/landing-hero.mp4 -frames:v 1 -vf "scale=1280:-2" -q:v 5 \
  public/videos/landing-hero-poster.jpg
```

The poster is what shows before the first frame decodes, and what replaces the
video entirely under `prefers-reduced-motion`. Regenerate it whenever the loop
changes, or the still and the motion will disagree.

Paths and the scrim live in
`src/features/landing/components/landing-video-backdrop.tsx`.
