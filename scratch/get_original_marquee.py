import json

transcript_path = r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\.system_generated\logs\transcript.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            if step.get("step_index") in [2280, 2281]:
                print(f"--- Step {step.get('step_index')} ---")
                print(json.dumps(step, indent=2))
                print("\n" + "="*80 + "\n")
        except Exception as e:
            pass
