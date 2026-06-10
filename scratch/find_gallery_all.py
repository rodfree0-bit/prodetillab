import os

def find_gallery_sections():
    files = [f for f in os.listdir('./landing') if f.endswith('.html')]
    for file in files:
        path = os.path.join('./landing', file)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'id="gallery"' in content or 'class="gallery"' in content or 'Our Work In Action' in content:
            print(f"Found in {file}")

find_gallery_sections()
