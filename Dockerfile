FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY user_icon.png ./user_icon.png
COPY apps ./apps

ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build -w apps/api && npm run build -w apps/web


FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV WEB_PORT=4173

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/user_icon.png ./user_icon.png

RUN mkdir -p /app/apps/api/uploads/avatars

COPY docker/start.sh /app/docker/start.sh
RUN chmod +x /app/docker/start.sh

VOLUME ["/app/apps/api/uploads"]

EXPOSE 4000
EXPOSE 4173

CMD ["/app/docker/start.sh"]
