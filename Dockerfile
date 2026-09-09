FROM node:20-slim

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
RUN mkdir -p /data /app/uploads && chown -R node:node /app /data

ENV NODE_ENV=production
ENV WHATSAPP_AUTH_PATH=/data/whatsapp-auth
ENV MEMORY_PATH=/data/memory
ENV UPLOADS_PATH=/data/uploads
ENV FILES_PATH=/data/files
ENV SCHEDULER_PATH=/data/scheduler
ENV DATABASE_PATH=/data/database.sqlite

EXPOSE 3001
USER node
CMD ["node", "src/index.js"]
