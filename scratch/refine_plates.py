import json
import cv2
import numpy as np
from pathlib import Path
from PIL import Image

# Load original detections
with open("scratch/haar_plates.json", "r") as f:
    detections = json.load(f)

# Categories we know from blog.html that shouldn't have license plates
exclude_keywords = [
    # Interior details
    "IMG_0259", "IMG_1456", "IMG_1457", "IMG_1458", "IMG_5207", "IMG_5208",
    # Wheel details
    "IMG_0743", "IMG_0744", "IMG_0745", "IMG_0746"
]

downloads_dir = Path(r"C:\Users\cramr\Downloads")
refined_plates = {}

for name, coords in detections.items():
    # Check if we should exclude this image entirely
    stem = Path(name).stem
    if any(k in stem for k in exclude_keywords):
        print(f"Excluding {name} (known interior/wheel closeup)")
        continue
        
    # Get original image path
    matches = [m for m in downloads_dir.glob(stem + ".*") if m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
    if not matches:
        matches = [m for m in downloads_dir.iterdir() if m.stem.lower() == stem.lower() and m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
        
    if not matches:
        continue
    orig_path = matches[0]
    
    try:
        # Load image
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
        valid_coords = []
        
        for coord in coords:
            x, y, w_box, h_box = coord
            
            # Extract region of interest
            roi = img_cv[y:y+h_box, x:x+w_box]
            if roi.size == 0:
                continue
                
            # Compute edge density in the ROI
            gray_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            # Bilateral filter to smooth flat areas but preserve edges
            blur_roi = cv2.bilateralFilter(gray_roi, 9, 75, 75)
            # Canny edge detection
            edges = cv2.Canny(blur_roi, 50, 150)
            
            edge_pixels = np.sum(edges > 0)
            total_pixels = edges.size
            edge_density = float(edge_pixels) / total_pixels
            
            # Compute standard deviation of gray values (contrast)
            std_dev = np.std(gray_roi)
            
            # Check aspect ratio
            aspect_ratio = float(w_box) / h_box
            
            # License plates have high edge density (letters/numbers) and high contrast
            # Also aspect ratio should be around 2.0 to 4.0
            print(f"  {name} region ({x}, {y}): Edge Density={edge_density:.4f}, StdDev={std_dev:.2f}, AspectRatio={aspect_ratio:.2f}")
            
            if edge_density > 0.05 and std_dev > 15.0 and 1.8 <= aspect_ratio <= 4.5:
                valid_coords.append(coord)
                
        if valid_coords:
            refined_plates[name] = valid_coords
            print(f"  -> {name} KEEP: {valid_coords}")
            
    except Exception as e:
        print(f"  Error processing {name}: {e}")

# Save refined plates
with open("scratch/refined_plates.json", "w") as f:
    json.dump(refined_plates, f, indent=4)
print(f"Saved refined plates to scratch/refined_plates.json")
