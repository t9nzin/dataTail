FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# If you build TS → add: RUN npm run build (but since dev mode, probably not)

EXPOSE 3000
CMD ["node", "index.js"]  # or ["npm", "run", "start"] / dev script if watch needed
