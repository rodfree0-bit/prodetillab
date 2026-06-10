import os
import requests
import json
import time
from pathlib import Path

candidates_dir = Path(r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\scratch\candidates")
output_file = Path(r"C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\scratch\ocr_results_api.json")

candidates = list(candidates_dir.glob("*.jpg"))
print(f"Total candidates to OCR: {len(candidates)}")

url = "https://api.ocr.space/parse/image"
apikey = "helloworld"  # Default free tier key

results = {}

for i, cand_path in enumerate(candidates):
    print(f"[{i+1}/{len(candidates)}] Running OCR on {cand_path.name}...")
    try:
        with open(cand_path, "rb") as f:
            files = {"file": f}
            data = {
                "apikey": apikey,
                "language": "eng",
                "isOverlayRequired": "false",
                "OCREngine": "2"  # Engine 2 is faster and better for single words/numbers
            }
            response = requests.post(url, files=files, data=data, timeout=15)
            
        if response.status_code == 200:
            res_json = response.json()
            # Check parsed text
            parsed_results = res_json.get("ParsedResults", [])
            if parsed_results:
                text = parsed_results[0].get("ParsedText", "").strip()
                if text:
                    # Clean the text (remove non-alphanumeric)
                    cleaned = "".join(c for c in text if c.isalnum())
                    if len(cleaned) >= 3:
                        print(f"  -> SUCCESS: '{text}' (Cleaned: {cleaned})")
                        results[cand_path.name] = {
                            "text": text,
                            "cleaned": cleaned
                        }
                    else:
                        print(f"  -> Too short or no alpha-numeric: '{text}'")
                else:
                    print("  -> No text parsed.")
            else:
                print(f"  -> Error from API: {res_json.get('ErrorMessage', 'Unknown error')}")
        else:
            print(f"  -> HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"  -> Exception: {e}")
        
    # Sleep to respect rate limits (free key is 1 request per 3-5 seconds max)
    time.sleep(2.0)

with open(output_file, "w") as f:
    json.dump(results, f, indent=4)
print(f"OCR complete. Saved results to {output_file}")
