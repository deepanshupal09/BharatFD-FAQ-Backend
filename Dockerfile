FROM node:20.17.0

WORKDIR /

COPY package*.json /
RUN npm install
RUN npm install --save-dev typescript

COPY . /

# Debugging commands
RUN npx tsc --version
RUN ls -la /
RUN npm run build

CMD ["node", "dist/server.js"]
