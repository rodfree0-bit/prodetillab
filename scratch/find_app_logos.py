import os

def search_files(dir_path):
    for root, dirs, files in os.walk(dir_path):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.jsx')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                if 'insignia' in content.lower() or 'car-logo' in content.lower() or 'brand-logo' in content.lower() or 'carbrand' in content.lower():
                    print(f"Found in {path}")

search_files('./components')
search_files('./src')
search_files('.')
