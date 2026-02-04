FROM node:20-alpine
WORKDIR /app

# Copy backend package files
COPY backend/package.json backend/package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy backend source
COPY backend/src ./src

# Copy cron script
COPY cron/sync.js ./sync.js

# Run sync script
CMD ["node", "sync.js"]
