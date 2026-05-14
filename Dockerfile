FROM node:22.19.0-alpine
WORKDIR /wappy-server
COPY ./package*.json .
RUN npm install
COPY . .
CMD ["npm", "start"]
EXPOSE 3000