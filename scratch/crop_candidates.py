from PIL import Image

# 1. Jeep background truck crop
try:
    img_jeep = Image.open(r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421446.jpg")
    # Crop the blue truck in the background on the right
    crop_jeep = img_jeep.crop((650, 360, 768, 470))
    crop_jeep.save("scratch/crop_jeep_truck.jpg")
    print("Saved scratch/crop_jeep_truck.jpg")
except Exception as e:
    print("Error cropping Jeep:", e)

# 2. Chevy pickup bumper crop
try:
    img_chevy = Image.open(r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421389.jpg")
    # Chevy is facing left. Crop the front bumper area on the left
    # Image size: 1024x873
    crop_chevy = img_chevy.crop((50, 500, 300, 700))
    crop_chevy.save("scratch/crop_chevy_bumper.jpg")
    print("Saved scratch/crop_chevy_bumper.jpg")
except Exception as e:
    print("Error cropping Chevy:", e)

# 3. Tesla interior background cars crop
try:
    img_tesla = Image.open(r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421394.jpg")
    # Windshield view shows cars in front. Image size: 1024x768
    crop_tesla = img_tesla.crop((450, 0, 700, 250))
    crop_tesla.save("scratch/crop_tesla_cars.jpg")
    print("Saved scratch/crop_tesla_cars.jpg")
except Exception as e:
    print("Error cropping Tesla:", e)
