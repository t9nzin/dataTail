FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
