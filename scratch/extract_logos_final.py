import re
import urllib.request
import os
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
}

downloads = {
    "gtechniq": "https://carzilla.ca/cdn/shop/collections/gtechniq_logo.jpg?v=1567274489&width=480",
    "adams": "https://carzilla.ca/cdn/shop/collections/adams-logo-carzilla.jpg?v=1567032553&width=480",
    "meguiars": "https://carzilla.ca/cdn/shop/collections/logo.jpg?v=1567032865&width=480"
}

os.makedirs("landing/assets", exist_ok=True)

for name, url in downloads.items():
    dest = f"landing/assets/logo_{name}.png"
    print(f"Downloading {name} from {url}...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            with open(dest, "wb") as f:
                f.write(response.read())
        print(f"[SUCCESS] Downloaded {name} logo to {dest}!")
    except Exception as e:
        print(f"[ERROR] Failed to download {name}: {e}")

print("Logo download script finished.")
