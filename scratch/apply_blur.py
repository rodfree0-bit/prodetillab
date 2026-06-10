import json
import os
import cv2
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter

# Load refined plates coordinates
with open("scratch/refined_plates.json", "r") as f:
    plates_data = json.load(f)

processed_dir = Path(r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\landing\assets\gallery_processed")
downloads_dir = Path(r"C:\Users\cramr\Downloads")

# Get list of all gallery image names currently in gallery_processed
gallery_files = [p.name for p in processed_dir.glob("*.jpg")]
print(f"Total gallery files to process: {len(gallery_files)}")

def load_original_image(stem):
    """Finds and loads the original image from Downloads."""
    matches = [m for m in downloads_dir.glob(stem + ".*") if m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
    if not matches:
        matches = [m for m in downloads_dir.iterdir() if m.stem.lower() == stem.lower() and m.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png", ".webp")]
        
    if not matches:
        return None
        
    orig_path = matches[0]
    
    # Load image
    if orig_path.suffix.lower() == ".heic":
        import pillow_heif
        heif_file = pillow_heif.read_heif(orig_path)
        img = Image.frombytes(heif_file.mode, heif_file.size, heif_file.data, "raw", heif_file.mode, heif_file.stride)
    else:
        img = Image.open(orig_path)
        
    # Correct EXIF orientation
    try:
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
        
    return img

blurred_count = 0
clean_count = 0
fallback_count = 0

for name in gallery_files:
    stem = Path(name).stem
    
    # Load original image
    img = load_original_image(stem)
    
    if img is None:
        print(f"No original found for {name}, keeping existing processed image.")
        fallback_count += 1
        # Optional: We can blur the black bar area of the existing image to make it look nicer
        try:
            existing_path = processed_dir / name
            existing_img = Image.open(existing_path)
            w, h = existing_img.size
            # Blur the black bar area (which is at y: [h*0.82, h*0.97], x: [w*0.25, w*0.75])
            bbox = (int(w * 0.25), int(h * 0.82), int(w * 0.75), int(h * 0.97))
            crop_area = existing_img.crop(bbox)
            blurred_area = crop_area.filter(ImageFilter.GaussianBlur(radius=15))
            existing_img.paste(blurred_area, bbox)
            existing_img.save(processed_dir / name, "JPEG", quality=88, optimize=True)
            print(f"  -> Applied blur to existing black bar on {name}")
        except Exception as e:
            print(f"  -> Failed to blur existing black bar on {name}: {e}")
        continue
        
    if name in plates_data:
        # We need to blur the license plates
        print(f"Blurring license plate on {name}...")
        w, h = img.size
        for coord in plates_data[name]:
            x, y, w_box, h_box = coord
            
            # Crop, blur and paste back
            bbox = (x, y, x + w_box, y + h_box)
            # Make sure bbox is within image bounds
            bbox = (max(0, bbox[0]), max(0, bbox[1]), min(w, bbox[2]), min(h, bbox[3]))
            
            if bbox[2] > bbox[0] and bbox[3] > bbox[1]:
                crop_area = img.crop(bbox)
                # Apply heavy blur
                blurred_area = crop_area.filter(ImageFilter.GaussianBlur(radius=15))
                img.paste(blurred_area, bbox)
                
        # Save blurred image
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img.save(processed_dir / name, "JPEG", quality=88, optimize=True)
        print(f"  Saved blurred image to {processed_dir / name}")
        blurred_count += 1
    else:
        # No license plate detected, save clean original image
        print(f"Saving clean original image for {name}...")
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img.save(processed_dir / name, "JPEG", quality=88, optimize=True)
        print(f"  Saved clean image to {processed_dir / name}")
        clean_count += 1

print("\nProcessing complete!")
print(f"Blurred images: {blurred_count}")
print(f"Clean images (original): {clean_count}")
print(f"Fallback images (kept existing): {fallback_count}")
