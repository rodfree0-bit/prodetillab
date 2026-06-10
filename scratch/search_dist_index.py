with open('./dist/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

for term in ['gtechniq', 'adams', 'sonax', 'meguiars', 'rupes', 'carpro', 'logo_']:
    if term in content.lower():
        print(f"dist/index.html: Found {term}")

with open('./dist/blog.html', 'r', encoding='utf-8') as f:
    content_blog = f.read()

for term in ['gtechniq', 'adams', 'sonax', 'meguiars', 'rupes', 'carpro', 'logo_']:
    if term in content_blog.lower():
        print(f"dist/blog.html: Found {term}")
