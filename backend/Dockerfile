FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@latest && npm install

COPY . ./

EXPOSE 3001

CMD ["node", "server.js"] 