# =========================================================
# ICBT CAMPUS CARPOOL - BACKEND DOCKERFILE
# =========================================================

FROM node:24-alpine

# Application directory
WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./

RUN npm ci --omit=dev

# Copy backend source
COPY src ./src
COPY public ./public
COPY schema.sql ./
COPY openapi.json ./

# Create SQLite runtime data directory
RUN mkdir -p /app/data

# Application port
EXPOSE 5000

# Production environment
ENV NODE_ENV=production

# Start backend
CMD ["node", "src/server.js"]