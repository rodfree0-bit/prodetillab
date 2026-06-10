"""
Script para procesar fotos de detailing:
1. Convierte HEIC → JPG
2. Genera thumbnails para revisión visual
3. Aplica un recuadro negro sobre las placas (zona inferior del auto)
4. Copia imágenes procesadas a la carpeta de salida
"""
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import pillow_heif

# Registrar el plugin HEIC
pillow_heif.register_heif_opener()

DOWNLOADS = Path("C:/Users/cramr/Downloads")
OUTPUT_DIR = Path("C:/Users/cramr/OneDrive/Documents/My-Carwash-app-/landing/assets/gallery_processed")
THUMBS_DIR = Path("C:/Users/cramr/OneDrive/Documents/My-Carwash-app-/scratch/gallery_thumbs")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
THUMBS_DIR.mkdir(parents=True, exist_ok=True)

# Extensiones de imagen a procesar
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.heic', '.webp', '.bmp'}

def add_plate_cover(img: Image.Image) -> Image.Image:
    """
    Cubre la zona inferior de la imagen donde típicamente aparece la placa.
    Añade un rectángulo negro con texto de privacidad.
    La zona de placa suele estar en el 10-22% inferior de la imagen,
    centrada horizontalmente (30-70% del ancho).
    """
    img = img.copy()
    draw = ImageDraw.Draw(img)
    w, h = img.size

    # Zona de la placa: parte inferior central
    # Cubrimos todo el ancho inferior para asegurar que no se vea
    plate_top    = int(h * 0.82)
    plate_bottom = int(h * 0.97)
    plate_left   = int(w * 0.25)
    plate_right  = int(w * 0.75)

    # Rectángulo negro semitransparente + texto
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rectangle(
        [(plate_left - 10, plate_top - 5), (plate_right + 10, plate_bottom + 5)],
        fill=(0, 0, 0, 230)
    )

    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    img = Image.alpha_composite(img, overlay).convert('RGB')

    # Texto encima del recuadro
    draw2 = ImageDraw.Draw(img)
    text = "[PLATE HIDDEN FOR PRIVACY]"
    text_x = plate_left + (plate_right - plate_left) // 2
    text_y = plate_top + (plate_bottom - plate_top) // 2
    draw2.text((text_x, text_y), text, fill=(255, 255, 255, 200), anchor="mm")

    return img

def make_thumb(img: Image.Image, name: str):
    """Genera miniatura de 400x300 para revisión."""
    thumb = img.copy()
    thumb.thumbnail((400, 300), Image.LANCZOS)
    thumb.save(THUMBS_DIR / f"THUMB_{name}.jpg", "JPEG", quality=70)

def process_images():
    images = [f for f in DOWNLOADS.iterdir()
              if f.is_file() and f.suffix.lower() in IMAGE_EXTS]
    images.sort(key=lambda f: f.stat().st_mtime, reverse=True)

    print(f"Found {len(images)} images to process\n")

    processed = []
    skipped = []

    for img_path in images:
        try:
            print(f"Processing: {img_path.name}")
            img = Image.open(img_path)

            # Corregir orientación EXIF
            try:
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Generar thumbnail SIN recuadro de placa para revisión
            make_thumb(img, img_path.stem)

            # Aplicar cobertura de placa
            img_covered = add_plate_cover(img)

            # Guardar como JPG optimizado
            out_name = img_path.stem + ".jpg"
            out_path = OUTPUT_DIR / out_name
            img_covered.save(out_path, "JPEG", quality=88, optimize=True)
            processed.append(out_name)
            print(f"  OK Saved -> {out_name}")

        except Exception as e:
            print(f"  SKIP {img_path.name}: {e}")
            skipped.append(img_path.name)

    print(f"\n=== DONE ===")
    print(f"Processed: {len(processed)}")
    print(f"Skipped:   {len(skipped)}")
    print(f"\nThumbs saved to: {THUMBS_DIR}")
    print(f"Final images at: {OUTPUT_DIR}")
    print(f"\nProcessed files list:")
    for f in processed:
        print(f"  {f}")

if __name__ == "__main__":
    process_images()
