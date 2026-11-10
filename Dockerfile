FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
# The server requires gambler-rules.js at startup. Include it in the image.
COPY server.js gambler-rules.js casino-judas-rules.js ./
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
