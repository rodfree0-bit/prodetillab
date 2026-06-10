import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('seed-database.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

# Find addon blocks
addon_blocks = re.findall(r'const\s+addons\s*=\s*\[(.*?)\];', content, re.DOTALL)
if addon_blocks:
    block = addon_blocks[0]
    addons = re.findall(r'\{\s*id:\s*\"([^\"]+)\",\s*name:\s*\"([^\"]+)\",.*?price:\s*\{(.*?)\}\s*\}', block, re.DOTALL)
    for aid, name, price_text in addons:
        keys = []
        for line in price_text.split('\n'):
            line = line.strip()
            if ':' in line:
                key = line.split(':')[0].strip().replace('"', '').replace("'", "")
                keys.append(key)
        print(f"Addon: {aid} ({name}) -> keys: {keys}")
else:
    print("addons block not found!")
