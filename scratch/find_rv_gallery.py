with open('./landing/rv_detail.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'gallery' in line.lower():
        print(f"Line {idx+1}: {line.strip()}")
