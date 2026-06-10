import json

transcript_path = r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\.system_generated\logs\transcript.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            step = json.loads(line)
            content = str(step)
            if "blog.html" in content and "view_file" in content:
                print(f"Line {i}, Step {step.get('step_index')}, Type: {step.get('type')}")
        except Exception as e:
            pass
