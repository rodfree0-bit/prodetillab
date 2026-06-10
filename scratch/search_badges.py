with open('./landing/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'app-store' in line.lower() or 'play-store' in line.lower() or 'google_play' in line.lower() or 'google play' in line.lower():
        print(f"index.html: Line {idx+1}: {line.strip()}")

print("\n--- FLEET INDEX ---")
with open('./landing/fleet_index.html', 'r', encoding='utf-8') as f:
    lines_fleet = f.readlines()

for idx, line in enumerate(lines_fleet):
    if 'app-store' in line.lower() or 'play-store' in line.lower() or 'google_play' in line.lower() or 'google play' in line.lower():
        print(f"fleet_index.html: Line {idx+1}: {line.strip()}")
