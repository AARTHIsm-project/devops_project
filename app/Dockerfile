# ---------- Stage 1: build & test ----------
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm test

# ---------- Stage 2: production image ----------
FROM node:18-alpine AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Install only production deps for a lean final image
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src

# Run as non-root user (built into the node:alpine image)
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/index.js"]
