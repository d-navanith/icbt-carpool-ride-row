# ==========================================
# Ride Row - Full Stack Production Image
# ==========================================

# ---------- Stage 1: Frontend build ----------
FROM node:24-bookworm-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

RUN npm run build


# ---------- Stage 2: Backend runtime ----------
FROM node:24-bookworm-slim

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=5000

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Copy built frontend into backend public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# Runtime database directory
RUN mkdir -p /app/backend/data

EXPOSE 5000

CMD ["node", "src/server.js"]