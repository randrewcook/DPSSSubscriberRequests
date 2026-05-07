FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=app:app . .

USER app

EXPOSE 3012
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
	CMD node -e "require('http').get('http://127.0.0.1:3012/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"
CMD ["node", "src/server.js"]
