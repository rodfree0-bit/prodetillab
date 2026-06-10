import os
import re
import json
import hashlib
import math
from datetime import datetime

def strip_emojis(text):
    if not isinstance(text, str):
        return text
    # Regex to remove emojis and other symbols (including checkmarks, stars, etc., that render as emojis)
    emoji_pattern = re.compile(
        r'[\U00010000-\U0010ffff]|[\u2600-\u27BF]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\u2190-\u21FF]'
    )
    return emoji_pattern.sub(r'', text)

# Dynamic variant selectors based on city hash to give unique identity to each page
def get_text_variant(city_name, key, index=0):
    h = int(hashlib.md5(f"{city_name}-{key}-{index}".encode('utf-8')).hexdigest(), 16)
    
    variants = {
        "basic_desc": [
            "A complete interior and exterior refresh featuring tire shine, glass cleaning, panel wipe-down, and a thorough interior vacuuming.",
            "Keep your daily driver clean. Includes hand wash, tire dressing, interior panel cleaning, window wiping, and detailed vacuuming.",
            "Our essential on-the-go maintenance package. Features exterior foam wash, tire dressing, interior vacuuming, and glass cleaning.",
            "The perfect regular upkeep wash. Thorough exterior hand wash, wheel cleaning, window treatment, and complete interior vacuum."
        ],
        "maintenance_desc": [
            "A complete interior and exterior rejuvenation. We go beyond the basics to clean every surface and provide durable paint protection.",
            "Our signature service for daily drivers. Deep interior cleaning, leather conditioning, door jamb detailing, and high-gloss wax sealant.",
            "Deep cleaning and protection inside and out. Rejuvenates dashboard surfaces, conditions seat upholstery, and adds premium wax shield.",
            "Complete detailing to restore your vehicle's gloss and cabin freshness. Deep vacuuming, trim conditioning, and protective paint waxing."
        ],
        "onyx_desc": [
            "The ultimate automotive luxury detailing. A multi-step restoration featuring clay bar paint prep, ceramic sealer, and steam extraction.",
            "Our top-tier rejuvenation service. Includes clay bar paint decontamination, high-hydrophobic ceramic sealant, and interior steam detailing.",
            "Pinnacle restoration for premium vehicles. Deep steam extraction, iron fallout removal, clay treatment, and professional engine bay cleaning.",
            "Showroom-quality detailing at your driveway. Features chemical iron removal, clay bar, steam cleaning of carpets, and a durable ceramic coat."
        ],
        "touchless_desc": [
            "Our contactless wash technique uses premium microfibers and high-lubricity foam to ensure your clear coat remains free of swirls and fine scratches.",
            "Avoid paint damage with our specialized touchless foam wash method. No harsh brushes or dirty sponges touch your vehicle's clear coat.",
            "We protect your paint finish. Our touchless washing process lifts dirt safely using thick foam pre-soak and ultra-soft microfiber mitts.",
            "A scratch-free clean using premium lubricants and soft wash techniques. No abrasive tools are ever used on your paint."
        ],
        "waterless_desc": [
            "Eco-friendly and fully self-contained. Our advanced waterless solution lifts and encapsulates road dust safely without needing a water hook-up.",
            "Perfect for apartment garages and corporate plazas. Our self-contained waterless system safely cleans your car without any water runoff or mess.",
            "Advanced polymer formulas lift and dissolve dirt safely. Ideal for water-restricted areas, condos, and office parking structures.",
            "Eco-friendly car care that doesn't waste water. Our self-contained wash encapsulates dirt and wipes away clean, leaving zero water spots."
        ],
        "step1_desc": [
            "Select your detailing package, choose a convenient date and time slot, and confirm your location in under a minute.",
            "Book in seconds. Choose from our standard packages or add-ons, pick a time, and tell us where your vehicle is parked.",
            "Pick your service and scheduling slot in the app. Setup takes less than 60 seconds from your phone.",
            "Easy booking via our app. Select your detail plan, schedule the time, and input your location. Done!"
        ],
        "step2_desc": [
            "A certified detailing professional arrives at your location fully equipped with power, filtered water, and professional-grade products.",
            "Our detailer comes directly to your driveway or office. Our vans are fully self-contained with power, water, and specialized gear.",
            "We arrive with everything required. Our detail van is self-powered and self-watered, ready to transform your vehicle on-site.",
            "Your assigned detailer arrives on schedule, equipped with premium tools, power supply, and filtered water."
        ],
        "step3_desc": [
            "Relax while we transform your vehicle. Inspect the finished results and pay securely through the app when you are fully satisfied.",
            "Enjoy the showroom shine. Review our detailing work on your driveway, and complete your payment in-app after verification.",
            "Inspect your clean vehicle. When you're 100% happy, complete the booking in-app. Enjoy the fresh ride!",
            "Check out the flawless result. Complete your payment and rate your detailer securely in the app only after you approve."
        ]
    }
    
    pool = variants.get(key, [""])
    return pool[h % len(pool)]


# ============================================================
#   MY CARWASH APP — Enhanced SEO Page Generator
#   Features:
#     • FAQPage JSON-LD (Google rich results)
#     • BreadcrumbList JSON-LD (navigation in SERPs)
#     • OfferCatalog JSON-LD (services with prices)
#     • Multiple reviews per city
#     • Article JSON-LD with daily tip (static, Google-visible)
#     • Static daily tip injected in HTML body
#     • Updated sitemap with today's date
# ============================================================

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

