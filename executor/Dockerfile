FROM node:18-slim

# Install Python 3 and iptables (for network isolation)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 iptables && \
    rm -rf /var/lib/apt/lists/*

# Install TypeScript runner (tsx) globally
RUN npm install -g tsx typescript

# Create non-root user for executing untrusted code
RUN useradd --create-home --shell /bin/bash executor

WORKDIR /app
COPY server.js ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Restrict filesystem: executor can't read server code or sensitive files
RUN chmod 700 /app && \
    chmod o-r /etc/passwd /etc/shadow /etc/group

EXPOSE 8080
ENTRYPOINT ["./entrypoint.sh"]
