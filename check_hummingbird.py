import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('data/animals.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = "id: 'hummingbird'"
idx = text.find(target)
if idx != -1:
    print(text[idx:idx+350])
