# Stage 1: Build React Frontend
FROM node:20-alpine as client-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# Stage 2: Setup Backend
FROM node:20-slim
WORKDIR /app/backend

# Copy backend dependencies
COPY backend/package*.json ./
RUN npm install --production

# Copy backend code
COPY backend ./

# Copy built frontend assets from Stage 1
# Note: The server expects them at ../frontend/dist
COPY --from=client-build /app/frontend/dist ../frontend/dist

# Expose port
EXPOSE 3001

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/catpool.db

# Create directory for sqlite db and set permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Run as non-root user
USER node

CMD ["node", "server.js"]
