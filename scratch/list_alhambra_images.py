import re

with open('./landing/alhambra.html', 'r', encoding='utf-8') as f:
    content = f.read()

imgs = re.findall(r'<img [^>]*src=["\']([^"\']+)["\']', content)
print("Images in alhambra.html:")
for img in imgs:
    print(f"  {img}")
