import miniaudio
import wave
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

UPLOADS_DIR = r'C:\Users\Bachi\.gemini\antigravity\brain\260e2ffa-9081-4de2-b21d-ede3d0760084\.user_uploaded'

SOUND_DIRS = [
    r'D:\Gameproject\animal_app\public\assets\audio\sounds',
    r'D:\Gameproject\animal_app\assets\audio\sounds',
    r'D:\Gameproject\animal_app\dist\assets\audio\sounds'
]

VOICE_DIRS = [
    r'D:\Gameproject\animal_app\public\assets\audio\voices',
    r'D:\Gameproject\animal_app\assets\audio\voices',
    r'D:\Gameproject\animal_app\dist\assets\audio\voices'
]

def write_wav(filename, samples, sr, ch, target_dirs, also_mp3=False):
    raw_bytes = bytearray()
    for s in samples:
        s_clamped = max(-32768, min(32767, int(s)))
        raw_bytes += int(s_clamped).to_bytes(2, byteorder='little', signed=True)
    
    for d_out in target_dirs:
        out_wav = os.path.join(d_out, filename)
        with wave.open(out_wav, 'wb') as wf:
            wf.setnchannels(ch)
            wf.setsampwidth(2)
            wf.setframerate(sr)
            wf.writeframes(raw_bytes)
        
        if also_mp3 and filename.endswith('.wav'):
            out_mp3 = os.path.join(d_out, filename[:-4] + '.mp3')
            with wave.open(out_mp3, 'wb') as wf:
                wf.setnchannels(ch)
                wf.setsampwidth(2)
                wf.setframerate(sr)
                wf.writeframes(raw_bytes)

# 1. Process Hummingbird Sound
print("--- Processing Hummingbird Sound ---")
hb_path = os.path.join(UPLOADS_DIR, 'uploaded_media_1793052984397.mp3')
d = miniaudio.decode_file(hb_path)
sr, ch, samples = d.sample_rate, d.nchannels, d.samples
s_start = 0
s_end = min(len(samples), int(2.6 * sr) * ch)
sliced = list(samples[s_start:s_end])
# Normalize
pk = max(abs(s) for s in sliced)
gain = 25000 / pk if pk > 0 else 1.0
sliced = [int(s * gain) for s in sliced]
# Fades
tot_f = len(sliced) // ch
fin = int(sr * 0.02)
fout = int(sr * 0.03)
for i in range(min(fin, tot_f)):
    factor = i / fin
    for c in range(ch):
        sliced[i * ch + c] = int(sliced[i * ch + c] * factor)
for i in range(min(fout, tot_f)):
    factor = i / fout
    idx = tot_f - 1 - i
    for c in range(ch):
        sliced[idx * ch + c] = int(sliced[idx * ch + c] * factor)
write_wav('hummingbird_1.wav', sliced, sr, ch, SOUND_DIRS)
print(f"✓ Sound hummingbird_1.wav: {len(sliced)/(sr*ch):.2f}s")

# 2. Slice Birds Voice Track
print("\n--- Slicing Birds Voice Track ---")
bv_path = os.path.join(UPLOADS_DIR, 'uploaded_media_1793052925629.mp3')
d = miniaudio.decode_file(bv_path)
bsr, bch, bsamples = d.sample_rate, d.nchannels, d.samples

bird_slices = [
    ('eagle', 0.00, 0.80),
    ('flamingo', 1.10, 2.10),
    ('hummingbird', 2.25, 3.15),
    ('peacock', 3.35, 4.15),
    ('swan', 4.45, 5.15),
    ('toucan', 5.65, 6.25),
    ('parrot', 6.65, 7.25),
    ('penguin', 7.45, 8.25),
    ('owl', 8.60, 9.15),
    ('woodpecker', 9.45, 10.05),
    ('pelican', 10.40, 11.20),
    ('ostrich', 11.55, 12.15)
]

for name, t_s, t_e in bird_slices:
    s_idx = int(t_s * bsr) * bch
    e_idx = int(t_e * bsr) * bch
    sub = list(bsamples[s_idx:e_idx])
    tot_f = len(sub) // bch
    curr_pk = max(abs(s) for s in sub) if sub else 1
    gain = 27000 / curr_pk
    sub = [int(s * gain) for s in sub]
    
    fin = int(bsr * 0.015)
    fout = int(bsr * 0.025)
    for i in range(min(fin, tot_f)):
        factor = i / fin
        for c in range(bch):
            sub[i * bch + c] = int(sub[i * bch + c] * factor)
    for i in range(min(fout, tot_f)):
        factor = i / fout
        idx = tot_f - 1 - i
        for c in range(bch):
            sub[idx * bch + c] = int(sub[idx * bch + c] * factor)
            
    dur = len(sub) / (bsr * bch)
    write_wav(f"{name}.wav", sub, bsr, bch, VOICE_DIRS, also_mp3=True)
    print(f"✓ Voice {name:15}: {dur:.2f}s ({name}.wav & {name}.mp3)")

print("\n✓ Processing complete!")
