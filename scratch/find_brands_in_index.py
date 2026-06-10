with open('./landing/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

for term in ['gtechniq', 'adams', 'sonax', 'meguiars', 'rupes', 'carpro']:
    if term in content.lower():
        print(f"index.html: Found {term}")

with open('./landing/fleet_index.html', 'r', encoding='utf-8') as f:
    content_fleet = f.read()

for term in ['gtechniq', 'adams', 'sonax', 'meguiars', 'rupes', 'carpro']:
    if term in content_fleet.lower():
        print(f"fleet_index.html: Found {term}")
