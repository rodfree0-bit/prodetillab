with open('./landing/alhambra.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'logo_' in line or 'brand-logo' in line:
        print(f"Line {idx+1}: {line.strip()}")
