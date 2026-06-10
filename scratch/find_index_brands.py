with open('./landing/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'brand' in line.lower() or 'logo_' in line.lower():
        print(f"Line {idx+1}: {line.strip()}")
