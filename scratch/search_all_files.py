import os

root_dir = r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-"
matches = []

for root, dirs, files in os.walk(root_dir):
    if "node_modules" in root or ".git" in root or ".firebase" in root:
        continue
    for file in files:
        file_path = os.path.join(root, file)
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                if "General Guidelines" in content or "Avoid unclosed divs" in content:
                    matches.append((file_path, "General Guidelines" in content, "Avoid unclosed divs" in content))
        except Exception as e:
            pass

print(f"Total matches found: {len(matches)}")
for m in matches:
    print(f"File: {m[0]} | Guidelines: {m[1]} | Unclosed: {m[2]}")
