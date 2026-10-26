import miniaudio
import wave
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

src = r'C:\Users\Bachi\.gemini\antigravity\brain\260e2ffa-9081-4de2-b21d-ede3d0760084\.user_uploaded\uploaded_media_1793052269541.mp3'
d = miniaudio.decode_file(src)
sr = d.sample_rate
ch = d.nchannels
samples = list(d.samples)

fade_in_len = int(sr * 0.02)
fade_out_len = int(sr * 0.04)

total_f = len(samples) // ch
for i in range(min(fade_in_len, total_f)):
    factor = i / fade_in_len
    for c in range(ch):
        pos = i * ch + c
        samples[pos] = int(samples[pos] * factor)

for i in range(min(fade_out_len, total_f)):
    factor = i / fade_out_len
    idx = total_f - 1 - i
    for c in range(ch):
        pos = idx * ch + c
        samples[pos] = int(samples[pos] * factor)

raw_bytes = bytearray()
for s in samples:
    s_clamped = max(-32768, min(32767, s))
    raw_bytes += int(s_clamped).to_bytes(2, byteorder='little', signed=True)

dur = len(samples) / (sr * ch)
print(f"✓ Real Bear Roar: dur={dur:.2f}s ({len(raw_bytes)} bytes)")

target_dirs = [
    r'D:\Gameproject\animal_app\public\assets\audio\sounds',
    r'D:\Gameproject\animal_app\assets\audio\sounds',
    r'D:\Gameproject\animal_app\dist\assets\audio\sounds'
]

for d_out in target_dirs:
    os.makedirs(d_out, exist_ok=True)
    out_wav = os.path.join(d_out, 'bear_1.wav')
    with wave.open(out_wav, 'wb') as wf:
        wf.setnchannels(ch)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(raw_bytes)

print("✓ Saved bear_1.wav in all directories!")
