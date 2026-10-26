import miniaudio
import math
import sys

sys.stdout.reconfigure(encoding='utf-8')

def profile(name, fname):
    path = r'C:\Users\Bachi\.gemini\antigravity\brain\260e2ffa-9081-4de2-b21d-ede3d0760084\.user_uploaded\\' + fname
    d = miniaudio.decode_file(path)
    sr, ch, samples = d.sample_rate, d.nchannels, d.samples
    tot_f = len(samples) // ch
    dur = tot_f / sr
    w = int(sr * 0.2)
    print(f"=== {name} (dur={dur:.2f}s, sr={sr}, ch={ch}) ===")
    for f in range(0, tot_f, w):
        chunk = samples[f*ch:(f+w)*ch]
        if not chunk: break
        rms = math.sqrt(sum(s*s for s in chunk)/len(chunk))
        pk = max(abs(s) for s in chunk)
        if rms > 100:
            print(f"{f/sr:4.1f}s: rms={rms:5.0f} peak={pk:5d}")

profile('Elk (Лось)', 'uploaded_media_1793052562007.mp3')
profile('Lynx (Рысь)', 'uploaded_media_1793052595130.mp3')
profile('Beaver (Бобёр)', 'uploaded_media_1793052812815.mp3')
profile('Owl (Сова)', 'uploaded_media_1793052854625.mp3')