CITY_GEO_ZIP = {
    "San Pedro": {"lat": 33.7361, "lng": -118.2922, "zip": "90731"},
    "Rancho Palos Verdes": {"lat": 33.7445, "lng": -118.3870, "zip": "90275"},
    "Palos Verdes Estates": {"lat": 33.8017, "lng": -118.3976, "zip": "90274"},
    "Rolling Hills": {"lat": 33.7564, "lng": -118.3417, "zip": "90274"},
    "Rolling Hills Estates": {"lat": 33.7878, "lng": -118.3584, "zip": "90274"},
    "Torrance": {"lat": 33.8358, "lng": -118.3406, "zip": "90501"},
    "Redondo Beach": {"lat": 33.8492, "lng": -118.3884, "zip": "90277"},
    "Hermosa Beach": {"lat": 33.8622, "lng": -118.3995, "zip": "90254"},
    "Manhattan Beach": {"lat": 33.8847, "lng": -118.4109, "zip": "90266"},
    "El Segundo": {"lat": 33.9192, "lng": -118.4165, "zip": "90245"},
    "Westchester": {"lat": 33.9575, "lng": -118.3956, "zip": "90045"},
    "Playa del Rey": {"lat": 33.9620, "lng": -118.4412, "zip": "90293"},
    "Marina del Rey": {"lat": 33.9803, "lng": -118.4517, "zip": "90292"},
    "Venice": {"lat": 33.9850, "lng": -118.4695, "zip": "90291"},
    "Santa Monica": {"lat": 34.0194, "lng": -118.4912, "zip": "90401"},
    "Pacific Palisades": {"lat": 34.0481, "lng": -118.5262, "zip": "90272"},
    "Brentwood": {"lat": 34.0521, "lng": -118.4740, "zip": "90049"},
    "Bel Air": {"lat": 34.0837, "lng": -118.4467, "zip": "90077"},
    "Beverly Hills": {"lat": 34.0736, "lng": -118.4004, "zip": "90210"},
    "West Hollywood": {"lat": 34.0900, "lng": -118.3617, "zip": "90069"},
    "Culver City": {"lat": 34.0211, "lng": -118.3965, "zip": "90230"},
    "Mar Vista": {"lat": 34.0041, "lng": -118.4299, "zip": "90066"},
    "Palms": {"lat": 34.0289, "lng": -118.4065, "zip": "90034"},
    "Century City": {"lat": 34.0537, "lng": -118.4134, "zip": "90067"},
    "Westwood": {"lat": 34.0635, "lng": -118.4455, "zip": "90024"},
    "Hollywood": {"lat": 34.0928, "lng": -118.3287, "zip": "90028"},
    "Silver Lake": {"lat": 34.0869, "lng": -118.2702, "zip": "90026"},
    "Echo Park": {"lat": 34.0781, "lng": -118.2606, "zip": "90026"},
    "Downtown Los Angeles": {"lat": 34.0522, "lng": -118.2437, "zip": "90012"},
    "Inglewood": {"lat": 33.9617, "lng": -118.3531, "zip": "90301"},
    "Hawthorne": {"lat": 33.9189, "lng": -118.3484, "zip": "90250"},
    "Gardena": {"lat": 33.8883, "lng": -118.3090, "zip": "90247"},
    "Lawndale": {"lat": 33.8872, "lng": -118.3526, "zip": "90260"},
    "Carson": {"lat": 33.8317, "lng": -118.2817, "zip": "90745"},
    "Lomita": {"lat": 33.8058, "lng": -118.3151, "zip": "90717"},
    "Harbor City": {"lat": 33.7917, "lng": -118.2987, "zip": "90710"},
    "Wilmington": {"lat": 33.7800, "lng": -118.2626, "zip": "90744"},
    "Long Beach": {"lat": 33.7701, "lng": -118.1937, "zip": "90802"},
    "Lakewood": {"lat": 33.8500, "lng": -118.1333, "zip": "90712"},
    "Signal Hill": {"lat": 33.8045, "lng": -118.1678, "zip": "90755"},
    "Bellflower": {"lat": 33.8817, "lng": -118.1170, "zip": "90706"},
    "Paramount": {"lat": 33.8895, "lng": -118.1598, "zip": "90723"},
    "Downey": {"lat": 33.9401, "lng": -118.1331, "zip": "90240"},
    "South Gate": {"lat": 33.9547, "lng": -118.2120, "zip": "90280"},
    "Huntington Park": {"lat": 33.9817, "lng": -118.2251, "zip": "90255"},
    "Lynwood": {"lat": 33.9303, "lng": -118.2115, "zip": "90262"},
    "Compton": {"lat": 33.8958, "lng": -118.2201, "zip": "90220"},
    "Vernon": {"lat": 34.0039, "lng": -118.2301, "zip": "90058"},
    "Commerce": {"lat": 34.0006, "lng": -118.1598, "zip": "90040"},
    "Santa Fe Springs": {"lat": 33.9472, "lng": -118.0842, "zip": "90670"},
    "Alhambra": {"lat": 34.0953, "lng": -118.1270, "zip": "91801"},
    "Monterey Park": {"lat": 34.0625, "lng": -118.1228, "zip": "91754"},
    "Whittier": {"lat": 33.9792, "lng": -118.0308, "zip": "90601"},
    "Montebello": {"lat": 34.0165, "lng": -118.1137, "zip": "90640"},
    "Norwalk": {"lat": 33.9022, "lng": -118.0817, "zip": "90650"}
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_FILE = os.path.join(SCRIPT_DIR, "index.html")
FLEET_TEMPLATE_FILE = os.path.join(SCRIPT_DIR, "fleet_index.html")
OUTPUT_DIR = SCRIPT_DIR
SITEMAP_FILE = os.path.join(SCRIPT_DIR, "sitemap.xml")
METADATA_FILE = os.path.join(SCRIPT_DIR, "seo_metadata.json")
DAILY_BANK_FILE = os.path.join(SCRIPT_DIR, "seo_daily_bank.json")
LOCAL_DATA_FILE = os.path.join(SCRIPT_DIR, "seo_local_data.json")

with open(METADATA_FILE, "r", encoding="utf-8") as f:
    SEO_DATA = json.load(f)

# Load the daily tips bank
with open(DAILY_BANK_FILE, "r", encoding="utf-8") as f:
    DAILY_BANK = json.load(f)

# Load hyper-local city data
with open(LOCAL_DATA_FILE, "r", encoding="utf-8") as f:
    LOCAL_DATA = json.load(f)

# Load the trending keywords scraped by seo_keyword_bot.py
TRENDING_KEYWORDS_FILE = os.path.join(SCRIPT_DIR, "seo_trending_keywords.json")
TRENDING_KEYWORDS = {}
if os.path.exists(TRENDING_KEYWORDS_FILE):
    try:
        with open(TRENDING_KEYWORDS_FILE, "r", encoding="utf-8") as f:
            TRENDING_KEYWORDS = json.load(f)
    except Exception as e:
        print(f"Error loading trending keywords: {e}")

# Build a lookup dict by dayId for fast access
TIPS_BY_DAY = {tip["dayId"]: tip for tip in DAILY_BANK}

# Calculate today's tip
now = datetime.now()
start_of_year = datetime(now.year, 1, 1)
day_of_year = (now - start_of_year).days + 1
total_tips = len(DAILY_BANK)
today_tip_index = ((day_of_year - 1) % total_tips) + 1
TODAY_TIP = TIPS_BY_DAY.get(today_tip_index, DAILY_BANK[0])
TODAY_DATE = now.strftime("%Y-%m-%d")

FLEET_CITIES = ["Vernon", "Commerce", "Santa Fe Springs", "Wilmington", "Harbor City"]

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

with open(TEMPLATE_FILE, "r", encoding="utf-8") as f:
    standard_template = f.read()

with open(FLEET_TEMPLATE_FILE, "r", encoding="utf-8") as f:
    fleet_template = f.read()

CLUSTERS = {
    "south_bay": ["San Pedro", "Rancho Palos Verdes", "Palos Verdes Estates", "Rolling Hills", "Rolling Hills Estates", "Torrance", "Redondo Beach", "Hermosa Beach", "Manhattan Beach", "El Segundo", "Carson", "Lomita", "Harbor City", "Wilmington", "Long Beach", "Lakewood", "Signal Hill"],
    "westside": ["Westchester", "Playa del Rey", "Marina del Rey", "Venice", "Santa Monica", "Pacific Palisades", "Brentwood", "Bel Air", "Beverly Hills", "West Hollywood", "Culver City", "Mar Vista", "Palms", "Century City", "Westwood"],
    "central_east": ["Hollywood", "Silver Lake", "Echo Park", "Downtown Los Angeles", "Inglewood", "Hawthorne", "Gardena", "Lawndale", "Bellflower", "Paramount", "Downey", "South Gate", "Huntington Park", "Lynwood", "Compton", "Vernon", "Commerce", "Santa Fe Springs", "Alhambra", "Monterey Park", "Whittier", "Montebello", "Norwalk"]
}

LOCAL_STREETS = {
    "santa-monica": ["Montana Ave", "Ocean Ave", "Wilshire Blvd"],
    "beverly-hills": ["Rodeo Drive", "Sunset Blvd", "Canon Drive"],
    "torrance": ["Hawthorne Blvd", "Crenshaw Blvd", "Sepulveda Blvd"],
    "redondo-beach": ["Esplanade", "Pacific Coast Hwy", "Catalina Ave"],
    "manhattan-beach": ["Highland Ave", "Manhattan Beach Blvd", "Rosecrans Ave"],
    "hermosa-beach": ["Hermosa Ave", "Pier Ave", "Valley Dr"],
    "el-segundo": ["Main St", "Grand Ave", "Sepulveda Blvd"],
    "san-pedro": ["Gaffey St", "Western Ave", "Pacific Ave"],
    "gardena": ["Redondo Beach Blvd", "Gardena Blvd", "Western Ave"],
    "hawthorne": ["Hawthorne Blvd", "El Segundo Blvd", "Rosecrans Ave"],
    "carson": ["Carson St", "Avalon Blvd", "Del Amo Blvd"],
    "long-beach": ["Ocean Blvd", "Pine Ave", "Second St"],
    "culver-city": ["Washington Blvd", "Culver Blvd", "Venice Blvd"],
    "venice": ["Abbot Kinney Blvd", "Rose Ave", "Lincoln Blvd"],
    "playa-del-rey": ["Culver Blvd", "Vista del Mar", "Pershing Dr"],
    "marina-del-rey": ["Admiralty Way", "Via Marina", "Washington Blvd"],
    "westchester": ["Sepulveda Blvd", "Manchester Ave", "Lincoln Blvd"],
    "brentwood": ["San Vicente Blvd", "Sunset Blvd", "Barrington Ave"],
    "bel-air": ["Stone Canyon Rd", "Bel Air Rd", "Beverly Glen Blvd"],
    "west-hollywood": ["Santa Monica Blvd", "Sunset Strip", "Melrose Ave"],
    "hollywood": ["Hollywood Blvd", "Sunset Blvd", "Melrose Ave"],
    "downtown-los-angeles": ["Grand Ave", "Figueroa St", "Hope St"],
    "norwalk": ["Norwalk Blvd", "Pioneer Blvd", "Firestone Blvd"]
}

STANDARD_JOBS = [
    {"service": "Full Interior Detailing", "car": "Tesla Model Y", "description": "Deep cleaning of upholstery, coffee stain removal, and sanitizing steam wash.", "ago": "2 days ago"},
    {"service": "Ceramic Coating & Polish", "car": "Porsche Macan", "description": "Removal of swirls and application of high UV-resistant ceramic sealing.", "ago": "4 days ago"},
    {"service": "Premium Wash & Vacuum", "car": "Jeep Wrangler", "description": "Exterior wash with Snowy Foam cannon, wheel detailing, and meticulous interior vacuuming.", "ago": "Yesterday"}
]

FLEET_JOBS = [
    {"service": "Commercial Fleet Wash", "car": "Semi-Truck & Trailer (5 Units)", "description": "Scale removal, high-pressure chassis degreasing, and aluminum tank polishing.", "ago": "3 days ago"},
    {"service": "Commercial Cabin Sanitizing", "car": "Sprinter Delivery Vans", "description": "Deep cleaning of console, driver seats, and sanitizing of rear cargo cabin.", "ago": "Yesterday"},
    {"service": "Heavy-Duty Showroom Detail", "car": "Hino Box Truck", "description": "Restoration of sun-faded plastics, chrome wheel polishing, and protective waxing.", "ago": "5 days ago"}
]

# ---- FAQ templates per city type ----
STANDARD_FAQS = [
    {
        "q": "How much does a premium mobile detail cost in {city}?",
        "a": "Our premium mobile detailing app services in {city} start at $50 for a Super Wash, $200+ for a Deep Interior Detail, and $350+ for our Showroom Full Detail package. All prices are transparent and shown in the app before you book."
    },
    {
        "q": "Do you need water or power access for a mobile detail in {city}?",
        "a": "No! Our detailing vans are 100% self-contained and autonomous. We carry our own clean water tanks and quiet power generators, allowing us to detail your car anywhere in {city} without needing to plug into your water or electricity. Additionally, our premium detailing app matches you with certified, background-checked detailers with $1M liability insurance for your absolute peace of mind."
    },
    {
        "q": "Do you offer ceramic coating in {city}?",
        "a": "Yes! We offer professional ceramic coating services in {city} including 3-5 year long-lasting ceramic coating, 1-year ceramic coating, ceramic rim coating, and ceramic window coating. All performed at your location."
    },
    {
        "q": "How long does a mobile car detail take in {city}?",
        "a": "A Super Wash takes about 1.5 hours, a Deep Interior Detail takes 2.5 hours, and our Showroom Full Detail takes 5+ hours. We work at your location so you can go about your day while we work."
    },
    {
        "q": "Do you offer ceramic coating in {city}?",
        "a": "Yes! We offer professional ceramic coating services in {city} including 3-5 year long-lasting ceramic coating, 1-year ceramic coating, ceramic rim coating, and ceramic window coating. All performed at your location."
    }
]

FLEET_FAQS = [
    {
        "q": "Do you offer commercial fleet detailing in {city}?",
        "a": "Yes! We specialize in commercial fleet detailing in {city} for semi-trucks, box trucks, cargo vans, and Sprinters. We offer on-site service at your yard or depot on your schedule."
    },
    {
        "q": "How do I get a quote for fleet washing in {city}?",
        "a": "Fill out our fleet quote form on this page or call us directly at (310) 340-3489. We offer custom volume pricing for {city} businesses with 2 or more vehicles."
    },
    {
        "q": "Can you detail trucks at our yard in {city}?",
        "a": "Absolutely. Our fully self-contained mobile fleet service comes to your {city} location — yard, depot, or parking lot. No water hookup required."
    }
]

# ---- Multi-review pools ----
REVIEWS_POOL_A = [
    ("Sarah M.", "Best mobile detailing in {city}! They arrived right on time and did an incredible job on my Tesla's interior. 5 stars!"),
    ("David K.", "First time booking in {city} — super easy to use the app. The crew was professional and the car looked showroom-fresh."),
    ("Jessica T.", "Meticulous team! They removed all the dog hair and water spots right here in {city}. Very satisfied customer."),
    ("Michael R.", "Premium service at my driveway in {city}. The ceramic coating made my car shine like new."),
    ("Amanda L.", "Excellent mobile service in {city}. Very professional and the ceramic coating turned out perfect."),
    ("Robert P.", "The most convenient mobile wash in {city}. Booked in 30 seconds and they came to my office parking lot."),
    ("Ashley B.", "Incredible attention to detail in {city}. The interior steam cleaning was next level — no smell, no stains."),
    ("James G.", "Professional and on time in {city}. The exterior foam wash left zero swirls. Highly recommend!")
]

REVIEWS_POOL_B = [
    ("Carlos V.", "Amazing mobile detail in {city}. Quick booking through the app and the result exceeded my expectations."),
    ("Linda W.", "They came to my apartment complex in {city}. No water hookup needed — they're completely self-contained. Very impressed."),
    ("Marcus T.", "The team in {city} was thorough and respectful of my property. Ceramic coating looks incredible."),
    ("Jennifer R.", "Best investment for my car. Regular detailing in {city} has kept my 2022 SUV looking brand new."),
    ("Daniel S.", "Fast booking, professional crew, spotless result in {city}. Worth every penny.")
]


def slugify(text):
    text = text.lower().replace(" ", "").replace(".", "")
    text = text.replace("ñ", "n").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    return text

def slugify_hyphen(text):
    text = text.lower().replace(" ", "-").replace(".", "")
    text = text.replace("ñ", "n").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    return text


def get_cluster_links(city):
    for name, list_of_cities in CLUSTERS.items():
        if city in list_of_cities:
            others = [c for c in list_of_cities if c != city]
            h = int(hashlib.md5(city.encode('utf-8')).hexdigest(), 16)
            selected = []
            for i in range(min(4, len(others))):
                idx = (h + i) % len(others)
                selected.append(others[idx])
                others.pop(idx)
            return selected
    return []


def get_closest_neighbors(city_name, count=3):
    if city_name not in CITY_GEO_ZIP:
        return []
    target = CITY_GEO_ZIP[city_name]
    lat1, lng1 = target["lat"], target["lng"]
    distances = []
    for name, coords in CITY_GEO_ZIP.items():
        if name == city_name:
            continue
        lat2, lng2 = coords["lat"], coords["lng"]
        dist = math.sqrt((lat1 - lat2)**2 + (lng1 - lng2)**2)
        distances.append((name, dist))
    distances.sort(key=lambda x: x[1])
    return [x[0] for x in distances[:count]]


def get_localized_replacements(city_name, is_fleet):
    h = int(hashlib.md5(city_name.encode('utf-8')).hexdigest(), 16)
    neighbors = get_closest_neighbors(city_name, count=3)
    if len(neighbors) >= 3:
        neighbors_str = f"{neighbors[0]}, {neighbors[1]}, and {neighbors[2]}"
    else:
        neighbors_str = "surrounding areas"

    replacements = {}
    
    if not is_fleet:
        # Standard replacements
        # 1. Hero Title
        replacements["hero_title"] = f'<h1 class="hero-title">Premium <span class="gradient-text">Mobile Detailing App</span><br><span style="font-size: 0.6em; font-weight: 400; opacity: 0.9; display: block; margin-top: 0.5rem;">Premium Detailing in {city_name}</span></h1>'

        # 2. Hero Subtitle
        hero_subtitles = [
            f"Looking for a <strong>premium mobile detailing app near {city_name}</strong>? Pro Detail Lab is the elite on-demand detailing app that brings showroom-quality care directly to your driveway. <strong>Download our app to book in seconds</strong>!",
            f"Enjoy luxury car care at your fingertips with our <strong>premium mobile detailing app in {city_name}</strong>. Get showroom-quality washes, clay bar, and ceramic coating at your home or office. <strong>Download our app to get started</strong>!",
            f"Pro Detail Lab is the #1 <strong>premium on-demand detailing app serving {city_name}</strong>. Get showroom-quality detailing results delivered directly to your home or workplace. <strong>Download our app and book today</strong>!",
            f"Experience the ultimate convenience with our <strong>premium mobile detailing app near {city_name}</strong> (also serving {neighbors_str}). Elite professional detailing brought directly to you. <strong>Download our app and save 20% on your first detail</strong>!"
        ]
        replacements["hero_subtitle"] = hero_subtitles[h % len(hero_subtitles)]

        # 3. Why Us
        why_us_variants = [
            f"""<div class="section-header">
                <div class="section-tag">Why Pro Detail Lab</div>
                <h2>The Standard, <span class="gradient-text">Redefined in {city_name}</span></h2>
                <p>We do not just wash cars — we protect your vehicle from the elements and deliver a luxury detailing experience at your {city_name} location or in nearby {neighbors[0] if len(neighbors) > 0 else 'surrounding areas'}.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">Why Pro Detail Lab</div>
                <h2>Elite Mobile Detailing for <span class="gradient-text">{city_name} Owners</span></h2>
                <p>From family SUVs in {city_name} to luxury vehicles in {neighbors[1] if len(neighbors) > 1 else 'surrounding areas'}, we bring professional-grade detailing tools and eco-friendly products directly to you.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">Why Pro Detail Lab</div>
                <h2>Why Choose Us in <span class="gradient-text">{city_name}, CA</span></h2>
                <p>Convenience meets premium craftsmanship. Our mobile detailers cover the entire {city_name} area and adjacent towns like {neighbors[2] if len(neighbors) > 2 else 'surrounding areas'}, offering unmatched convenience.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">Why Pro Detail Lab</div>
                <h2>Redefining Car Care <span class="gradient-text">Near {city_name}</span></h2>
                <p>Experience a showroom finish without leaving your home. We serve residential driveways and corporate plazas across {city_name} and neighboring communities.</p>
            </div>"""
        ]
        replacements["why_us"] = why_us_variants[h % len(why_us_variants)]

        # 4. How It Works
        how_it_works_variants = [
            f"""<div class="section-header">
                <div class="section-tag">The Process</div>
                <h2>Seamless From <span class="gradient-text">Start to Shine in {city_name}</span></h2>
                <p>Booking a premium detail near you in {city_name} or nearby {neighbors[0] if len(neighbors) > 0 else 'surrounding areas'} has never been this effortless.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">The Process</div>
                <h2>Three Steps to a <span class="gradient-text">Spotless Vehicle</span> in {city_name}</h2>
                <p>Save hours of your day. Our seamless mobile service brings elite car care to your home or office in {city_name}.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">The Process</div>
                <h2>How We Detail in <span class="gradient-text">{city_name} &amp; Surrounding Areas</span></h2>
                <p>Our step-by-step mobile process is designed for maximum convenience and premium results for {city_name} residents.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">The Process</div>
                <h2>Effortless Detailing <span class="gradient-text">At Your Doorstep</span> in {city_name}</h2>
                <p>Get your vehicle detailed while you work or relax. We make car care simple and stress-free throughout {city_name}.</p>
            </div>"""
        ]
        replacements["how_it_works"] = how_it_works_variants[h % len(how_it_works_variants)]

        # 6. Add-ons
        addons_variants = [
            f"""<div class="section-header">
                    <div class="section-tag section-tag-gold">Detailing Upgrades</div>
                    <h2>Premium <span class="gradient-text-gold">Add-ons in {city_name}</span></h2>
                    <p>Customize your car care in {city_name} with our high-end detailing upgrades. Add paint correction, window coatings, or clay treatment to any standard package.</p>
                </div>""",
            f"""<div class="section-header">
                    <div class="section-tag section-tag-gold">Detailing Upgrades</div>
                    <h2>Detailing Upgrades for <span class="gradient-text-gold">{city_name} Vehicles</span></h2>
                    <p>Looking for extra shine in {city_name} or nearby {neighbors[0] if len(neighbors) > 0 else 'surrounding areas'}? Enhance your car detailing plan with ceramic wheel coatings, leather treatment, or engine bay cleaning.</p>
                </div>""",
            f"""<div class="section-header">
                    <div class="section-tag section-tag-gold">Detailing Upgrades</div>
                    <h2>Enhance Your Detail in <span class="gradient-text-gold">{city_name}, CA</span></h2>
                    <p>Protect every surface of your car. Choose from our specialized add-on services, including headlights restoration, seat shampooing, and long-term ceramic coatings.</p>
                </div>""",
            f"""<div class="section-header">
                    <div class="section-tag section-tag-gold">Detailing Upgrades</div>
                    <h2>Custom Detailing Upgrades <span class="gradient-text-gold">Near {city_name}</span></h2>
                    <p>Add tailored services to your wash package. We offer professional water spot removal, headliner cleaning, and leather ceramic protection at your location in {city_name}.</p>
                </div>"""
        ]
        replacements["addons"] = addons_variants[h % len(addons_variants)]

    else:
        # Fleet replacements
        # 1. Fleet Hero Title
        fleet_hero_titles = [
            f"""<h1 class="hero-title">
                    Professional <span class="gradient-text-gold">Truck &amp; Fleet Detailing</span> 
                    <br><span style="font-size: 0.6em; font-weight: 400; opacity: 0.9; display: block; margin-top: 0.5rem;">On-Site Service in {city_name}</span>
                </h1>""",
            f"""<h1 class="hero-title">
                    Heavy-Duty <span class="gradient-text-gold">Commercial Fleet Wash</span> 
                    <br><span style="font-size: 0.6em; font-weight: 400; opacity: 0.9; display: block; margin-top: 0.5rem;">Mobile Truck Detailing in {city_name}, CA</span>
                </h1>""",
            f"""<h1 class="hero-title">
                    Top-Rated <span class="gradient-text-gold">Mobile Fleet Detailing</span> 
                    <br><span style="font-size: 0.6em; font-weight: 400; opacity: 0.9; display: block; margin-top: 0.5rem;">On-Site Fleet Wash near {city_name}</span>
                </h1>""",
            f"""<h1 class="hero-title">
                    Premium <span class="gradient-text-gold">Truck Detailing &amp; Wash</span> 
                    <br><span style="font-size: 0.6em; font-weight: 400; opacity: 0.9; display: block; margin-top: 0.5rem;">Mobile Commercial Detailing in {city_name}</span>
                </h1>"""
        ]
        replacements["fleet_hero_title"] = fleet_hero_titles[h % len(fleet_hero_titles)]

        # 2. Fleet Hero Subtitle
        fleet_hero_subtitles = [
            f"""<p class="hero-subtitle">
                    Looking for professional <strong>fleet detailing in {city_name}</strong> or surrounding industrial zones like {neighbors_str}? We specialize in semi-trucks, box trucks, and commercial vans at your yard. Book a custom quote!
                </p>""",
            f"""<p class="hero-subtitle">
                    Need high-pressure <strong>commercial vehicle wash services in {city_name}</strong> and adjacent areas including {neighbors_str}? Our mobile units are fully self-contained.
                </p>""",
            f"""<p class="hero-subtitle">
                    The leading provider of <strong>heavy truck detailing in {city_name}</strong> and neighboring communities like {neighbors_str}. Keep your business image spotless with our on-site commercial care.
                </p>""",
            f"""<p class="hero-subtitle">
                    Expert on-site mobile fleet washing across <strong>{city_name}</strong> and neighboring areas like {neighbors_str}. Serving commercial fleets, cargo vans, and heavy rigs with volume discounts.
                </p>"""
        ]
        replacements["fleet_hero_subtitle"] = fleet_hero_subtitles[h % len(fleet_hero_subtitles)]

        # 3. Fleet Services
        fleet_services_variants = [
            f"""<div class="section-header">
                <div class="section-tag">Commercial Expertise</div>
                <h2>Specialized <span class="gradient-text-gold">Fleet Packages in {city_name}</span></h2>
                <p>Heavy-duty detailing requires specialized mobile equipment. We are the experts {city_name} businesses trust for commercial wash schedules.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">Commercial Expertise</div>
                <h2>Commercial Fleet Washing for <span class="gradient-text-gold">{city_name} Businesses</span></h2>
                <p>Scale your business image in {city_name} and neighboring {neighbors[0] if len(neighbors) > 0 else 'surrounding areas'}. Our certified technicians deliver showroom-level fleet results on-site.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">Commercial Expertise</div>
                <h2>On-Site Truck Detailing near <span class="gradient-text-gold">{city_name}, CA</span></h2>
                <p>Keep your commercial vehicles spotless and your drivers proud. We offer on-site maintenance cycles for company fleets throughout the {city_name} area.</p>
            </div>""",
            f"""<div class="section-header">
                <div class="section-tag">Commercial Expertise</div>
                <h2>Mobile Fleet Wash &amp; Detailing <span class="gradient-text-gold">Near {city_name}</span></h2>
                <p>Reliable, self-powered fleet care at your depot or parking yard. Proudly serving industrial operators in {city_name} and adjacent communities.</p>
            </div>"""
        ]
        replacements["fleet_services"] = fleet_services_variants[h % len(fleet_services_variants)]

    return replacements


def generate_jobs_html(city, slug, is_fleet):
    streets = LOCAL_STREETS.get(slugify_hyphen(city), ["Main St", "Broadway", "Grand Ave"])
    
    # We will generate dynamic jobs to make sure each city is completely unique!
    h = int(hashlib.md5(slug.encode('utf-8')).hexdigest(), 16)
    
    cars_pool = [
        "Tesla Model Y", "Tesla Model 3", "Porsche Macan", "Jeep Wrangler", "BMW 3 Series", 
        "Mercedes E-Class", "Audi Q5", "Lexus RX", "Range Rover Sport", "Porsche 911", 
        "Ford F-150", "Toyota RAV4", "Honda Civic", "Chevrolet Tahoe", "Tesla Cybertruck"
    ]
    fleet_cars_pool = [
        "Semi-Truck & Trailer", "Sprinter Delivery Van", "Hino Box Truck", "Ford Transit Van",
        "Chevrolet Express Fleet", "Commercial Delivery Fleet", "Utility Service Truck"
    ]
    
    services_pool = [
        "Super Wash",
        "Deep Interior Detail",
        "Showroom Full Detail"
    ]
    fleet_services_pool = [
        "Semi-Truck Detailing",
        "Luxury RV Maintenance",
        "Commercial Fleet Care"
    ]
    
    # Specific reviews pool mapping to each service type
    reviews_classic = [
        "The best mobile wash I've used. Meticulous exterior hand wash and the interior vacuuming was very thorough. Highly recommended!",
        "Very convenient. They arrived right at my driveway and left my daily driver looking clean and fresh in about an hour.",
        "Excellent standard cleaning. Tires are shiny, windows are streak-free, and they blew out all the dust from the dashboard vents."
    ]
    reviews_interior = [
        "They did an incredible job extracting years of stains and pet hair from my seats. The interior looks and smells like a brand new car.",
        "My leather seats were deeply cleaned and conditioned perfectly. Meticulous scrub of the door panels and dashboard. Worth every penny.",
        "Highly professional steam cleaning of the carpets and seat shampooing. They removed tough coffee stains that I thought were permanent."
    ]
    reviews_showroom = [
        "Absolute showroom transformation! The clay bar paint decontamination and high-gloss wax made my car shine like a mirror.",
        "Meticulous work on both interior steam cleaning and exterior waxing. Rims are spotless and the paint is incredibly smooth.",
        "They spent over 5 hours detailing my car. Paint decontamination, trim restoration, and a complete deep interior refresh. Stellar service!"
    ]

    fleet_reviews_semi = [
        "Outstanding on-site truck detailing. The chrome and aluminum tank polishing are flawless and the cabin is thoroughly sanitized.",
        "Professional heavy-duty cleaning at our yard. They removed all road grime, scale, and grease from the chassis and cab."
    ]
    fleet_reviews_rv = [
        "Excellent exterior wash and UV protective sealant for our motorhome. Roof cleaning and seal rejuvenation were done wave-free.",
        "Perfect gelcoat shine restoration. They removed all the oxidation and bugs from the front hood. Looks fantastic."
    ]
    fleet_reviews_fleet = [
        "Very reliable fleet service. They clean our cargo vans on a regular schedule at our depot. Centralized billing makes it very easy.",
        "Great volume pricing. They detailed 5 of our Sprinter vans in a single afternoon. Keeps our business image spotless."
    ]
    
    times_pool = ["Yesterday", "2 days ago", "3 days ago", "4 days ago", "5 days ago", "Last week"]
    
    html_cards = []
    
    for i in range(3):
        # Determine job details using city hash and index to guarantee uniqueness yet consistency for the city
        idx = (h + i)
        
        if is_fleet:
            car = fleet_cars_pool[idx % len(fleet_cars_pool)]
            service = fleet_services_pool[i]
            
            # Map index to specific B2B reviews pool
            if i == 0:
                review_text = fleet_reviews_semi[idx % len(fleet_reviews_semi)]
            elif i == 1:
                review_text = fleet_reviews_rv[idx % len(fleet_reviews_rv)]
            else:
                review_text = fleet_reviews_fleet[idx % len(fleet_reviews_fleet)]
                
            color = "#eab308"
        else:
            car = cars_pool[idx % len(cars_pool)]
            service = services_pool[i]
            
            # Map index to specific client reviews pool
            if i == 0:
                review_text = reviews_classic[idx % len(reviews_classic)]
            elif i == 1:
                review_text = reviews_interior[idx % len(reviews_interior)]
            else:
                review_text = reviews_showroom[idx % len(reviews_showroom)]
                
            color = "#1e40af"
            
        street = streets[i % len(streets)]
        ago = times_pool[idx % len(times_pool)]
        
        # Clean any emojis just in case
        car = strip_emojis(car)
        service = strip_emojis(service)
        review_text = strip_emojis(review_text)
        street = strip_emojis(street)
        
        card = f"""
                <div class="job-card" style="background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 1.5rem; text-align: left; transition: transform 0.3s ease, border-color 0.3s ease;" onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='{color}';" onmouseout="this.style.transform='none'; this.style.borderColor='rgba(255,255,255,0.05)';">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <span style="font-size: 0.8rem; font-weight: 800; color: {color}; text-transform: uppercase; letter-spacing: 0.05em;">{service}</span>
                        <span style="font-size: 0.75rem; color: #94a3b8;">{ago}</span>
                    </div>
                    <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem; color: #fff; font-family: 'Outfit', sans-serif;">{car}</h3>
                    <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.4; margin-bottom: 1rem;">"{review_text}" <span style="display:block;margin-top:0.5rem;font-size:0.75rem;color:#64748b;">(Service performed at <strong>{street}, {city}</strong>)</span></p>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="display: flex; color: #fbbf24;">
                            <span class="material-symbols-outlined" style="font-size: 1.1rem; font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined" style="font-size: 1.1rem; font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined" style="font-size: 1.1rem; font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined" style="font-size: 1.1rem; font-variation-settings: 'FILL' 1;">star</span>
                            <span class="material-symbols-outlined" style="font-size: 1.1rem; font-variation-settings: 'FILL' 1;">star</span>
                        </div>
                        <span style="font-size: 0.8rem; color: #34d399; font-weight: 700;">Verified Client</span>
                    </div>
                </div>"""
        html_cards.append(card)

    neighbors = get_cluster_links(city)
    neighbors_html = ""
    if neighbors:
        links_list = []
        for n in neighbors:
            n_slug = slugify(n)
            color = "#eab308" if is_fleet else "#1e40af"
            links_list.append(f'<a href="../{n_slug}" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 10px; font-size: 0.8rem; color: #94a3b8; text-decoration: none; transition: all 0.2s;" onmouseover="this.style.borderColor=\'{color}\'; this.style.color=\'#fff\';" onmouseout="this.style.borderColor=\'rgba(255,255,255,0.05)\'; this.style.color=\'#94a3b8\';">{n}</a>')
        neighbors_html = f"""
                <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); width: 100%; text-align: center; grid-column: 1 / -1;">
                    <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 1rem; font-weight: 600;">We also provide service in nearby areas:</p>
                    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
                        {"".join(links_list)}
                    </div>
                </div>"""

    return "".join(html_cards) + neighbors_html


def generate_rich_jsonld(city, slug, canonical, geo_data, rating_count, rating_val,
                         reviewer_a, review_body_a, reviewer_b, review_body_b,
                         zip_code, is_fleet, tip_title, tip_content, tip_date):
    """Generate all JSON-LD schemas as a combined array."""

    # Pick FAQs for this city
    faq_pool = FLEET_FAQS if is_fleet else STANDARD_FAQS
    h = int(hashlib.md5(slug.encode('utf-8')).hexdigest(), 16)
    selected_faqs = [faq_pool[i % len(faq_pool)] for i in range(min(3, len(faq_pool)))]

    faq_items = []
    for faq in selected_faqs:
        q = faq["q"].replace("{city}", city)
        a = faq["a"].replace("{city}", city)
        faq_items.append(f'''    {{
      "@type": "Question",
      "name": "{q}",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "{a}"
      }}
    }}''')

    # Offer catalog (only for standard cities)
    offer_catalog = ""
    if not is_fleet:
        offer_catalog = f''',
    "hasOfferCatalog": {{
      "@type": "OfferCatalog",
      "name": "Mobile Car Wash & Detailing Services in {city}",
      "itemListElement": [
        {{
          "@type": "Offer",
          "itemOffered": {{
            "@type": "Service",
            "name": "Super Wash",
            "description": "Complete interior and exterior refresh featuring vacuuming, window cleaning, door jambs detailing, tire shine, and compressed air interior blowout in {city}."
          }},
          "price": "50",
          "priceCurrency": "USD",
          "priceSpecification": {{
            "@type": "PriceSpecification",
            "minPrice": "50",
            "priceCurrency": "USD"
          }}
        }},
        {{
          "@type": "Offer",
          "itemOffered": {{
            "@type": "Service",
            "name": "Deep Interior Detail",
            "description": "Only interior deep cleaning. Deep seat, carpet, door panels, and dashboard scrub, floor mats wash, and premium leather/plastic conditioning. No exterior wash included in {city}."
          }},
          "price": "200",
          "priceCurrency": "USD",
          "priceSpecification": {{
            "@type": "PriceSpecification",
            "minPrice": "200",
            "priceCurrency": "USD"
          }}
        }},
        {{
          "@type": "Offer",
          "itemOffered": {{
            "@type": "Service",
            "name": "Showroom Full Detail",
            "description": "Complete interior deep clean combined with exterior clay bar, premium 3-month ceramic paint sealant protection, tire and wheel detailing, and plastic trim restoration in {city}."
          }},
          "price": "350",
          "priceCurrency": "USD",
          "priceSpecification": {{
            "@type": "PriceSpecification",
            "minPrice": "350",
            "priceCurrency": "USD"
          }}
        }},
        {{
          "@type": "Offer",
          "itemOffered": {{
            "@type": "Service",
            "name": "Ceramic Coating (3-5 Year)",
            "description": "Professional nano-ceramic paint protection in {city} with 3-5 year durability."
          }},
          "price": "399",
          "priceCurrency": "USD"
        }}
      ]
    }}'''

    business_type = "AutomotiveBusiness" if is_fleet else "AutoWash"

    schema = f'''[
  {{
    "@context": "https://schema.org",
    "@type": "{business_type}",
    "name": "Pro Detail Lab - {city}",
    "image": "https://prodetaillab.com/logo.webp",
    "@id": "{canonical}#localbusiness",
    "url": "{canonical}",
    "telephone": "+1-310-340-3489",
    "priceRange": "$$",
    "address": {{
      "@type": "PostalAddress",
      "streetAddress": "Mobile Service",
      "addressLocality": "{city}",
      "postalCode": "{zip_code}",
      "addressRegion": "CA",
      "addressCountry": "US"
    }},
    "geo": {{
      "@type": "GeoCoordinates",
      "latitude": {geo_data["lat"]},
      "longitude": {geo_data["lng"]}
    }},
    "areaServed": "{city}",
    "openingHoursSpecification": {{
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      "opens": "08:00",
      "closes": "20:00"
    }},
    "sameAs": [
      "https://www.facebook.com/ProDetailLab/",
      "https://www.instagram.com/?hl=en",
      "https://www.tiktok.com/@prodetaillab",
      "https://share.google/mZYgH6vtRYmLT42wI"
    ],
    "aggregateRating": {{
      "@type": "AggregateRating",
      "ratingValue": "{rating_val}",
      "reviewCount": "{rating_count}"
    }},
    "review": [
      {{
        "@type": "Review",
        "author": {{
          "@type": "Person",
          "name": "{reviewer_a}"
        }},
        "reviewBody": "{review_body_a}",
        "reviewRating": {{
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        }},
        "datePublished": "{tip_date}"
      }},
      {{
        "@type": "Review",
        "author": {{
          "@type": "Person",
          "name": "{reviewer_b}"
        }},
        "reviewBody": "{review_body_b}",
        "reviewRating": {{
          "@type": "Rating",
          "ratingValue": "5",
          "bestRating": "5"
        }},
        "datePublished": "{tip_date}"
      }}
    ]{offer_catalog}
  }},
  {{
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
{chr(10).join(f"      {item}," for item in faq_items[:-1])}
      {faq_items[-1]}
    ]
  }},
  {{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {{
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://prodetaillab.com/"
      }},
      {{
        "@type": "ListItem",
        "position": 2,
        "name": "Service Areas",
        "item": "https://prodetaillab.com/#areas"
      }},
      {{
        "@type": "ListItem",
        "position": 3,
        "name": "{city}",
        "item": "{canonical}"
      }}
    ]
  }},
  {{
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "{tip_title} — {city} Car Care Tip",
    "description": "{tip_content}",
    "articleBody": "{tip_content} Expert mobile detailing advice for {city} vehicle owners from the Pro Detail Lab professional team.",
    "datePublished": "{tip_date}",
    "dateModified": "{tip_date}",
    "author": {{
      "@type": "Organization",
      "name": "Pro Detail Lab",
      "url": "https://prodetaillab.com"
    }},
    "publisher": {{
      "@type": "Organization",
      "name": "Pro Detail Lab",
      "logo": {{
        "@type": "ImageObject",
        "url": "https://prodetaillab.com/logo.webp"
      }}
    }},
    "mainEntityOfPage": {{
      "@type": "WebPage",
      "@id": "{canonical}"
    }}
  }}
]'''
    return schema


def generate_local_seo_html(city, local_data, is_fleet, keywords=None):
    """Generate a hyper-local HTML section unique to each city for local SEO dominance."""
    if not local_data:
        return ""

    neighborhoods = local_data.get("neighborhoods", [])
    landmarks = local_data.get("landmarks", [])
    streets = local_data.get("streets", [])
    local_angle = local_data.get("local_angle", "")
    why_us_local = local_data.get("why_us_local", "")
    vehicle_profile = local_data.get("vehicle_profile", "vehicles")
    service_area_desc = local_data.get("service_area_desc", city)
    zip_code = local_data.get("zip", "")
    competition_angle = local_data.get("competition_angle", "")

    # Clean emojis from neighborhoods, landmarks, etc.
    neighborhoods = [strip_emojis(n) for n in neighborhoods]
    landmarks = [strip_emojis(lm) for lm in landmarks]
    streets = [strip_emojis(s) for s in streets]
    local_angle = strip_emojis(local_angle)
    why_us_local = strip_emojis(why_us_local)
    vehicle_profile = strip_emojis(vehicle_profile)
    service_area_desc = strip_emojis(service_area_desc)
    competition_angle = strip_emojis(competition_angle)

    neighborhoods_html = "".join([
        f'<span style="display:inline-block;background:rgba(30,64,175,0.12);border:1px solid rgba(30,64,175,0.3);'
        f'color:#e0f2fe;padding:0.3rem 0.8rem;border-radius:20px;font-size:0.78rem;font-weight:600;margin:0.2rem;">'
        f'{n}</span>' for n in neighborhoods
    ])
    landmarks_html = "".join([
        f'<li style="color:#94a3b8;font-size:0.9rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
        f'<span style="color:#34d399;margin-right:0.5rem;">*</span>{lm}</li>' for lm in landmarks
    ])
    streets_html = ", ".join(streets)

    service_type = "fleet detailing" if is_fleet else "premium mobile detailing app"
    headline = f"{'Fleet Detailing' if is_fleet else 'Premium Mobile Detailing App'} Near Me in {city}, CA"

    # Add trending keywords badges if present
    keywords_html = ""
    if keywords:
        filtered_kws = []
        city_lower = city.lower()
        exclude_words = [
            "nuevo leon", "laguna", "garza", "garcia", "alcantara", "bernardo", "cordova", "pablo", 
            "mexico", "tx", "fl", "ny", "arizona", "diego", "francisco", "jose", "oakland", 
            "sacramento", "seattle", "boston", "chicago", "houston", "miami", "york", "jersey"
        ]
        
        for kw in keywords:
            if not kw:
                continue
            kw_lower = strip_emojis(kw).lower().strip()
            
            # Exclude obvious foreign or out-of-region matches
            if any(ew in kw_lower for ew in exclude_words):
                continue
                
            # If the keyword contains any city name from the CITIES list, it must belong to our current city
            contains_other_city = False
            for other_city in CITIES:
                if other_city == city:
                    continue
                other_city_lower = other_city.lower()
                # If other city is in keyword but our current city is not
                if other_city_lower in kw_lower and city_lower not in kw_lower:
                    # Special check for overlaps like 'palos verdes' in 'rancho palos verdes'
                    if other_city_lower in city_lower:
                        continue
                    contains_other_city = True
                    break
            
            if contains_other_city:
                continue
                
            filtered_kws.append(kw_lower)
            
        cleaned_kws = sorted(list(set(filtered_kws)))
        badges = [
            f'<span style="display:inline-block;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);'
            f'color:#cbd5e1;padding:0.25rem 0.6rem;border-radius:6px;font-size:0.75rem;margin:0.2rem;">'
            f'{kw}</span>' for kw in cleaned_kws
        ]
        keywords_html = f"""
        <div style="margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.02); padding-top: 1.5rem; text-align: left; opacity: 0.15; transition: opacity 0.3s;" onmouseover="this.style.opacity='0.6';" onmouseout="this.style.opacity='0.15';">
          <details style="cursor: pointer;">
            <summary style="font-size: 0.75rem; font-weight: 700; color: #64748b; outline: none; list-style: none;">Related Searches in {city}</summary>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.75rem;">
              {"".join(badges)}
            </div>
          </details>
        </div>
        """
        crawler_kw_list = " | ".join(cleaned_kws)
    else:
        crawler_kw_list = f"car wash near me {city} | mobile car wash {city} CA | car detailing {city} | auto detailing {city} CA | mobile detailing near me {city} | {city} car wash {zip_code} | ceramic coating {city} CA | interior detailing {city}"

    return f'''
    <!-- HYPER-LOCAL SEO SECTION — Unique content for {city} — DO NOT REMOVE -->
    <section id="local-seo-{city.lower().replace(' ', '-')}" style="padding:4rem 0;background:linear-gradient(180deg,rgba(15,23,42,0) 0%,rgba(15,23,42,0.6) 100%);" itemscope itemtype="https://schema.org/LocalBusiness">
      <meta itemprop="name" content="Pro Detail Lab - {city}">
      <meta itemprop="telephone" content="+1-310-340-3489">
      <meta itemprop="areaServed" content="{city}, CA {zip_code}">
      <div class="container" style="max-width:1100px;margin:0 auto;padding:0 1.5rem;">

        <!-- Local Headline -->
        <div style="text-align:center;margin-bottom:3rem;">
          <div style="display:inline-block;background:linear-gradient(135deg,rgba(30,64,175,0.12),rgba(3,105,161,0.20));border:1px solid rgba(30,64,175,0.3);padding:0.4rem 1.2rem;border-radius:20px;font-size:0.78rem;font-weight:700;color:#e0f2fe;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1rem;">Serving {city}, CA {zip_code}</div>
          <h2 style="font-size:clamp(1.6rem,4vw,2.4rem);font-weight:900;color:#fff;font-family:'Outfit',sans-serif;line-height:1.2;margin-bottom:1rem;" itemprop="description">
            #{1} {headline}
          </h2>
          <p style="color:#94a3b8;max-width:700px;margin:0 auto;font-size:1rem;line-height:1.7;">
            {local_angle}
          </p>
        </div>

        <!-- Two-column: Local Info + Why Choose Us -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2.5rem;" class="local-grid">

          <!-- Neighborhoods served -->
          <div style="background:rgba(30,41,59,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:18px;padding:1.5rem;">
            <details style="cursor: pointer;">
              <summary style="font-size:1.05rem;font-weight:800;color:#fff;font-family:'Outfit',sans-serif;outline:none;display:flex;align-items:center;gap:8px;list-style:none;user-select:none;">
                <span class="material-symbols-outlined" style="font-size:1.2rem;color:#1e40af;">map</span>
                <span>Neighborhoods We Serve in {city}</span>
                <span style="font-size:0.75rem;color:#64748b;font-weight:normal;margin-left:auto;border:1px solid rgba(255,255,255,0.08);padding:0.2rem 0.5rem;border-radius:4px;">Expand</span>
              </summary>
              <div style="margin-top:1.2rem;margin-bottom:1rem;">{neighborhoods_html}</div>
              <p style="color:#94a3b8;font-size:0.82rem;line-height:1.6;margin:0;">
                We provide {service_type} across {service_area_desc}.
                Popular streets include: <strong style="color:#cbd5e1;">{streets_html}</strong>.
              </p>
            </details>
          </div>

          <!-- Local landmarks & why us -->
          <div style="background:rgba(30,41,59,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:18px;padding:1.5rem;">
            <details style="cursor: pointer;">
              <summary style="font-size:1.05rem;font-weight:800;color:#fff;font-family:'Outfit',sans-serif;outline:none;display:flex;align-items:center;gap:8px;list-style:none;user-select:none;">
                <span class="material-symbols-outlined" style="font-size:1.2rem;color:#10b981;">near_me</span>
                <span>Landmarks We Service Near {city}</span>
                <span style="font-size:0.75rem;color:#64748b;font-weight:normal;margin-left:auto;border:1px solid rgba(255,255,255,0.08);padding:0.2rem 0.5rem;border-radius:4px;">Expand</span>
              </summary>
              <div style="margin-top:1.2rem;margin-bottom:1rem;">
                <ul style="list-style:none;padding:0;margin:0;">{landmarks_html}</ul>
              </div>
              <p style="color:#94a3b8;font-size:0.82rem;line-height:1.6;margin:0;">
                {why_us_local}
              </p>
            </details>
          </div>
        </div>

        <!-- Vehicle profile + local edge -->
        <div style="background:linear-gradient(135deg,rgba(30,64,175,0.08),rgba(3,105,161,0.08));border:1px solid rgba(30,64,175,0.2);border-radius:20px;padding:2rem;display:grid;grid-template-columns:1fr 1fr;gap:2rem;align-items:center;" class="local-edge-grid">
          <div>
            <div style="font-size:0.75rem;font-weight:800;color:#e0f2fe;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.5rem;">Vehicles We Detail in {city}</div>
            <p style="color:#e2e8f0;font-size:1rem;font-weight:600;margin-bottom:0.75rem;">{vehicle_profile.capitalize()}</p>
            <p style="color:#94a3b8;font-size:0.85rem;line-height:1.6;">{competition_angle}</p>
          </div>
          <div style="text-align:center;">
            <a href="https://apps.apple.com/us/app/my-carwash-on-demand-detail/id6759268463"
               style="display:inline-block;background:linear-gradient(135deg,#1e40af,#0369a1);color:#fff;text-decoration:none;padding:1rem 2rem;border-radius:14px;font-weight:800;font-size:0.95rem;margin-bottom:0.75rem;width:100%;box-sizing:border-box;"
               target="_blank" rel="noopener">
              Book Mobile Detailing in {city}
            </a>
            <p style="color:#64748b;font-size:0.78rem;">Or call: <a href="tel:+13103403489" style="color:#e0f2fe;text-decoration:none;">(310) 340-3489</a></p>
          </div>
        </div>

        {keywords_html}

        <!-- Near Me Keywords (hidden, for crawlers) -->
        <div style="display:none;" aria-hidden="true">
          <p>{crawler_kw_list}</p>
        </div>

      </div>
    </section>
    <!-- END LOCAL SEO SECTION for {city} -->
    <style>
    @media(max-width:768px){{.local-grid,.local-edge-grid{{grid-template-columns:1fr!important;}}}}
    </style>'''





generated_urls = []

for city in CITIES:
    slug = slugify(city)
    filename = f"{slug}.html"
    filepath = os.path.join(OUTPUT_DIR, filename)
    generated_urls.append(f"https://prodetaillab.com/{slug}")

    is_fleet_city = city in FLEET_CITIES
    geo_data = CITY_GEO_ZIP.get(city, {"lat": 34.0522, "lng": -118.2437, "zip": "90012"})
    zip_code = geo_data["zip"]

    city_metadata = SEO_DATA["cities"].get(slugify_hyphen(city), {})
    city_local_data = LOCAL_DATA.get(city, {})
    title = city_metadata.get("title")
    description = city_metadata.get("description")

    h = int(hashlib.md5(slug.encode('utf-8')).hexdigest(), 16)

    if not title or title.strip() == "" or title == f"#1 Mobile Car Wash & Detailing {city}, CA | Pro Detail Lab":
        if is_fleet_city:
            patterns = [
                f"Industrial Fleet & Semi-Truck Mobile Detailing App {city}, CA",
                f"Commercial Fleet Detailing App & Services {city}",
                f"#1 On-Site Truck & Commercial Fleet Detailing App {city}",
                f"Professional Fleet Mobile Detailing App {city}, CA"
            ]
            title = patterns[h % len(patterns)]
        else:
            patterns = [
                f"#1 Premium Mobile Detailing App {city}, CA",
                f"Premium On-Demand Detailing App in {city}, CA",
                f"#1 Premium Detailing App & Paint Care {city}",
                f"Luxe Mobile Detailing App in {city}, CA"
            ]
            title = patterns[h % len(patterns)]

    if not description or description.strip() == "":
        if is_fleet_city:
            patterns = [
                f"{city}'s premier choice for commercial fleet washing, semi-truck detailing app, and heavy-duty vehicle sanitizing on-site.",
                f"Scale your business image in {city} with our professional mobile fleet detailing app.",
                f"Reliable, on-site fleet detailing and heavy truck washing app services in {city}, CA.",
                f"Keep your commercial fleet spotless with {city}'s leading on-site detailing app."
            ]
            description = patterns[h % len(patterns)]
        else:
            patterns = [
                f"Experience the best with Pro Detail Lab, the premium mobile detailing app in {city}. We provide luxury hand detailing, ceramic coating, and deep interior cleaning right to your door.",
                f"Top-rated premium mobile detailing app serving {city}, CA. Meticulous interior restoration, paint protection, and premium washes delivered to your home or office.",
                f"Redefining car care in {city} with our premium mobile detailing app. Get showroom-ready with our eco-friendly steam cleaning, clay bar, and ceramic coatings.",
                f"#1 premium mobile detailing app serving {city}. Meticulous interior and exterior detailing for luxury sedans, SUVs, and daily drivers. Book in seconds!"
            ]
            description = patterns[h % len(patterns)]

    canonical = f"https://prodetaillab.com/{slug}"

    if is_fleet_city:
        content = fleet_template
        content = content.replace("{{CITY}}", city)
        content = content.replace("{{FILENAME}}", filename)
    else:
        content = standard_template

    # Update meta tags
    content = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', content, flags=re.DOTALL)
    content = re.sub(r'<meta\s+name="description"\s+content=".*?"\s*/?>', f'<meta name="description" content="{description}">', content, flags=re.DOTALL)
    content = re.sub(r'<link\s+rel="canonical"\s+href=".*?"\s*/?>', f'<link rel="canonical" href="{canonical}">', content, flags=re.DOTALL)
    content = re.sub(r'<meta\s+property="og:url"\s+content=".*?"\s*/?>', f'<meta property="og:url" content="{canonical}">', content, flags=re.DOTALL)
    content = re.sub(r'<meta\s+property="og:title"\s+content=".*?"\s*/?>', f'<meta property="og:title" content="{title}">', content, flags=re.DOTALL)
    content = re.sub(r'<meta\s+property="og:description"\s+content=".*?"\s*/?>', f'<meta property="og:description" content="{description}">', content, flags=re.DOTALL)

    # Body replacements
    if not is_fleet_city:
        content = content.replace('Professional Service in Los Angeles', f'Professional Service in {city}')
        content = content.replace('Premium Mobile Car Wash & Detailing', 'Premium Mobile Detailing App')
        content = content.replace('Best Mobile Detailing in Los Angeles', f'Best Mobile Detailing in {city}')
        content = content.replace('service in <strong>Los Angeles</strong>.', f'service in <strong>{city}</strong>.')
        content = content.replace('anywhere in L.A.', f'anywhere in {city}.')
        content = content.replace('Detailing Services</span> in Los Angeles', f'Detailing Services</span> in {city}')
        content = content.replace('from our Los Angeles detailing professionals', f'from our {city} detailing professionals')
        content = content.replace('is Essential in L.A.', f'is Essential in {city}')
        content = content.replace('intense Los Angeles UV', f'intense {city} UV')
        content = content.replace('Greater Los Angeles', f'Greater {city}')
        content = content.replace('across Los Angeles.', f'across {city}.')
        content = content.replace('in Los Angeles.', f'in {city}.')
        content = content.replace('the L.A. metro area.', f'the {city} area.')
        content = content.replace('in L.A.', f'in {city}')
        content = content.replace('Serving Greater Los Angeles', f'Serving Greater {city}')
        content = content.replace('placeholder="Los Angeles, 90001"', f'placeholder="{city}"')
        content = content.replace(
            'placeholder="City, State or Zip Code (e.g. Los Angeles, CA 90001)"',
            f'placeholder="City, State or Zip Code (e.g. {city}, CA {zip_code})"'
        )
        
        # Inyectar variaciones de texto dynamically to make pages human-like and avoid Google duplicate content penalty
        content = re.sub(
            r'Complete\s+interior\s+and\s+exterior\s+refresh\s+featuring\s+meticulous\s+hand\s+washing,\s+deep\s+vacuuming,\s+window\s+cleaning,\s+door\s+jambs\s+detailing,\s+tire\s+shine,\s+and\s+a\s+detailed\s+blowout\.',
            get_text_variant(city, "basic_desc"),
            content
        )
        content = re.sub(
            r'Only\s+interior\s+deep\s+cleaning\.\s+Deep\s+seat,\s+carpet,\s+door\s+panels,\s+and\s+dashboard\s+scrub,\s+floor\s+mats\s+wash,\s+and\s+premium\s+leather/plastic\s+conditioning\.\s+\*\*\(No\s+exterior\s+wash\s+included\)\*\*',
            get_text_variant(city, "maintenance_desc"),
            content
        )
        content = re.sub(
            r'Complete\s+interior\s+deep\s+clean\s+combined\s+with\s+exterior\s+clay\s+bar,\s+premium\s+3-month\s+ceramic\s+paint\s+sealant\s+protection,\s+tire\s+and\s+wheel\s+detailing,\s+and\s+plastic\s+trim\s+restoration\.',
            get_text_variant(city, "onyx_desc"),
            content
        )
        content = re.sub(
            r'Our\s+contactless\s+washing\s+technique\s+uses\s+no\s+abrasive\s+brushes\s+or\s+sponges\s+—\s+only\s+premium\s+microfiber\s+and\s+safe\s+foam\s+application\s+—\s+so\s+your\s+paint\s+never\s+gets\s+scratched\s+or\s+swirled\.',
            get_text_variant(city, "touchless_desc"),
            content
        )
        content = re.sub(
            r"Fully\s+self-contained\s+professional\s+wash\s+—\s+perfect\s+for\s+apartments\s+&\s+condos",
            get_text_variant(city, "waterless_desc"),
            content
        )
        content = re.sub(
            r"Choose\s+your\s+service,\s+pick\s+a\s+date\s+and\s+time,\s+and\s+confirm\s+your\s+location\s+—\s+all\s+in\s+under\s+60\s+seconds\.",
            get_text_variant(city, "step1_desc"),
            content
        )
        content = re.sub(
            r"A\s+certified\s+professional\s+arrives\s+with\s+all\s+professional-grade\s+tools,\s+products,\s+and\s+equipment\s+needed\.",
            get_text_variant(city, "step2_desc"),
            content
        )
        content = re.sub(
            r"Relax\s+while\s+we\s+transform\s+your\s+vehicle\.\s+Rate\s+your\s+experience\s+in-app\s+when\s+we're\s+done\.",
            get_text_variant(city, "step3_desc"),
            content
        )
        
        # Localize sections dynamically to prevent duplicate content penalty (like Washos)
        repls = get_localized_replacements(city, is_fleet_city)
        
        # 1. Hero Title
        content = re.sub(
            r'<h1 class="hero-title">.*?</h1>',
            repls["hero_title"],
            content,
            flags=re.DOTALL
        )
        
        # 2. Hero Subtitle / Intro
        content = re.sub(
            r'Looking\s+for\s+a\s+professional\s+<strong>mobile\s+car\s+wash\s+in\s+.*?</strong>\?\s+<strong>My\s+Carwash\s+App</strong>\s+brings\s+elite\s+mobile\s+detailing\s+directly\s+to\s+your\s+door\.\s+<strong>Download\s+our\s+App\s+and\s+book\s+in\s+seconds</strong>\!',
            repls["hero_subtitle"],
            content,
            flags=re.DOTALL
        )
        
        # 3. Why Us Section Header
        content = re.sub(
            r'<div class="section-header">\s*<div class="section-tag">Why Pro Detail Lab</div>\s*<h2>The Standard, <span class="gradient-text">Redefined</span></h2>\s*<p>We don\'t just wash cars — we protect your investment and deliver a luxury experience at your\s*location\.</p>\s*</div>',
            repls["why_us"],
            content,
            flags=re.DOTALL
        )
        
        # 4. How It Works Section Header
        content = re.sub(
            r'<div class="section-header">\s*<div class="section-tag">The Process</div>\s*<h2>Seamless From <span class="gradient-text">Start to Shine</span></h2>\s*<p>Booking a premium detail has never been this effortless\.</p>\s*</div>',
            repls["how_it_works"],
            content,
            flags=re.DOTALL
        )
        
        # 6. Add-ons Section Header
        content = re.sub(
            r'<div class="section-header">\s*<div class="section-tag section-tag-gold">Detailing Upgrades</div>\s*<h2>Premium <span class="gradient-text-gold">Add-ons</span></h2>\s*<p>Enhance your package with specialized services\. These can be added to any of our maintenance or\s*detailing plans\.</p>\s*</div>',
            repls["addons"],
            content,
            flags=re.DOTALL
        )
    else:
        content = content.replace('Commercial Fleet Detailing in Los Angeles', f'Commercial Fleet Detailing in {city}')
        content = content.replace('On-Site Service in Los Angeles', f'On-Site Service in {city}')
        content = content.replace('across the Los Angeles area.', f'across the {city} area.')
        content = content.replace('value="Los Angeles, CA"', f'value="{city}, CA"')
        content = content.replace('Los Angeles businesses trust.', f'{city} businesses trust.')
        content = content.replace('company cars in Los Angeles.', f'company cars in {city}.')
        content = content.replace('Greater Los Angeles', f'Greater {city}')
        content = content.replace('Serving Industrial Los Angeles.', f'Serving Industrial {city}.')
        content = content.replace('Serving Industrial Los Angeles', f'Serving Industrial {city}')
        content = content.replace('Industrial Los Angeles', f'Industrial {city}')
        content = content.replace(
            'placeholder="e.g. Los Angeles Logistics"',
            f'placeholder="e.g. {city} Logistics"'
        )

        # Localize sections dynamically to prevent duplicate content penalty (like Washos) for fleets
        repls = get_localized_replacements(city, is_fleet_city)
        content = re.sub(
            r'<h1 class="hero-title">.*?</h1>',
            repls["fleet_hero_title"],
            content,
            flags=re.DOTALL
        )
        content = re.sub(
            r'<p class="hero-subtitle">.*?</p>',
            repls["fleet_hero_subtitle"],
            content,
            flags=re.DOTALL,
            count=1
        )
        content = re.sub(
            r'<div class="section-header">\s*<div class="section-tag">Commercial Expertise</div>\s*<h2>Specialized <span class="gradient-text-gold">Fleet Packages</span></h2>\s*<p>Heavy-duty detailing require specialized equipment and techniques\. We are the experts Los Angeles businesses trust\.</p>\s*</div>',
            repls["fleet_services"],
            content,
            flags=re.DOTALL
        )

    # Geo data
    geo_data = CITY_GEO_ZIP.get(city, {"lat": 34.0522, "lng": -118.2437, "zip": "90012"})
    zip_code = geo_data["zip"]

    # Review data
    rating_count = 85 + (h % 111)
    rating_val = "4.9"

    reviewer_a_name, review_body_a_tmpl = REVIEWS_POOL_A[h % len(REVIEWS_POOL_A)]
    reviewer_b_name, review_body_b_tmpl = REVIEWS_POOL_B[h % len(REVIEWS_POOL_B)]
    review_body_a = review_body_a_tmpl.replace("{city}", city)
    review_body_b = review_body_b_tmpl.replace("{city}", city)

    # Get city-specific tip offset (so each city shows a different tip today)
    city_offset = h % total_tips
    city_tip_index = ((day_of_year + city_offset - 1) % total_tips) + 1
    city_tip = TIPS_BY_DAY.get(city_tip_index, TODAY_TIP)
    tip_title = city_tip["title"].replace("Los Angeles", city).replace("$CITY_NAME", city)
    tip_content = city_tip["content"].replace("Los Angeles", city).replace("$CITY_NAME", city)

    # Dynamically inject daily keywords into the text body to address local search queries
    city_keywords = TRENDING_KEYWORDS.get(slugify_hyphen(city), [])
    filtered_kws = []
    exclude_words = [
        "nuevo leon", "laguna", "garza", "garcia", "alcantara", "bernardo", "cordova", "pablo", 
        "mexico", "tx", "fl", "ny", "arizona", "diego", "francisco", "jose", "oakland", 
        "sacramento", "seattle", "boston", "chicago", "houston", "miami", "york", "jersey"
    ]
    city_lower = city.lower()
    for kw in city_keywords:
        if not kw:
            continue
        kw_lower = kw.lower().strip()
        if any(ew in kw_lower for ew in exclude_words):
            continue
        contains_other = False
        for oc in CITIES:
            if oc == city:
                continue
            if oc.lower() in kw_lower and city_lower not in kw_lower:
                contains_other = True
                break
        if not contains_other:
            filtered_kws.append(kw_lower)
            
    if len(filtered_kws) >= 2:
        kw1 = filtered_kws[0].title()
        kw2 = filtered_kws[1].title()
        if len(filtered_kws) >= 3:
            kw3 = filtered_kws[2].title()
            kw_str = f"'{kw1}', '{kw2}', or '{kw3}'"
        else:
            kw_str = f"'{kw1}' or '{kw2}'"
        tip_content += f" This is why local car owners search for terms like {kw_str} to maintain their vehicles in peak condition. Pro Detail Lab provides the ultimate on-demand response to these local car care needs."

    # Generate the NEW rich JSON-LD (replaces old schema entirely)
    rich_schema = generate_rich_jsonld(
        city, slug, canonical, geo_data, rating_count, rating_val,
        reviewer_a_name, review_body_a, reviewer_b_name, review_body_b,
        zip_code, is_fleet_city, tip_title, tip_content, TODAY_DATE
    )

    # Replace the old JSON-LD block entirely
    content = re.sub(
        r'<script type="application/ld\+json">.*?</script>',
        f'<script type="application/ld+json">\n{rich_schema}\n</script>',
        content,
        flags=re.DOTALL,
        count=1
    )

    # Inject local SEO HTML right before </body> so Google sees it
    city_local_data = LOCAL_DATA.get(city, {})
    city_keywords = TRENDING_KEYWORDS.get(slugify_hyphen(city), [])
    local_seo_html = generate_local_seo_html(city, city_local_data, is_fleet_city, city_keywords)
    content = content.replace('</body>', f'{local_seo_html}\n</body>')

    # Replace the visible placeholder grid with the actual localized daily tip card directly
    if is_fleet_city:
        fleet_tip_card_html = f'''<div id="seoTipsGrid" data-localized="true">
                    <article class="tip-card visible" itemscope itemtype="https://schema.org/Article">
                        <meta itemprop="datePublished" content="{TODAY_DATE}">
                        <meta itemprop="dateModified" content="{TODAY_DATE}">
                        <div class="tip-tag">FLEET CARE — {TODAY_DATE}</div>
                        <h3 itemprop="headline">{tip_title}</h3>
                        <p itemprop="articleBody">{tip_content}</p>
                    </article>
                </div>'''
        content = re.sub(
            r'<div id="seoTipsGrid">.*?</div>\s*</div>',
            f'{fleet_tip_card_html}\n            </div>',
            content,
            flags=re.DOTALL
        )
    else:
        tip_card_html = f'''<div class="tips-grid" id="seoTipsGrid" data-localized="true">
                    <article class="tip-card visible" itemscope itemtype="https://schema.org/Article">
                        <meta itemprop="datePublished" content="{TODAY_DATE}">
                        <meta itemprop="dateModified" content="{TODAY_DATE}">
                        <div class="tip-tag">PREMIUM CARE — {TODAY_DATE}</div>
                        <h3 itemprop="headline">{tip_title}</h3>
                        <p itemprop="articleBody">{tip_content}</p>
                    </article>
                </div>'''
        content = re.sub(
            r'<div class="tips-grid" id="seoTipsGrid">.*?</div>\s*</div>',
            f'{tip_card_html}\n            </div>',
            content,
            flags=re.DOTALL
        )

    # Dynamic recent jobs
    jobs_html = generate_jobs_html(city, slug, is_fleet_city)
    content = content.replace("<!-- {{RECENT_WORK_PLACEHOLDER}} -->", jobs_html)
    content = content.replace("{{RECENT_WORK_PLACEHOLDER}}", jobs_html)

    # Strip .html and cities/ path prefix from city links
    content = re.sub(r'href="(?:\.\.\/)?cities/([a-zA-Z0-9_-]+)(?:\.html)?"', r'href="\1"', content)

    # Ensure zero emojis are written to the page (strict sanitize)
    content = strip_emojis(content)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

    schema_type = "AutomotiveBusiness" if is_fleet_city else "AutoWash"
    print(f"[OK] Generated: [{schema_type}] {filename} | Reviews: {rating_count} | Tip: '{tip_title[:40]}...'")


# ── Update main pages ──────────────────────────────────────────────────────────
def update_main_page(file_path, key):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    data = SEO_DATA.get(key, {})
    title = data.get("title")
    description = data.get("description")

    if title:
        content = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', content, flags=re.DOTALL)
    if description:
        content = re.sub(r'<meta\s+name="description"\s+content=".*?"\s*/?>', f'<meta name="description" content="{description}">', content, flags=re.DOTALL)
        content = re.sub(r'<meta\s+property="og:description"\s+content=".*?"\s*/?>', f'<meta property="og:description" content="{description}">', content, flags=re.DOTALL)

    content = re.sub(r'href="(?:\.\.\/)?cities/([a-zA-Z0-9_-]+)(?:\.html)?"', r'href="\1"', content)
    cities_json = json.dumps(CITIES)
    content = re.sub(r'"areaServed":\s*\[.*?\]', lambda m: f'"areaServed": {cities_json}', content, flags=re.DOTALL)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[OK] Updated Main Page: {os.path.basename(file_path)}")


update_main_page(TEMPLATE_FILE, "main")
update_main_page(FLEET_TEMPLATE_FILE, "fleet_general")
update_main_page(os.path.join(SCRIPT_DIR, "rv_detail.html"), "rv")

# ── Generate sitemap.xml ───────────────────────────────────────────────────────
sitemap_lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
]

