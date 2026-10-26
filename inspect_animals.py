import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('data/animals.js', 'r', encoding='utf-8') as f:
    text = f.read()

for animal_id in ['pig', 'bear', 'fox', 'hare', 'hedgehog', 'squirrel', 'deer', 'elk']:
    target = f"id: '{animal_id}'"
    idx = text.find(target)
    if idx != -1:
        print(f"=== {animal_id} ===")
        print(text[idx:idx+350])
