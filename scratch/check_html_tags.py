def check_html_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We will search for <div> and </div> tags and print their balance
    import re
    # Simple regex to find html tags
    tags = re.findall(r'<(/?[a-zA-Z0-9]+)(?:\s+[^>]*)?>', content)
    
    stack = []
    errors = []
    
    for tag in tags:
        tag_name = tag.lower()
        if tag_name.startswith('/'):
            closed_name = tag_name[1:]
            if not stack:
                errors.append(f"Unexpected closing tag: </{closed_name}>")
            else:
                opened_name = stack.pop()
                if opened_name != closed_name:
                    errors.append(f"Mismatched tag: opened <{opened_name}>, closed </{closed_name}>")
        else:
            # Ignore self-closing tags like img, input, br, hr, link, meta
            if tag_name not in ['img', 'input', 'br', 'hr', 'link', 'meta', 'col', 'embed', 'source']:
                stack.append(tag_name)
                
    print(f"Checking {file_path}:")
    print(f"Remaining open tags in stack: {stack}")
    print(f"Errors found: {errors}")

check_html_balance('./landing/blog.html')
