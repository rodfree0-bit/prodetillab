import os
import cv2
import numpy as np
from pathlib import Path
from PIL import Image

processed_dir = Path(r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\landing\assets\gallery_processed")
downloads_dir = Path(r"C:\Users\cramr\Downloads")
candidates_dir = Path(r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\scratch\candidates")
candidates_dir.mkdir(parents=True, exist_ok=True)

# We want to find corresponding original files for the processed ones
image_files = []
for p in processed_dir.glob("*.jpg"):
    stem = p.stem
    # Find matching original file in Downloads
    matches = [m for m in downloads_dir.glob(stem + ".*") if m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
    if not matches:
        matches = [m for m in downloads_dir.iterdir() if m.stem.lower() == stem.lower() and m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
    
    if matches:
        image_files.append((p.name, matches[0]))
    else:
        # If no original, we will use the processed one (even if it has the black bar, for analysis)
        image_files.append((p.name, p))

print(f"Total images to analyze: {len(image_files)}")

# Detect rectangles in the lower part of the image
for name, orig_path in image_files:
    print(f"Analyzing {orig_path.name}...")
    try:
        # Load image (if HEIC, use pillow-heif first)
        if orig_path.suffix.lower() == ".heic":
            import pillow_heif
            heif_file = pillow_heif.read_heif(orig_path)
            image = Image.frombytes(
                heif_file.mode, 
                heif_file.size, 
                heif_file.data,
                "raw",
                heif_file.mode,
                heif_file.stride,
            )
            # Convert to numpy array for OpenCV
            img_np = np.array(image)
            img_cv = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        else:
            img_cv = cv2.imread(str(orig_path))
            if img_cv is None:
                print(f"Failed to read {orig_path}")
                continue
                
        h, w = img_cv.shape[:2]
        
        # Focus on the lower part (e.g., bottom 40% where plates are likely to be)
        roi_y1 = int(h * 0.5)
        roi_y2 = int(h * 0.95)
        roi = img_cv[roi_y1:roi_y2, :]
        
        # Preprocessing
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        blur = cv2.bilateralFilter(gray, 11, 17, 17)
        edged = cv2.Canny(blur, 30, 200)
        
        # Find contours
        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:30]
        
        candidates = []
        count = 0
        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            
            # If contour has 4 points, it might be a license plate
            if len(approx) == 4:
                x, y, w_box, h_box = cv2.boundingRect(approx)
                aspect_ratio = float(w_box) / h_box if h_box > 0 else 0
                
                # License plate is wide (aspect ratio between 2.0 and 5.5)
                # And check area (not too small, e.g. at least 500 pixels)
                area = cv2.contourArea(c)
                if 2.0 <= aspect_ratio <= 5.5 and 800 <= area <= 50000:
                    candidates.append((x, y + roi_y1, w_box, h_box, area))
                    
                    # Crop the candidate region and save it
                    crop = img_cv[y + roi_y1:y + roi_y1 + h_box, x:x + w_box]
                    crop_name = f"{orig_path.stem}_cand_{count}.jpg"
                    cv2.imwrite(str(candidates_dir / crop_name), crop)
                    count += 1
                    
        if candidates:
            print(f"  Found {len(candidates)} candidate plate regions for {orig_path.name}")
            
    except Exception as e:
        print(f"  Error analyzing {orig_path.name}: {e}")

print("Plate candidate detection complete!")
