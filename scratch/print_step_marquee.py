import json

transcript_path = r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\.system_generated\logs\transcript.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            # Find the step index 2219 or 2225 or any step reading blog.html around that time
            if step.get("step_index") in [2219, 2225, 2236, 2240]:
                print(f"--- Step {step.get('step_index')} ---")
                print(str(step)[:2000])
                print("\n" + "="*80 + "\n")
        except Exception as e:
            pass
