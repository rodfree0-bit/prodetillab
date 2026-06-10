with open('./landing/styles.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'brand-section' in line:
        print(f"Line {idx+1}: {line.strip()}")
        # print surrounding lines
        for i in range(max(0, idx-5), min(len(lines), idx+15)):
            print(f"  {i+1}: {lines[i].strip()}")
