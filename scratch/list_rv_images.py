import re

with open('./landing/rv_detail.html', 'r', encoding='utf-8') as f:
    content = f.read()

imgs = re.findall(r'<img [^>]*src=["\']([^"\']+)["\']', content)
print("Images in rv_detail.html:")
for img in imgs:
    print(f"  {img}")
