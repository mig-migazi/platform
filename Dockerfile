# Build frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install -g npm@latest && npm install
COPY frontend/ ./
RUN npm run build

# Build backend
FROM node:20-alpine as backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install -g npm@latest && npm install
COPY backend/ ./

# Final stage
FROM node:20-alpine
WORKDIR /app

# Copy built frontend
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Copy backend
COPY --from=backend-builder /app/backend ./backend

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"] 