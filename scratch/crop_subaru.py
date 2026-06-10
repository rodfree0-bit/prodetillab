from PIL import Image

path = r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\media__1780795421438.jpg"
img = Image.open(path)

# Let's crop the detected area and save it
crop_area = (190, 560, 285, 615)
cropped = img.crop(crop_area)
cropped.save("scratch/crop_subaru.jpg")
print("Saved scratch/crop_subaru.jpg")
