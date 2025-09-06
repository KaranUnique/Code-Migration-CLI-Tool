# Docker Image Size Optimization Guide

## Current Issue
- Your image is ~200MB
- Docker Hub free tier supports images up to **10GB** (not 100MB)
- But smaller images are better for users (faster downloads, less storage)

## Optimization Strategies

### 1. Use Multi-Stage Build (Dockerfile - Updated)
```bash
# Build optimized image
docker build -t code-migration-cli:optimized .

# Check size
docker images code-migration-cli:optimized
```

### 2. Use Ultra-Minimal Build (Dockerfile.minimal)
```bash
# Build minimal image
docker build -f Dockerfile.minimal -t code-migration-cli:minimal .

# Check size difference
docker images | grep code-migration-cli
```

### 3. Size Comparison Commands
```bash
# Check current image size
docker images code-migration-cli:latest

# Check what's taking space
docker history code-migration-cli:latest

# Analyze layers
docker run --rm -it wagoodman/dive code-migration-cli:latest
```

## Expected Size Reductions

| Version | Size | Reduction |
|---------|------|-----------|
| Original | ~200MB | - |
| Multi-stage | ~80-120MB | 40-60% |
| Minimal | ~50-80MB | 60-75% |
| Distroless | ~30-50MB | 75-85% |

## Advanced Optimization: Distroless Image

### Create Dockerfile.distroless
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage with distroless
FROM gcr.io/distroless/nodejs18-debian11
COPY --from=builder /app/node_modules /app/node_modules
COPY package*.json /app/
COPY index.js /app/
COPY lib/ /app/lib/
COPY rules.json /app/
WORKDIR /workspace
ENTRYPOINT ["node", "/app/index.js"]
CMD ["--help"]
```

## Build Commands for All Versions

### Standard Optimized
```bash
docker build -t yourusername/code-migration-cli:latest .
```

### Minimal Version
```bash
docker build -f Dockerfile.minimal -t yourusername/code-migration-cli:minimal .
```

### Distroless Version
```bash
docker build -f Dockerfile.distroless -t yourusername/code-migration-cli:distroless .
```

## Publishing Strategy

### Option 1: Multiple Tags
```bash
# Push different sizes for different use cases
docker push yourusername/code-migration-cli:latest      # ~80MB
docker push yourusername/code-migration-cli:minimal     # ~50MB
docker push yourusername/code-migration-cli:distroless  # ~30MB
```

### Option 2: Use Minimal as Default
```bash
# Use minimal as the main image
docker tag yourusername/code-migration-cli:minimal yourusername/code-migration-cli:latest
docker push yourusername/code-migration-cli:latest
```

## Size Analysis Tools

### 1. Check Layer Sizes
```bash
docker history yourusername/code-migration-cli:latest --human --format "table {{.CreatedBy}}\t{{.Size}}"
```

### 2. Use Dive Tool (Advanced)
```bash
# Install dive
docker pull wagoodman/dive

# Analyze your image
docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock wagoodman/dive yourusername/code-migration-cli:latest
```

### 3. Compare Sizes
```bash
# List all versions
docker images | grep code-migration-cli

# Get exact sizes
docker inspect yourusername/code-migration-cli:latest | grep Size
```

## Docker Hub Limits (Clarification)

| Account Type | Image Size Limit | Bandwidth |
|--------------|------------------|-----------|
| Free | 10GB per image | 200GB/month |
| Pro | 10GB per image | 5TB/month |
| Team | 10GB per image | 5TB/month |

**Your 200MB image is well within limits!** But optimization still helps users.

## User Benefits of Smaller Images

✅ **Faster downloads** - Less waiting time  
✅ **Less storage** - Saves disk space  
✅ **Faster CI/CD** - Quicker builds  
✅ **Better UX** - Users prefer lightweight tools  
✅ **Lower bandwidth** - Important for mobile/limited connections  

## Recommended Approach

1. **Use the multi-stage Dockerfile** (already updated)
2. **Test the minimal version** for even smaller size
3. **Publish both versions** - let users choose
4. **Document the difference** in your README

## Testing Optimized Images

```bash
# Test functionality is preserved
docker run --rm -v ${PWD}:/workspace yourusername/code-migration-cli:minimal ./examples/sample-project/src --extensions js,py --dry-run

# Verify all features work
docker run --rm yourusername/code-migration-cli:minimal --help
```

Your image will go from 200MB → ~50-80MB! 🚀