import re

with open("scratch/gtechniq_collection.html", "r", encoding="utf-8", errors="ignore") as f:
    html = f.read()

print("HTML length:", len(html))

# Find all links/src
links = re.findall(r'src="([^"]+)"|href="([^"]+)"', html)
all_links = [l[0] or l[1] for l in links if l[0] or l[1]]
print("Total src/href links:", len(all_links))

print("\nLinks containing 'gtechniq':")
g_links = [l for l in all_links if "gtechniq" in l.lower()]
for l in g_links[:15]:
    print(" -", l)

print("\nLinks containing 'cdn':")
cdn_links = [l for l in all_links if "cdn" in l.lower()]
for l in cdn_links[:15]:
    print(" -", l)

print("\nLinks containing 'logo':")
logo_links = [l for l in all_links if "logo" in l.lower()]
for l in logo_links[:15]:
    print(" -", l)
