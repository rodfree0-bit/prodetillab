import urllib.request
import urllib.parse
import re
import os
import ssl

# Bypass SSL verify globally
ssl._create_default_https_context = ssl._create_unverified_context

print("Starting robust logo finder script (ASCII version)...")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
}

brands = {
    "gtechniq": {
        "url": "https://gtechniq.com/",
        "search_term": "gtechniq logo png"
    },
    "adams": {
        "url": "https://adamspolishes.com/",
        "search_term": "adams polishes logo png"
    },
    "chemicalguys": {
        "url": "https://www.chemicalguys.com/",
        "search_term": "chemical guys logo png"
    },
    "rupes": {
        "url": "https://www.rupes.com/",
        "search_term": "rupes logo png"
    },
    "carpro": {
        "url": "https://carpro.global/",
        "search_term": "carpro logo png"
    },
    "meguiars": {
        "url": "https://www.meguiars.com/",
        "search_term": "meguiars logo png"
    },
    "sonax": {
        "url": "https://www.sonax.com/",
        "search_term": "sonax logo png"
    }
}

os.makedirs("landing/assets", exist_ok=True)

def search_ddg_images(query):
    print(f"Searching DDG for: {query}")
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
            matches = re.findall(r'//duckduckgo\.com/iu/\?u=([^&"]+)', html)
            urls = []
            for match in matches:
                decoded = urllib.parse.unquote(match)
                urls.append(decoded)
            return urls
    except Exception as e:
        print(f"Error searching DDG: {e}")
        return []

def download_from_url(url, dest_path):
    print(f"Attempting download from: {url}")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read()
            if len(data) > 1000:
                with open(dest_path, 'wb') as f:
                    f.write(data)
                print(f"[SUCCESS] Downloaded to {dest_path} ({len(data)} bytes)!")
                return True
    except Exception as e:
        print(f"[ERROR] Failed downloading {url}: {e}")
    return False

# Try download from Wiki commons for Sonax and CarPro
def download_wikimedia(wiki_file_page, dest_path):
    try:
        print(f"Checking Wikimedia Commons page: {wiki_file_page}")
        req = urllib.request.Request(wiki_file_page, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
            # Look for upload.wikimedia.org link inside the page
            match = re.search(r'href="(https://upload\.wikimedia\.org/wikipedia/commons/[^"]+)"', html)
            if match:
                img_url = match.group(1)
                return download_from_url(img_url, dest_path)
    except Exception as e:
        print(f"Failed to check Wikimedia: {e}")
    return False

# 1. Sonax
if not os.path.exists("landing/assets/logo_sonax.png") or os.path.getsize("landing/assets/logo_sonax.png") < 1000:
    download_wikimedia("https://commons.wikimedia.org/wiki/File:Sonax_logo.svg", "landing/assets/logo_sonax.png")

# 2. Carpro
if not os.path.exists("landing/assets/logo_carpro.png") or os.path.getsize("landing/assets/logo_carpro.png") < 1000:
    download_wikimedia("https://commons.wikimedia.org/wiki/File:CarPro_logo.png", "landing/assets/logo_carpro.png")

# Now loop through all brands and try DDG if not downloaded
for brand_name, info in brands.items():
    dest_path = f"landing/assets/logo_{brand_name}.png"
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 2000:
        print(f"[OK] Brand {brand_name} already exists.")
        continue

    # Try DDG search
    search_results = search_ddg_images(info["search_term"])
    success = False
    
    # Prioritize PNG files or URLs that look like clear brand logos
    prioritized_results = []
    other_results = []
    for r in search_results:
        if "tse" in r or "preview" in r:
            other_results.append(r)
        else:
            prioritized_results.append(r)
            
    all_results = prioritized_results + other_results
    
    for img_url in all_results:
        if any(ext in img_url.lower() for ext in ['.png', '.svg', '.jpg', '.jpeg', '.webp']):
            if download_from_url(img_url, dest_path):
                success = True
                break
                
    if not success:
        # Direct URL backups for the popular detailing brands
        direct_backups = {
            "gtechniq": [
                "https://gtechniq.com/wp-content/themes/gtechniq/assets/img/logo.png",
                "https://gtechniq.com/assets/img/logo.png"
            ],
            "adams": [
                "https://adamspolishes.com/cdn/shop/files/Logo_White_Background_Red_Circle_180x.png",
                "https://cdn.shopify.com/s/files/1/0022/9442/files/logo_adams.png"
            ],
            "meguiars": [
                "https://www.meguiars.com/themes/custom/meguiars/logo.svg",
                "https://www.meguiars.com/themes/custom/meguiars/logo.png"
            ],
            "sonax": [
                "https://www.sonax.com/layout/set/print/extension/sonax/design/sonax/images/logo.png",
                "https://www.sonaxusa.com/skin/frontend/default/sonax/images/logo.png"
            ],
            "carpro": [
                "https://carpro.global/wp-content/uploads/2019/11/logo.png",
                "https://carpro.global/wp-content/themes/carpro/img/logo.png"
            ]
        }
        
        if brand_name in direct_backups:
            for url in direct_backups[brand_name]:
                if download_from_url(url, dest_path):
                    success = True
                    break

print("Robust logo finder script complete.")
