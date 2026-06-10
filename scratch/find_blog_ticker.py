import json

transcript_path = r"C:\Users\cramr\.gemini\antigravity\brain\84de2f6b-430e-4771-ba21-15de0b7643e2\.system_generated\logs\transcript.jsonl"

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            # Find the original brand-ticker or marquee in blog.html
            if step.get("type") == "PLANNER_RESPONSE":
                content = str(step)
                if "brand-ticker" in content or "brand-logos" in content:
                    print(f"Step {step.get('step_index')}")
                    # Look for replacement content or matching lines
                    for tc in step.get("tool_calls", []):
                        if tc.get("name") in ["replace_file_content", "write_to_file", "view_file"]:
                            print(f"Tool call: {tc.get('name')}")
                            args = tc.get("arguments", {})
                            print(f"TargetFile: {args.get('TargetFile')}")
                            print(f"TargetContent: {args.get('TargetContent')}")
                            print(f"ReplacementContent: {args.get('ReplacementContent')}")
                            print("=" * 60)
        except Exception as e:
            pass
