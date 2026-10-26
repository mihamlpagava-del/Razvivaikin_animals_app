import re

with open('data/animals.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r"id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*habitat:\s*'([^']+)'", text)
for aid, aname, ahab in matches:
    print(f"{aid:15} | {aname:20} | {ahab}")
