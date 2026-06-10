import os

def find_text_in_file(file_path, text):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        if text.lower() in line.lower():
            print(f"{os.path.basename(file_path)}: Line {idx+1}: {line.strip()}")

find_text_in_file('./landing/index.html', 'Our Work In Action')
find_text_in_file('./landing/fleet_index.html', 'Our Work In Action')
find_text_in_file('./landing/index.html', 'gallery')
