with open('./landing/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

for term in ['.brand-logo', 'brand-logo', '.brand-grid', 'brand-grid', 'brand-section']:
    if term in content:
        print(f"styles.css: Found {term}")
