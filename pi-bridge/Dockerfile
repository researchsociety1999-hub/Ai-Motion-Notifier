FROM node:20-alpine

# Install FFmpeg for RTSP video frame extraction
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY index.js ./

CMD ["node", "index.js"]