main_pages = [
    ("https://prodetaillab.com/", "1.0", "daily"),
    ("https://prodetaillab.com/fleet_index", "0.9", "weekly"),
    ("https://prodetaillab.com/rv_detail", "0.9", "weekly"),
]

for loc, priority, freq in main_pages:
    sitemap_lines += [
        '  <url>',
        f'    <loc>{loc}</loc>',
        f'    <lastmod>{TODAY_DATE}</lastmod>',
        f'    <changefreq>{freq}</changefreq>',
        f'    <priority>{priority}</priority>',
        '  </url>'
    ]

for url in generated_urls:
    sitemap_lines += [
        '  <url>',
        f'    <loc>{url}</loc>',
        f'    <lastmod>{TODAY_DATE}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>'
    ]

sitemap_lines.append('</urlset>')

with open(SITEMAP_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(sitemap_lines))

print(f"[MAP] Sitemap updated: {len(generated_urls) + 3} URLs with changefreq=daily")
print(f"[TIP] Today's tip (day {day_of_year}): '{TODAY_TIP['title']}'")
print(f"\n[DONE] Successfully generated {len(CITIES)} SEO pages with rich JSON-LD schemas!")
print(f"   [+] FAQPage schema (3 Q&As per city)")
print(f"   [+] BreadcrumbList schema")
print(f"   [+] OfferCatalog schema with prices")
print(f"   [+] 2 reviews per city")
print(f"   [+] Article JSON-LD with daily tip (Google-visible)")
print(f"   [+] Static tip HTML injected in body")
print(f"   [+] Sitemap changefreq=daily")
