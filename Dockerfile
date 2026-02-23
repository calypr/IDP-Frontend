# docker build -t ff .
# docker run -p 3000:3000 -it ff

FROM node:22-slim AS builder
WORKDIR /gen3

# Copy everything
COPY . .

# Install deps (workspace aware)
RUN npm install --location=global lerna@^8.1.8
RUN npm ci --include=optional

# Build all packages (lerna monorepo)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN lerna run build --concurrency=1 --stream

FROM node:22-alpine3.20 AS runner
WORKDIR /gen3
RUN apk add --no-cache bash

# Create non-root user
RUN addgroup -S nextjs -g 1001 && adduser -S nextjs -u 1001

# This already contains required node_modules subset
COPY --from=builder --chown=nextjs:nextjs /gen3/packages/sampleCommons/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /gen3/packages/sampleCommons/.next/static ./packages/sampleCommons/.next/static

# Copy runtime assets
COPY --from=builder --chown=nextjs:nextjs /gen3/packages/sampleCommons/config ./packages/sampleCommons/config
COPY --from=builder --chown=nextjs:nextjs /gen3/packages/sampleCommons/public ./packages/sampleCommons/public

# Startup script
COPY --from=builder /gen3/start.sh ./start.sh
RUN chmod +x start.sh

# Optional runtime mounts
RUN ln -s /gen3/config packages/sampleCommons/config || true
RUN ln -s /gen3/public packages/sampleCommons/public || true

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["/bin/bash", "./start.sh"]