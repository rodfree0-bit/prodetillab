import json

transcript_path = r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\.system_generated\logs\transcript.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            content = str(step)
            if "brands" in content.lower() and "marquee" in content.lower():
                print(f"Step {step.get('step_index')}")
                # Print any matching tool call or output fragment
                # Let's search for snippet of HTML code
                idx = content.lower().find("marquee")
                print(content[max(0, idx-200):min(len(content), idx+500)])
                print("*" * 80)
        except Exception as e:
            pass
