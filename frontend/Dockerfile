# Build stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

# Start in development mode
CMD ["npm", "start"] 