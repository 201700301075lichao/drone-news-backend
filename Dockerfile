FROM node:latest
WORKDIR /root/app
RUN npm install 
EXPOSE 3000
CMD ["node","mysql.js"]

