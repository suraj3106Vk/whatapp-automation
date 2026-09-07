# ── SK Agent — Render-ready Dockerfile ────────────────────────────────────────
FROM node:20-bookworm-slim

# Install Chromium + dependencies + network tools for WhatsApp connectivity
RUN apt-get update && apt-get install -y --fix-missing \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    wget \
    dnsutils \
    iputils-ping \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Use system Chromium, skip Puppeteer's own download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create crash-reporter temp dir and give node user access
# The built-in 'node' user (uid 1000) from node:bookworm-slim is the right user
RUN mkdir -p /tmp/chromium-crashes \
    && chown -R node:node /tmp/chromium-crashes

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/src ./src

# Create directories that need write access and set permissions
RUN mkdir -p /app/.wwebjs_auth /app/uploads \
    && chown -R node:node /app

# Railway volumes are mounted as root, so we need to run as root for write access
# In production cloud environments, this is acceptable for containers
# Local dev still works fine with node user
USER root

EXPOSE 3001
CMD ["node", "src/index.js"]
