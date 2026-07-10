ARG NODE_VERSION=20
ARG PNPM_VERSION=9.15.9

FROM node:${NODE_VERSION}-alpine

ARG PNPM_VERSION
RUN npm install --global pnpm@${PNPM_VERSION} \
    && pnpm --version \
    && node --version

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --no-optional

COPY . .

EXPOSE 3000

USER appuser

CMD ["pnpm", "start:dev"]
