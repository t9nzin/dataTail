# Use your base image, e.g., node:24-slim
FROM node:24-slim

# Install system dependencies needed for node-gyp / native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    libcairo2-dev \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Set python path so node-gyp can find it
ENV PYTHON=/usr/bin/python3

# Copy package files first for caching
WORKDIR /app
COPY package*.json ./

# Install Node dependencies
RUN npm ci

# Copy the rest of your app
COPY . .

# Command
CMD ["npm", "start"]
