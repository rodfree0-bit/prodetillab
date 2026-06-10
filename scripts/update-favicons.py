import os
import re

files = [
    'index.html',
    'landing/index.html',
    'landing/fleet_index.html',
    'landing/rv_detail.html',
    'landing/join.html'
]

for f in files:
    if not os.path.exists(f):
        continue
    
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Update favicon href exactly
    content = re.sub(r'href=\s*[\"\'\']([^\"\'\']*?)favicon_custom\.png[\"\'\']', r'href="\1logoasset.png?v=5"', content)
    content = re.sub(r'href=\s*[\"\'\']([^\"\'\']*?)logo\.webp[\"\'\']', r'href="\1logoasset.png?v=5"', content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print("Updated favicons placeholders in templates.")
