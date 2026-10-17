FROM node:22-bookworm-slim

WORKDIR /app
COPY server/package*.json ./server/
RUN npm --prefix server install --omit=dev
COPY index.html ./index.html
COPY server/server.js ./server/server.js
ENV PORT=80 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 80
CMD ["node", "server/server.js"]
