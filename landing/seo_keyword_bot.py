import os
import re
import json
import urllib.request
import urllib.parse
import time
import sys

# Configure standard output to use UTF-8 to prevent terminal errors
sys.stdout.reconfigure(encoding='utf-8')

PROJECT_DIR = r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\landing"
KEYWORDS_OUTPUT_FILE = os.path.join(PROJECT_DIR, "seo_trending_keywords.json")

CITIES = [
    "San Pedro", "Rancho Palos Verdes", "Palos Verdes Estates", "Rolling Hills", "Rolling Hills Estates",
    "Torrance", "Redondo Beach", "Hermosa Beach", "Manhattan Beach", "El Segundo",
    "Westchester", "Playa del Rey", "Marina del Rey", "Venice", "Santa Monica",
    "Pacific Palisades", "Brentwood", "Bel Air", "Beverly Hills", "West Hollywood",
    "Culver City", "Mar Vista", "Palms", "Century City", "Westwood",
    "Hollywood", "Silver Lake", "Echo Park", "Downtown Los Angeles", "Inglewood",
    "Hawthorne", "Gardena", "Lawndale", "Carson", "Lomita",
    "Harbor City", "Wilmington", "Long Beach", "Lakewood", "Signal Hill",
    "Bellflower", "Paramount", "Downey", "South Gate", "Huntington Park",
    "Lynwood", "Compton", "Vernon", "Commerce", "Santa Fe Springs",
    "Alhambra", "Monterey Park", "Whittier", "Montebello", "Norwalk"
]

def slugify(text):
    text = text.lower().replace(" ", "-").replace(".", "")
    text = text.replace("ñ", "n").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    return text

def strip_emojis(text):
    # Regex to remove emojis
    emoji_pattern = re.compile(
        r'[\U00010000-\U0010ffff]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\u2190-\u21FF]'
    )
    return emoji_pattern.sub(r'', text)

def get_google_suggestions(query):
    encoded_query = urllib.parse.quote(query)
    url = f"http://suggestqueries.google.com/complete/search?client=chrome&q={encoded_query}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as response:
            data = response.read().decode('utf-8', errors='ignore')
            json_data = json.loads(data)
            # The second item is the list of suggestions
            if len(json_data) > 1:
                return [strip_emojis(s) for s in json_data[1]]
    except Exception as e:
        print(f"Error fetching suggestions for '{query}': {e}")
    return []

def get_la_county_trends():
    print("Fetching general Los Angeles County core detailing trends...")
    la_queries = [
        "mobile car wash los angeles",
        "car detailing los angeles",
        "ceramic coating los angeles",
        "car wash near me los angeles",
        "mobile auto detailing los angeles",
        "paint correction los angeles",
        "interior car steam cleaning los angeles",
        "rv detailing los angeles"
    ]
    
    raw_services = set()
    for query in la_queries:
        suggestions = get_google_suggestions(query)
        for suggestion in suggestions:
            suggestion = suggestion.strip().lower()
            if suggestion and len(suggestion) > 5:
                # Clean up locations from the suggestions to extract raw services
                cleaned = re.sub(r'\b(los angeles|la|california|ca)\b', '', suggestion)
                cleaned = re.sub(r'\s+', ' ', cleaned).strip()
                if len(cleaned) > 5:
                    raw_services.add(cleaned)
        time.sleep(0.5) # respectful sleep
        
    print(f"Found {len(raw_services)} core detailing search trends in LA County.")
    return sorted(list(raw_services))

def main():
    print("Starting SEO Keyword Scraper Bot (LA County-Wide Trends Version)...")
    
    # 1. Fetch LA County-wide core trends first
    la_trends = get_la_county_trends()
    
    trending_keywords = {}
    
    # Check if existing keywords file exists to preserve fallback values
    if os.path.exists(KEYWORDS_OUTPUT_FILE):
        try:
            with open(KEYWORDS_OUTPUT_FILE, "r", encoding="utf-8") as f:
                trending_keywords = json.load(f)
        except Exception:
            pass

    for i, city in enumerate(CITIES, 1):
        slug = slugify(city)
        print(f"[{i}/{len(CITIES)}] Scraping & localizing keywords for {city} ({slug})...")
        
        # Build search queries specific to this city
        city_queries = [
            f"mobile car wash {slug.replace('-', ' ')}",
            f"car detailing {slug.replace('-', ' ')}",
            f"ceramic coating {slug.replace('-', ' ')}",
            f"car wash near me {slug.replace('-', ' ')}"
        ]
        
        city_keywords = set()
        
        # 2. Get city-specific suggestions
        for query in city_queries:
            suggestions = get_google_suggestions(query)
            for suggestion in suggestions:
                suggestion = suggestion.strip().lower()
                if suggestion and len(suggestion) > 5:
                    suggestion = re.sub(r'\s+', ' ', suggestion)
                    city_keywords.add(suggestion)
            time.sleep(0.4)
            
        # 3. Localize broader LA County-wide trends for this city
        for trend in la_trends:
            # e.g., "paint correction" -> "paint correction torrance"
            localized_trend = f"{trend} {city.lower()}"
            city_keywords.add(localized_trend)

        # 4. Add basic fallbacks in case Google suggestions were sparse
        basic_fallbacks = [
            f"car wash near me {city.lower()}",
            f"mobile car wash {city.lower()} ca",
            f"car detailing {city.lower()}",
            f"best mobile detailing {city.lower()}",
            f"ceramic coating {city.lower()} ca",
            f"interior detailing {city.lower()}",
            f"car polish {city.lower()}"
        ]
        for fallback in basic_fallbacks:
            city_keywords.add(fallback)

        # Convert back to list and sort
        sorted_keywords = sorted(list(city_keywords))
        
        # Limit to top 15 high-value localized keywords to keep page clean
        trending_keywords[slug] = sorted_keywords[:15]
        print(f"  -> Generated {len(trending_keywords[slug])} optimized keywords for {city}")
        
    # Write output to JSON
    with open(KEYWORDS_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(trending_keywords, f, indent=2, ensure_ascii=False)
        
    print(f"\nSuccessfully updated trending keywords file! Saved to: {KEYWORDS_OUTPUT_FILE}")

if __name__ == "__main__":
    main()
