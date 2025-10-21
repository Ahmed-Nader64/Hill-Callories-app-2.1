# Use Node.js 20 Alpine as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Install a simple HTTP server
RUN npm install -g serve

# Create a startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'serve -s dist -l ${PORT:-3000}' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 3000

# Start the application
CMD ["/app/start.sh"]
