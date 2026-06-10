from PIL import Image, ImageDraw, ImageFilter

print("Starting image censorship and processing...")

# Source paths
paths = {
    "jeep": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421446.jpg",
    "jaguar": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421381.jpg",
    "chevy": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421389.jpg",
    "tesla_int": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421394.jpg",
    "subaru": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421438.jpg"
}

# Destinations in landing/assets/
destinations = {
    "jeep": "landing/assets/gallery_jeep.jpg",
    "jaguar": "landing/assets/gallery_jaguar.jpg",
    "chevy": "landing/assets/gallery_chevy.jpg",
    "tesla_int": "landing/assets/gallery_tesla.jpg",
    "subaru": "landing/assets/gallery_subaru.jpg"
}

# Helper to blur a bounding box region in an image
def censor_region_blur(img, bbox):
    # bbox format: (x1, y1, x2, y2)
    crop_area = img.crop(bbox)
    # Apply heavy blur
    blurred_area = crop_area.filter(ImageFilter.GaussianBlur(radius=8))
    img.paste(blurred_area, bbox)

# Helper to draw a dark gray or black box (often cleaner than blur for plates)
def censor_region_fill(img, bbox, fill_color=(25, 25, 25)):
    draw = ImageDraw.Draw(img)
    draw.rectangle(bbox, fill=fill_color, outline=fill_color)

# 1. Process Subaru WRX
# Plate is clearly visible on the front bumper. Bounding box coordinates:
# x: [210, 275], y: [570, 608]
print("Processing Subaru WRX...")
img = Image.open(paths["subaru"])
# Draw a dark gray rectangular cover (fill) to mimic a blank bumper plate
censor_region_fill(img, (210, 570, 275, 608), fill_color=(15, 15, 15))
img.save(destinations["subaru"])
print(f"Saved to {destinations['subaru']}")

# 2. Process Jeep Rubicon
# The Jeep itself is clean. In the background on the right is a blue pickup truck.
# Its rear plate is small, let's blur it:
# x: [735, 420] to [758, 440]
print("Processing Jeep Rubicon...")
img = Image.open(paths["jeep"])
censor_region_fill(img, (735, 420, 758, 438), fill_color=(30, 35, 40))
img.save(destinations["jeep"])
print(f"Saved to {destinations['jeep']}")

# 3. Process Chevy Pickup
# No front plate is present or visible on the bumper (side view). Keep as is.
print("Processing Chevy Pickup...")
img = Image.open(paths["chevy"])
img.save(destinations["chevy"])
print(f"Saved to {destinations['chevy']}")

# 4. Process Tesla Windshield View (Interior)
# The black Tesla Model S/X in front has its rear plate visible in the background.
# Bounding box coordinates in windshield:
# x: [572, 108] to [605, 122]
print("Processing Tesla Windshield view...")
img = Image.open(paths["tesla_int"])
censor_region_fill(img, (572, 108, 605, 122), fill_color=(30, 30, 30))
img.save(destinations["tesla_int"])
print(f"Saved to {destinations['tesla_int']}")

# 5. Process Jaguar F-Type
# Has a blank black front bracket, no plate numbers. Keep as is.
print("Processing Jaguar F-Type...")
img = Image.open(paths["jaguar"])
img.save(destinations["jaguar"])
print(f"Saved to {destinations['jaguar']}")

print("Image censorship and saving complete!")
