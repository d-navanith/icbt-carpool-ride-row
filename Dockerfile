# Multi-stage Docker build for ICBT Campus Carpooling Application
# Stage 1: Build Frontend Client
FROM node:20-alpine AS client-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build and Run Backend Server
FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Copy built frontend client assets to server static directory
COPY --from=client-builder /app/frontend/dist /app/backend/public

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
