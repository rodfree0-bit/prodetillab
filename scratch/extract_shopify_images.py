import urllib.request
import urllib.parse
import re
import os
import ssl
import subprocess

ssl._create_default_https_context = ssl._create_unverified_context

print("Starting Shopify CDN logo extractor...")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
}

collections = {
    "gtechniq": "https://carzilla.ca/collections/gtechniq",
    "adams": "https://carzilla.ca/collections/adams-polishes",
    "meguiars": "https://carzilla.ca/collections/meguiars"
}

os.makedirs("landing/assets", exist_ok=True)
os.makedirs("scratch", exist_ok=True)

for brand_name, url in collections.items():
    dest_path = f"landing/assets/logo_{brand_name}.png"
    html_path = f"scratch/{brand_name}_collection.html"
    
    print(f"\nProcessing {brand_name} collection page: {url}")
    
    # Download HTML using curl to bypass potential bot block
    try:
        subprocess.run(["curl.exe", "-L", "-o", html_path, url], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"Downloaded HTML to {html_path}")
    except Exception as e:
        print(f"Failed downloading {url} via curl: {e}")
        continue
        
    if not os.path.exists(html_path):
        print(f"HTML file {html_path} does not exist.")
        continue
        
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
        
    # Find all Shopify CDN links
    # Format typically: //cdn.shopify.com/s/files/...
    cdn_links = re.findall(r'(?:https:)?//cdn\.shopify\.com/s/files/[^\s"\']+', html)
    print(f"Found {len(cdn_links)} Shopify CDN links.")
    
    # Filter for brand name in the link
    brand_links = []
    for link in cdn_links:
        # Clean link
        clean_link = link.split('?')[0] # Remove query parameters
        if not clean_link.startswith('http'):
            clean_link = 'https:' + clean_link
            
        # Check if the clean link contains the brand name and image extensions
        if brand_name in clean_link.lower() and any(ext in clean_link.lower() for ext in ['.png', '.jpg', '.jpeg', '.svg', '.webp']):
            brand_links.append(clean_link)
            
    # De-duplicate
    brand_links = list(set(brand_links))
    print(f"Filtered {len(brand_links)} brand-specific links:")
    for bl in brand_links[:5]:
        print(" -", bl)
        
    # Attempt to download the first working brand link
    success = False
    for img_url in brand_links:
        print(f"Attempting to download logo from: {img_url}")
        try:
            req = urllib.request.Request(img_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                data = response.read()
                if len(data) > 1000:
                    with open(dest_path, 'wb') as f:
                        f.write(data)
                    print(f"✅ Successfully saved {brand_name} logo to {dest_path} ({len(data)} bytes)!")
                    success = True
                    break
        except Exception as e:
            print(f"❌ Failed download: {e}")
            
    if not success:
        print(f"Could not extract logo for {brand_name} from collection page.")

print("\nShopify CDN logo extractor complete.")
