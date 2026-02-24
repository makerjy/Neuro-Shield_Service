FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG BASE_PATH=/neuro-shield/
ARG VITE_API_BASE_URL=
ARG VITE_SMS_API_BASE_URL=
ARG VITE_STAGE1_CENTER_PHONE=
ARG VITE_STAGE1_DEMO_LINK=
ARG VITE_CITIZEN_DEMO_TOKEN=
ARG VITE_CITIZEN_ENTRY_URL=
ARG VITE_THREE_STEP_MODEL_ENTRY_URL=
ENV VITE_BASE_PATH=${BASE_PATH}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SMS_API_BASE_URL=${VITE_SMS_API_BASE_URL}
ENV VITE_STAGE1_CENTER_PHONE=${VITE_STAGE1_CENTER_PHONE}
ENV VITE_STAGE1_DEMO_LINK=${VITE_STAGE1_DEMO_LINK}
ENV VITE_CITIZEN_DEMO_TOKEN=${VITE_CITIZEN_DEMO_TOKEN}
ENV VITE_CITIZEN_ENTRY_URL=${VITE_CITIZEN_ENTRY_URL}
ENV VITE_THREE_STEP_MODEL_ENTRY_URL=${VITE_THREE_STEP_MODEL_ENTRY_URL}
RUN npm --prefix 3-step_model_final ci
RUN npm run build
RUN THREE_STEP_MODEL_BASE_PATH="${BASE_PATH%/}/3-step-model/" npm --prefix 3-step_model_final run build

FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=frontend-builder /app/build /usr/share/nginx/html
COPY --from=frontend-builder /app/3-step_model_final/dist /usr/share/nginx/html/3-step-model
COPY --from=frontend-builder /app/3-step_model_final/stage3_final/stage_3_cnn/stage3-cnn-explainer/backend/assets/samples /usr/share/nginx/html/3-step-model/assets/mri/samples
COPY --from=frontend-builder /app/3-step_model_final/stage3_final/stage_3_cnn/TEST_IMAGE /usr/share/nginx/html/3-step-model/assets/mri/test_image

EXPOSE 80
