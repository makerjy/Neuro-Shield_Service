FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG BASE_PATH=/neuro-shield/
ENV VITE_BASE_PATH=${BASE_PATH}
RUN npm run build

FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=frontend-builder /app/build /usr/share/nginx/html

EXPOSE 80
