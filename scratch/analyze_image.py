from PIL import Image, ImageDraw

images = {
    "jeep": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421446.jpg",
    "jaguar": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421381.jpg",
    "chevy": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421389.jpg",
    "tesla_int": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421394.jpg",
    "subaru": r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421438.jpg"
}

for name, path in images.items():
    try:
        img = Image.open(path)
        width, height = img.size
        print(f"Image {name}: {width}x{height}")
        
        grid_img = img.copy()
        draw = ImageDraw.Draw(grid_img)
        
        # Grid lines every 100 pixels
        for x in range(0, width, 100):
            draw.line([(x, 0), (x, height)], fill="red", width=2)
            draw.text((x + 5, 10), str(x), fill="red")
                
        for y in range(0, height, 100):
            draw.line([(0, y), (width, y)], fill="red", width=2)
            draw.text((10, y + 5), str(y), fill="red")
                
        grid_img.save(f"scratch/grid_{name}.jpg")
        print(f"Saved scratch/grid_{name}.jpg")
    except Exception as e:
        print(f"Error processing {name}: {e}")
