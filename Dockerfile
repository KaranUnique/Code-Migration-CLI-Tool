# Multi-stage build for smaller image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Remove dev dependencies and clean npm cache
RUN npm prune --production && \
    npm cache clean --force

# Production stage - smaller final image
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy only production files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs index.js ./
COPY --chown=nodejs:nodejs lib/ ./lib/
COPY --chown=nodejs:nodejs rules.json ./
COPY --chown=nodejs:nodejs config/ ./config/

# Switch to non-root user
USER nodejs

# Create volume for user code
VOLUME ["/workspace"]

# Set default working directory for mounted code
WORKDIR /workspace

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "node", "/app/index.js"]

# Default command shows help
CMD ["--help"]