with open('./landing/generate_seo_pages.py', 'r', encoding='utf-8') as f:
    content = f.read()

for term in ['logo_', 'adams', 'gtechniq', 'sonax', 'meguiars', 'rupes', 'carpro']:
    if term in content:
        print(f"generate_seo_pages.py: Found {term}")
