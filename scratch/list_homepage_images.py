import re

with open('./landing/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

imgs = re.findall(r'<img [^>]*src=["\']([^"\']+)["\']', content)
print("Images in index.html:")
for img in set(imgs):
    print(f"  {img}")
