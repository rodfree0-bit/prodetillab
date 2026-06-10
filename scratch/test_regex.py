import urllib.request
import urllib.parse
import re
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
}

query = "gtechniq logo png"
url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
print(f"Fetching {url}...")
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        html = response.read().decode('utf-8', errors='ignore')
        # Print a snippet of the HTML to see where the links are
        print("HTML length:", len(html))
        # Look for any matches of "iu/?u="
        matches = re.findall(r'iu/\?u=([^&"]+)', html)
        print("Matches found with 'iu/?u=':", len(matches))
        for m in matches[:5]:
            print("Match:", urllib.parse.unquote(m))
            
        # Let's also look for image URLs directly (e.g. hrefs ending in .png, .jpg)
        img_links = re.findall(r'href="([^"]+\.png[^"]*)"', html, re.IGNORECASE)
        print("Image links ending in .png:", len(img_links))
        for link in img_links[:5]:
            print("PNG Link:", link)
except Exception as e:
    print("Error:", e)
