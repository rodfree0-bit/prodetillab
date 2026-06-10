import re

with open('./landing/index.html', 'r', encoding='utf-8') as f:
    content_index = f.read()

with open('./landing/fleet_index.html', 'r', encoding='utf-8') as f:
    content_fleet = f.read()

with open('./landing/blog.html', 'r', encoding='utf-8') as f:
    content_blog = f.read()

car_brands = ['mercedes', 'tesla', 'bmw', 'lexus', 'toyota', 'honda', 'ford', 'gm', 'subaru', 'nissan', 'kia', 'hyundai', 'jaguar', 'chevy', 'jeep']

print("Search results:")
for brand in car_brands:
    if brand in content_index.lower():
        print(f"index.html: Found {brand}")
    if brand in content_fleet.lower():
        print(f"fleet_index.html: Found {brand}")
    if brand in content_blog.lower():
        print(f"blog.html: Found {brand}")
