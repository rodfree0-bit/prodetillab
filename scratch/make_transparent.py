import os
from PIL import Image

logos = ["gtechniq", "adams", "meguiars", "rupes", "sonax", "carpro", "chemicalguys"]

for name in logos:
    path = f"landing/assets/logo_{name}.png"
    if not os.path.exists(path):
        continue
    try:
        img = Image.open(path).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        for item in datas:
            # If the pixel is close to white (R, G, B > 230), make it transparent
            if item[0] > 230 and item[1] > 230 and item[2] > 230:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        img.save(path, "PNG")
        print(f"Processed transparency for logo_{name}.png")
    except Exception as e:
        print(f"Error processing logo_{name}: {e}")
