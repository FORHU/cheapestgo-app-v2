# Landing page background video

`public/videos/landing-ocean.mp4` is the coastline loop behind the landing page.
It is encoded from a master that is **not** in the repo.

| | master | shipped loop |
| --- | --- | --- |
| source | `Ocean Background.mp4` | `public/videos/landing-ocean.mp4` |
| size | 929 MB | 1.9 MB |
| duration | 31.7s | 10.000s |
| video | 2160p24 APV 10-bit 4:2:2 @ 245 Mbps | 1080p24 H.264 @ 1.6 Mbps |
| audio | AAC 320 kbps | none |

The master is gitignored (`/public/*.mp4`, which matches the repo root only — the
encoded loop under `public/videos/` is tracked). Keep it somewhere outside the
repo; re-encode from it if the loop ever needs to change.

Paths and the scrim live in
`src/features/landing/components/landing-video-backdrop.tsx`.

## Why it is cut this way

- **245 Mbps is not streamable.** Everything below exists to get the bitrate
  down to something a browser can pull as a background layer without stalling.
- **Segment 0s–12s.** The plane is flying away from the coast for the whole
  master. The opening frame is the best one — coastline on the diagonal, wing
  and engine framing the left — and by ~22s the city has shrunk to a strip along
  the top edge and the frame is mostly empty water.
- **`zscale` with `d=error_diffusion`, not `format` alone.** Most of this frame
  is one smooth blue gradient, and taking it from 10-bit 4:2:2 to 8-bit 4:2:0
  with an undithered conversion bands it visibly. Doing the depth reduction
  inside `zscale` with error-diffusion dithering is what keeps it clean at
  1.6 Mbps.
- **No denoise.** The 4K→1080p downscale already averages the sensor noise away,
  and denoising on top only softens the coastline.
- **CRF 28.** Flat water shows blocking earlier than detailed footage does.
- **1080p, not 720p.** 720p halves the size but smears the beachfront buildings
  when upscaled to a full-bleed background.
- **`+faststart`.** Puts the moov atom first so playback can begin before the
  file has finished downloading.
- **Fixed 2s GOP, no scene-cut keyframes.** Keeps the loop restart cheap.
- **`-write_tmcd 0`, not just `-dn`.** Resolve writes a timecode track, and the
  mp4 muxer rebuilds one from the video stream's metadata even when the input
  data track is dropped — you get a two-stream file with a phantom `tmcd` track
  unless the muxer is told not to. `-map_metadata -1` drops the rest of Resolve's
  tags with it.

## Seamless loop

`loop` on a `<video>` cuts hard from last frame to first. The camera here is a
steady pan, so that cut would be very visible. The encode fixes it in the filter
graph rather than relying on the browser:

Take 12s, hold back the final 2s, and crossfade that tail *over the first 2s* of
the output. The result is 10s whose first frame is one frame ahead of its own
last frame, so the loop point is continuous.

**Why 10s and not 20s.** Cross-dissolving a linear pan shows both ends at once
for the length of the fade, and the two images are separated by exactly one
loop-length of camera travel — the fade duration changes how softly you see the
ghost, never how far apart it is. Only the loop length controls that. Blending
frame 0 against frame *L* to preview the worst moment of the dissolve: at
*L* = 20s there are two distinct coastlines and a doubled wing edge; at 16s and
12s the wing still doubles clearly; at 10s the coastline is essentially single
and the wing barely softens. The wing is the giveaway — it is closest to the
camera, so parallax moves it fastest.

Verified by extracting the first and last frames and comparing them: 29.1 dB
PSNR across the loop point, against a 25.6 dB baseline for any two adjacent
frames. The seam moves less than one ordinary frame of motion.

## Re-encoding

Needs `ffmpeg` — but **a newer one than `npx ffmpeg-static` installs.** The
master comes out of DaVinci Resolve as APV (`apv1`), which ffmpeg only learned
to decode in 8.0; 6.1, which is what `ffmpeg-static` currently ships, fails with
`Could not find codec parameters ... unknown codec`. A recent
[BtbN build](https://github.com/BtbN/FFmpeg-Builds/releases) decodes it. Check
with `ffmpeg -decoders | grep apv` before assuming a build will work.

```sh
SRC="Ocean Background.mp4"
CHAIN="[0:v]trim=start=0:end=10,setpts=PTS-STARTPTS[main];\
[0:v]trim=start=10:end=12,setpts=PTS-STARTPTS[tail];\
[main]split[m1][m2];\
[m1]trim=start=0:end=2,setpts=PTS-STARTPTS[mhead];\
[m2]trim=start=2,setpts=PTS-STARTPTS[mrest];\
[tail][mhead]blend=all_expr='A*(1-(T/2))+B*(T/2)'[xf]"

ffmpeg -y -ss 0 -t 12 -i "$SRC" \
  -filter_complex "$CHAIN;[xf][mrest]concat=n=2:v=1:a=0,\
zscale=w=1920:h=1080:f=lanczos:d=error_diffusion,format=yuv420p[v]" \
  -map "[v]" -an -sn -dn -write_tmcd 0 -map_metadata -1 \
  -c:v libx264 -preset slower -crf 28 -pix_fmt yuv420p \
  -profile:v high -level 4.1 \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -movflags +faststart \
  public/videos/landing-ocean.mp4

ffmpeg -y -i public/videos/landing-ocean.mp4 -frames:v 1 -vf "scale=1280:-2" -q:v 5 \
  public/videos/landing-ocean-poster.jpg
```

The blend runs before the downscale, so it happens at the master's 10-bit depth
and only then gets dithered to 8-bit — blending after the conversion reintroduces
the banding the dither exists to prevent.

The poster is what shows before the first frame decodes, and what replaces the
video entirely under `prefers-reduced-motion`. Regenerate it whenever the loop
changes, or the still and the motion will disagree.

## The scrim

The page's chrome is thin slate text sitting straight on the footage, and this
is a bright shot — the wing, the sand and the sunlit water are all close to
white. The scrim is correspondingly heavy; it is what keeps the footer links and
the legal line legible. If the footage is ever swapped for something darker,
that gradient has to come down with it, or the shot will read as flat black.

## Previously

The background was `landing-hero.mp4`, an aerial night-city loop cut from a
master called `Video Project 1.mp4`. It is no longer referenced. Its encoded
files are still in `public/videos/` — delete them if that footage is not coming
back, since everything under `public/` ships in the deploy.
