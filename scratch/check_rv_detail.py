with open('./landing/rv_detail.html', 'r', encoding='utf-8') as f:
    content = f.read()

for term in ['logo_', 'adams', 'gtechniq', 'sonax', 'meguiars', 'rupes', 'carpro', 'brand-logo', 'gallery']:
    if term in content.lower():
        print(f"rv_detail.html: Found {term}")
