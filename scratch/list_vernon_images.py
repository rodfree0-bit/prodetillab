import re

with open('./landing/vernon.html', 'r', encoding='utf-8') as f:
    content = f.read()

imgs = re.findall(r'<img [^>]*src=["\']([^"\']+)["\']', content)
print("Images in vernon.html:")
for img in imgs:
    print(f"  {img}")
