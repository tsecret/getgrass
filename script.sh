docker build -t tsecretino/getgrass:m1 .
docker buildx build --platform linux/amd64 -t tsecretino/getgrass:amd .
docker push tsecretino/getgrass:amd