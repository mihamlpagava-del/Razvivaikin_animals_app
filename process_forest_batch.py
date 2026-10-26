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

for d in SOUND_DIRS + VOICE_DIRS:
    os.makedirs(d, exist_ok=True)

def write_wav(filename, samples, sr, ch, target_dirs, also_mp3=False):
    # Clamping & bytes conversion
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

def process_sound(src_file, t_start, t_end, out_name, target_peak=26000):
    src_path = os.path.join(UPLOADS_DIR, src_file)
    d = miniaudio.decode_file(src_path)
    sr = d.sample_rate
    ch = d.nchannels
    samples = d.samples
    
    s_start = max(0, int(t_start * sr)) * ch
    s_end = min(len(samples), int(t_end * sr) * ch)
    sliced = list(samples[s_start:s_end])
    
    tot_frames = len(sliced) // ch
    
    # Peak normalization
    curr_peak = max(abs(s) for s in sliced) if sliced else 1
    if curr_peak > 0:
        gain = target_peak / curr_peak
        if gain > 2.5: gain = 2.5 # prevent noise amplification
        sliced = [int(s * gain) for s in sliced]
    
    # Fade in / out
    fade_in = int(sr * 0.02)
    fade_out = int(sr * 0.03)
    
    for i in range(min(fade_in, tot_frames)):
        factor = i / fade_in
        for c in range(ch):
            sliced[i * ch + c] = int(sliced[i * ch + c] * factor)
            
    for i in range(min(fade_out, tot_frames)):
        factor = i / fade_out
        idx = tot_frames - 1 - i
        for c in range(ch):
            sliced[idx * ch + c] = int(sliced[idx * ch + c] * factor)
            
    dur = len(sliced) / (sr * ch)
    write_wav(out_name, sliced, sr, ch, SOUND_DIRS)
    print(f"✓ Sound {out_name:18}: {dur:.2f}s (peak={max(abs(s) for s in sliced)})")

print("--- Processing Animal Sounds ---")
process_sound('uploaded_media_1793052269541.mp3', 0.0, 3.8, 'bear_1.wav')
process_sound('uploaded_media_1793052309432.mp3', 0.6, 3.9, 'fox_1.wav')
process_sound('uploaded_media_1793052360667.mp3', 7.7, 9.2, 'hare_1.wav')
process_sound('uploaded_media_1793052360667.mp3', 0.1, 2.8, 'hare_2.wav')
process_sound('uploaded_media_1793052434570.mp3', 0.8, 4.2, 'hedgehog_1.wav')
process_sound('uploaded_media_1793052471230.mp3', 0.4, 2.8, 'squirrel_1.wav')
process_sound('uploaded_media_1793052502614.mp3', 0.2, 3.5, 'deer_1.wav')
process_sound('uploaded_media_1793052562007.mp3', 0.6, 4.4, 'elk_1.wav')
process_sound('uploaded_media_1793052595130.mp3', 0.2, 3.2, 'lynx_1.wav')
process_sound('uploaded_media_1793052694466.mp3', 2.2, 4.5, 'raccoon_1.wav')
process_sound('uploaded_media_1793052812815.mp3', 2.5, 5.5, 'beaver_1.wav')
process_sound('uploaded_media_1793052854625.mp3', 0.1, 2.5, 'owl_1.wav')

print("\n--- Slicing Narrator Voice Tracks (Category: Forest) ---")
voice_path = os.path.join(UPLOADS_DIR, 'uploaded_media_1793052762128.mp3')
vd = miniaudio.decode_file(voice_path)
vsr = vd.sample_rate
vch = vd.nchannels
vsamples = vd.samples

voice_slices = [
    ('elk', 0.00, 0.70),
    ('lynx', 1.00, 1.80),
    ('bear', 2.05, 3.00),
    ('wolf', 3.25, 4.05),
    ('fox', 4.25, 5.20),
    ('hare', 5.35, 6.15),
    ('squirrel', 6.40, 7.15),
    ('hedgehog', 7.45, 8.20),
    ('boar', 8.35, 9.15),
    ('deer', 9.25, 10.15),
    ('owl', 10.30, 11.00),
    ('woodpecker', 11.10, 11.85)
]

for name, t_s, t_e in voice_slices:
    s_idx = int(t_s * vsr) * vch
    e_idx = int(t_e * vsr) * vch
    sub = list(vsamples[s_idx:e_idx])
    tot_f = len(sub) // vch
    
    # Peak normalize voice
    curr_pk = max(abs(s) for s in sub) if sub else 1
    gain = 27000 / curr_pk
    sub = [int(s * gain) for s in sub]
    
    # Smooth fade
    fin = int(vsr * 0.015)
    fout = int(vsr * 0.025)
    for i in range(min(fin, tot_f)):
        factor = i / fin
        for c in range(vch):
            sub[i * vch + c] = int(sub[i * vch + c] * factor)
    for i in range(min(fout, tot_f)):
        factor = i / fout
        idx = tot_f - 1 - i
        for c in range(vch):
            sub[idx * vch + c] = int(sub[idx * vch + c] * factor)
            
    dur = len(sub) / (vsr * vch)
    write_wav(f"{name}.wav", sub, vsr, vch, VOICE_DIRS, also_mp3=True)
    print(f"✓ Voice {name:15}: {dur:.2f}s ({name}.wav & {name}.mp3)")

print("\n✓ ALL Forest Sounds & Voice Tracks Generated Successfully!")
