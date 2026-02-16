FROM node:18-slim

# Install Python 3
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 && \
    rm -rf /var/lib/apt/lists/*

# Install TypeScript runner (tsx) globally
RUN npm install -g tsx typescript

WORKDIR /app
COPY server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
