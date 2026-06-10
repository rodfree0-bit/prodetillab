with open('./landing/blog.html', 'r', encoding='utf-8') as f:
    content = f.read()

for term in ['clean and condition', 'get a free', 'terms of service', 'privacy policy']:
    if term in content.lower():
        print(f"blog.html: Found '{term}'")
