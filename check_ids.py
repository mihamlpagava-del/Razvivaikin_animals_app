import re

with open('data/animals.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r"id:\s*'([^']+)',\s*name:\s*'([^']+)'", text)
for aid, aname in matches:
    if any(k in aname.lower() for k in ['лос', 'олен', 'белк', 'еж', 'ёж', 'заяц', 'лис', 'медвед', 'свин']):
        print(f"{aid:15} -> {aname}")
