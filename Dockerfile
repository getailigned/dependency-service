# Dependency Service Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy pre-built shared package
COPY shared-temp/dist ./shared/
COPY shared-temp/package.json ./shared/

# Copy package files
COPY package.json ./

# Install dependencies (npm install is more forgiving than npm ci)
RUN npm install

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the service
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 3002

CMD ["node", "dist/index.js"]