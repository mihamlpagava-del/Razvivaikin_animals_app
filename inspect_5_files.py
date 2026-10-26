import miniaudio
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\Bachi\.gemini\antigravity\brain\260e2ffa-9081-4de2-b21d-ede3d0760084\.user_uploaded'
files = [
    'uploaded_media_0_1793051664046.mp3',
    'uploaded_media_1_1793051664046.mp3',
    'uploaded_media_2_1793051664046.mp3',
    'uploaded_media_3_1793051664046.mp3',
    'uploaded_media_4_1793051664046.mp3'
]

for idx, f in enumerate(files):
    p = f"{base}\\{f}"
    d = miniaudio.decode_file(p)
    dur = len(d.samples) / (d.sample_rate * d.nchannels)
    print(f"\n=== Media {idx} ({f}): dur={dur:.2f}s, sr={d.sample_rate}, ch={d.nchannels} ===")
