# ---- Builder ----
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . ./
RUN npm run build

# ---- Release ----
FROM node:24-alpine AS release

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/build ./build
COPY entrypoint.sh ./

ENV NODE_ENV=production
RUN TMPDIR=$(mktemp -d)
ENV TMPDIR=$TMPDIR

RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
RUN chmod +x entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
