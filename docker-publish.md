# Docker Hub Publishing Guide

## Prerequisites
1. Docker installed and running
2. Docker Hub account created
3. Docker CLI logged in: `docker login`

## Build and Test Locally

### 1. Build the Docker image
```bash
docker build -t code-migration-cli:latest .
```

### 2. Test the image locally
```bash
# Test help command
docker run --rm code-migration-cli:latest --help

# Test with sample files (mount current directory)
docker run --rm -v ${PWD}:/workspace code-migration-cli:latest ./examples/sample-project/src --extensions js,py --dry-run

# Interactive mode for testing
docker run --rm -it -v ${PWD}:/workspace --entrypoint /bin/sh code-migration-cli:latest
```

## Publish to Docker Hub

### 1. Tag the image for Docker Hub
```bash
# Replace 'yourusername' with your Docker Hub username
docker tag code-migration-cli:latest yourusername/code-migration-cli:latest
docker tag code-migration-cli:latest yourusername/code-migration-cli:1.0.0
```

### 2. Push to Docker Hub
```bash
docker push yourusername/code-migration-cli:latest
docker push yourusername/code-migration-cli:1.0.0
```

## Usage Examples for End Users

### Basic usage
```bash
# Scan code in current directory
docker run --rm -v ${PWD}:/workspace yourusername/code-migration-cli:latest . --extensions js,py --dry-run

# Fix code with backup
docker run --rm -v ${PWD}:/workspace yourusername/code-migration-cli:latest . --extensions js,py --fix --yes
```

### Advanced usage
```bash
# Use custom rules
docker run --rm -v ${PWD}:/workspace yourusername/code-migration-cli:latest . --rules ./custom-rules.json --extensions js --dry-run

# Verbose output
docker run --rm -v ${PWD}:/workspace yourusername/code-migration-cli:latest . --extensions js,py --verbose --dry-run
```

## Docker Compose Usage

### Run with docker-compose
```bash
# Run the default scan
docker-compose up code-migration-cli

# Development mode
docker-compose run code-migration-dev
```

## Automated Publishing with GitHub Actions

Create `.github/workflows/docker-publish.yml`:

```yaml
name: Docker Publish

on:
  push:
    tags: ['v*']
  release:
    types: [published]

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: yourusername/code-migration-cli
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

## Security Best Practices

1. **Use non-root user** ✅ (Already implemented)
2. **Minimal base image** ✅ (Using Alpine)
3. **Multi-stage builds** (Optional for smaller images)
4. **Scan for vulnerabilities**:
   ```bash
   docker scout quickview code-migration-cli:latest
   ```

## Image Size Optimization

Current image is optimized with:
- Alpine Linux base (smaller footprint)
- Production dependencies only
- .dockerignore to exclude unnecessary files

## Maintenance

### Update image versions
1. Update package.json version
2. Build new image with version tag
3. Push both latest and version-specific tags
4. Update documentation

### Monitor image
- Set up automated security scanning
- Monitor download statistics on Docker Hub
- Keep base image updated