import os

print("Files in ./landing:")
print(os.listdir('./landing'))

with open('./landing/blog.html', 'r', encoding='utf-8') as f:
    blog_content = f.read().lower()

print(f"blog.html length: {len(blog_content)}")
print(f"Contains subaru: {'subaru' in blog_content}")
print(f"Contains jeep: {'jeep' in blog_content}")
print(f"Contains tesla: {'tesla' in blog_content}")
