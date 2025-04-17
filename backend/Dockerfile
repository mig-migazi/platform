FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package*.json ./
RUN npm install -g npm@latest && npm install

COPY . ./

EXPOSE 3001

CMD ["node", "server.js"] 