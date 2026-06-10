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
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        html = response.read().decode('utf-8', errors='ignore')
        # Print first 20 hrefs found
        links = re.findall(r'href="([^"]+)"', html)
        for i, l in enumerate(links):
            print(f"Link {i}: {l}")
except Exception as e:
    print("Error:", e)
