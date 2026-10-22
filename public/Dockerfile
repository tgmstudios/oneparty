# build stage: Vue + Vite
FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js index.html ./
COPY src ./src
COPY static ./static
RUN npm run build

# runtime stage: the server has no dependencies, only the built site
FROM node:22-alpine
WORKDIR /app
COPY package.json app.mjs server.mjs ./
COPY --from=build /build/web ./web
# a fresh named volume copies this directory's ownership, so the unprivileged user can write to it
RUN mkdir /data && chown node:node /data
ENV PORT=8080 DATA_DIR=/data TRUST_PROXY=1
VOLUME /data
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.mjs"]
