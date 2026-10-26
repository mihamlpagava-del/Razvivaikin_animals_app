import miniaudio
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\Bachi\.gemini\antigravity\brain\260e2ffa-9081-4de2-b21d-ede3d0760084\.user_uploaded\uploaded_media_1793052925629.mp3'
d = miniaudio.decode_file(path)
sr = d.sample_rate
ch = d.nchannels
samples = d.samples
dur = len(samples) / (sr * ch)
print(f"Narrator Birds Track: sr={sr}, ch={ch}, dur={dur:.2f}s")

win_s = 0.05
win_frames = int(sr * win_s)
tot_frames = len(samples) // ch

energy = []
for f in range(0, tot_frames, win_frames):
    sub = samples[f*ch : (f+win_frames)*ch]
    if not sub:
        break
    rms = math.sqrt(sum(s*s for s in sub) / len(sub))
    t = f / sr
    energy.append((t, rms))

in_speech = False
seg_start = 0
segments = []
for t, rms in energy:
    if rms > 700 and not in_speech:
        in_speech = True
        seg_start = t
    elif rms <= 700 and in_speech:
        if t - seg_start > 0.15:
            segments.append((seg_start, t))
        in_speech = False

if in_speech:
    segments.append((seg_start, dur))

merged = []
for s, e in segments:
    if not merged:
        merged.append([s, e])
    else:
        if s - merged[-1][1] < 0.25:
            merged[-1][1] = e
        else:
            merged.append([s, e])

print(f"Found {len(merged)} speech segments:")
for idx, (s, e) in enumerate(merged):
    print(f"[{idx+1}] {s:.2f}s - {e:.2f}s (dur={e-s:.2f}s)")
