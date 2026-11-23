FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=8083 NODE_ENV=production
EXPOSE 8083
CMD ["node", "autosale/server.js"]
