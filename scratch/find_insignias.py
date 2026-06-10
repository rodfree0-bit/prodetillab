import os

def find_insignias():
    files = [f for f in os.listdir('./landing') if f.endswith('.html')]
    for file in files:
        path = os.path.join('./landing', file)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        if 'brand-logo' in content or 'logo_gtechniq' in content or 'brand-section' in content:
            print(f"Found brand section in {file}")

find_insignias()
