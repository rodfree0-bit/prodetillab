import urllib.request
import cv2
import numpy as np
from pathlib import Path
from PIL import Image

# Download Haar Cascade XML
cascade_url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_russian_plate_number.xml"
cascade_path = Path("scratch/haarcascade_russian_plate_number.xml")
if not cascade_path.exists():
    print("Downloading Haar Cascade for license plates...")
    urllib.request.urlretrieve(cascade_url, cascade_path)
    print("Downloaded successfully!")

plate_cascade = cv2.CascadeClassifier(str(cascade_path))

processed_dir = Path(r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\landing\assets\gallery_processed")
downloads_dir = Path(r"C:\Users\cramr\Downloads")
out_dir = Path("scratch/haar_detected")
out_dir.mkdir(parents=True, exist_ok=True)

image_files = []
for p in processed_dir.glob("*.jpg"):
    stem = p.stem
    matches = [m for m in downloads_dir.glob(stem + ".*") if m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
    if not matches:
        matches = [m for m in downloads_dir.iterdir() if m.stem.lower() == stem.lower() and m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
    
    if matches:
        image_files.append((p.name, matches[0]))
    else:
        image_files.append((p.name, p))

print(f"Total images: {len(image_files)}")

detected_plates = {}

for name, orig_path in image_files:
    try:
        # Read image
        if orig_path.suffix.lower() == ".heic":
            import pillow_heif
            heif_file = pillow_heif.read_heif(orig_path)
            image = Image.frombytes(heif_file.mode, heif_file.size, heif_file.data, "raw", heif_file.mode, heif_file.stride)
            img_np = np.array(image)
            img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        else:
            img_cv = cv2.imread(str(orig_path))
            if img_cv is None:
                continue
                
        h, w = img_cv.shape[:2]
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        # Detect plates (focusing search on bottom 60% of image height)
        # We can pass the whole image but restrict the coordinates or check detections
        plates = plate_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 10))
        
        valid_plates = []
        for (x, y, w_box, h_box) in plates:
            # We expect plates to be in the bottom 60% of the image (y > h * 0.4)
            if y > h * 0.35:
                # Aspect ratio check
                aspect_ratio = float(w_box) / h_box
                if 2.0 <= aspect_ratio <= 5.5:
                    valid_plates.append((int(x), int(y), int(w_box), int(h_box)))
                    
        if valid_plates:
            detected_plates[name] = valid_plates
            print(f"  {name}: Found {len(valid_plates)} plates: {valid_plates}")
            
            # Save visual check
            img_draw = img_cv.copy()
            for (x, y, w_box, h_box) in valid_plates:
                cv2.rectangle(img_draw, (x, y), (x + w_box, y + h_box), (0, 255, 0), 3)
            cv2.imwrite(str(out_dir / name), img_draw)
            
    except Exception as e:
        print(f"  Error {name}: {e}")

import json
with open("scratch/haar_plates.json", "w") as f:
    json.dump(detected_plates, f, indent=4)
print("Saved JSON results to scratch/haar_plates.json")
