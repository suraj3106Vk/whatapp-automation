FROM node:20-slim

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src

# Create data directory structure (Railway volume will override /data)
RUN mkdir -p /data && chmod 777 /data

ENV NODE_ENV=production
ENV WHATSAPP_AUTH_PATH=/data/whatsapp-auth
ENV MEMORY_PATH=/data/memory
ENV UPLOADS_PATH=/data/uploads
ENV FILES_PATH=/data/files
ENV SCHEDULER_PATH=/data/scheduler
ENV DATABASE_PATH=/data/database.sqlite

EXPOSE 3001

# Run as root to access Railway volume (Railway handles user permissions)
CMD ["node", "src/index.js"]
