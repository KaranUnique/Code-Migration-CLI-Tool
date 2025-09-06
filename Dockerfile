# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Create volume for user code
VOLUME ["/workspace"]

# Set default working directory for mounted code
WORKDIR /workspace

# Set entrypoint to the CLI tool
ENTRYPOINT ["node", "/app/index.js"]

# Default command shows help
CMD ["--help"]