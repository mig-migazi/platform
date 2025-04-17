# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Upgrade npm to latest version
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./

# Install dependencies with legacy peer deps to reduce warnings
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Set API URL for production build
ENV REACT_APP_API_URL=http://localhost:3001

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 