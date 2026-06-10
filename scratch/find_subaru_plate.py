from PIL import Image

path = r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421438.jpg"
img = Image.open(path)
width, height = img.size

# Let's find horizontal segments of white pixels
# A segment is a continuous run of pixels with R, G, B > 200
white_threshold = 200
candidate_regions = []

for y in range(500, 700):
    in_run = False
    start_x = 0
    for x in range(100, 380):
        r, g, b = img.getpixel((x, y))[:3]
        is_white = r > white_threshold and g > white_threshold and b > white_threshold
        if is_white and not in_run:
            in_run = True
            start_x = x
        elif not is_white and in_run:
            in_run = False
            run_length = x - start_x
            # License plate width in pixels is likely between 40 and 100
            if 40 <= run_length <= 100:
                candidate_regions.append((start_x, x, y))

# Group adjacent rows that have matching segments
groups = []
for start_x, end_x, y in candidate_regions:
    added = False
    for g in groups:
        # Check if this segment aligns with the group (overlap in x, adjacent in y)
        last_y = g[-1][2]
        if y == last_y + 1 or y == last_y:
            # Check x overlap
            avg_g_start = sum(item[0] for item in g) / len(g)
            avg_g_end = sum(item[1] for item in g) / len(g)
            if abs(start_x - avg_g_start) < 15 and abs(end_x - avg_g_end) < 15:
                g.append((start_x, end_x, y))
                added = True
                break
    if not added:
        groups.append([(start_x, end_x, y)])

# Filter groups by height (a plate should be 20 to 50 pixels tall)
plate_groups = []
for g in groups:
    ys = [item[2] for item in g]
    g_height = max(ys) - min(ys) + 1
    if 15 <= g_height <= 45:
        min_x = min(item[0] for item in g)
        max_x = max(item[1] for item in g)
        min_y = min(ys)
        max_y = max(ys)
        plate_groups.append((min_x, min_y, max_x, max_y))

print(f"Found {len(plate_groups)} candidate plate rectangles:")
for pg in plate_groups:
    print(f"Rect: x in [{pg[0]}, {pg[2]}], y in [{pg[1]}, {pg[3]}] (width: {pg[2]-pg[0]}, height: {pg[3]-pg[1]})")
