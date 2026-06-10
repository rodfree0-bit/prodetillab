import re

with open('./landing/blog.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

stack = []
for idx, line in enumerate(lines):
    line_num = idx + 1
    # Find all html tags in this line
    tags = re.findall(r'<(/?[a-zA-Z0-9]+)(?:\s+[^>]*)?>', line)
    for tag in tags:
        tag_name = tag.lower()
        if tag_name.startswith('/'):
            closed_name = tag_name[1:]
            if not stack:
                print(f"Line {line_num}: ERROR: Unexpected closing tag </{closed_name}>")
            else:
                opened_name = stack.pop()
                if opened_name != closed_name:
                    print(f"Line {line_num}: ERROR: Mismatched tag: opened <{opened_name}>, closed </{closed_name}>. Stack: {stack + [opened_name]}")
                    stack.append(opened_name) # put it back to avoid cascading errors
        else:
            if tag_name not in ['img', 'input', 'br', 'hr', 'link', 'meta', 'col', 'embed', 'source']:
                stack.append(tag_name)
