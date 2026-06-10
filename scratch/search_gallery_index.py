with open('./landing/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'gallery' in line.lower() and not (610 <= idx+1 <= 648):
        print(f"Line {idx+1}: {line.strip()}")
