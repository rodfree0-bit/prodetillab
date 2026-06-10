import re

def fix_path(match):
    attr = match.group(1)
    path = match.group(2)
    if path.startswith(('http', '/', '#', '..')):
        return f'{attr}="{path}"'
    return f'{attr}="../{path}"'

test_content = '<img src="logoasset.png?v=3" alt="Pro Detail Lab">'
result = re.sub(r'(src|href)="([^"]*)"', fix_path, test_content)
print(f"Original: {test_content}")
print(f"Result: {result}")
