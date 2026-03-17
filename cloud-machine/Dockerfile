FROM ubuntu:24.04

# Dev tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git build-essential python3 python3-pip golang-go rustc cargo \
    docker.io iptables sudo ca-certificates gnupg && \
    rm -rf /var/lib/apt/lists/*

# Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*

# Fly CLI + Wrangler for deploy
RUN curl -L https://fly.io/install.sh | sh
RUN npm install -g wrangler tsx typescript

# Create dev user
RUN useradd -m -s /bin/bash dev && echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# WebSocket bridge server
WORKDIR /opt/bridge
COPY bridge/ ./
RUN npm install --production

USER dev
WORKDIR /home/dev/workspace

EXPOSE 8080
CMD ["node", "/opt/bridge/server.js"]
