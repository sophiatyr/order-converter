FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server/ ./server/
COPY dist/ ./dist/
ENV NODE_ENV=production DATA_DIR=/data WEB_ROOT=/app/dist PORT=8888
EXPOSE 8888
CMD ["node", "server/nasServer.mjs"]
