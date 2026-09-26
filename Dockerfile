# Geekity Explore: one Node process serving the built web client, the JSON API
# and the world WebSockets on PORT, with accounts and worlds under DATA_DIR.
#
# The base tag is PINNED to the Node .nvmrc names (24), at the minor and patch
# the workspace is developed on. `node:24-*` floats, and a rebuild months from
# now would silently pull a different Node under node:sqlite and type stripping.
#
# No runtime dependency is native, so nothing ties the image to glibc. Debian
# slim matches the Geekity CMS image.
ARG NODE_IMAGE=node:24.18.0-trixie-slim


FROM ${NODE_IMAGE} AS deps

WORKDIR /workspace

# pnpm at the version packageManager in package.json names.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# The dependency layer. `pnpm fetch` reads only the lockfile, and package.json
# comes with it only so corepack picks the pnpm its packageManager names. The
# layer, and the store it fills, is reused until either file changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch

# Every workspace manifest, because a frozen install checks each importer the
# lockfile names.
COPY packages/core/package.json packages/core/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json


FROM deps AS build

# --ignore-scripts: no dependency needs an install script. Vite's one native
# piece, the rolldown binding, is a per-platform optional package.
RUN pnpm install --offline --frozen-lockfile --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/web apps/web

RUN pnpm --filter @explore/web build


# The production dependencies of the server and of @explore/core, which it
# imports, and nothing else: hono, @hono/node-server, @hono/node-ws, ws and zod.
# `pnpm fetch` leaves every package of the lockfile in node_modules/.pnpm, and
# an install on top of it keeps them all, so this one starts from none.
FROM deps AS prod-deps

RUN rm -rf node_modules \
  && pnpm install --offline --frozen-lockfile --ignore-scripts --prod --filter @explore/server...


FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production

WORKDIR /app

# The workspace layout, not a `pnpm deploy` bundle. Node runs the server's
# TypeScript by stripping its types, and it refuses to strip a file under
# node_modules, which is where a deployed copy of @explore/core would land.
# Kept here, node_modules/@explore/core is a symlink that resolves to
# packages/core/src, outside node_modules. main.ts finds the web client at
# ../../web/dist from its own directory.
COPY --from=prod-deps /workspace/node_modules node_modules
COPY --from=prod-deps /workspace/packages/core/node_modules packages/core/node_modules
COPY --from=prod-deps /workspace/apps/server/node_modules apps/server/node_modules
COPY packages/core/package.json packages/core/package.json
COPY packages/core/src packages/core/src
COPY apps/server/package.json apps/server/package.json
COPY apps/server/src apps/server/src
COPY --from=build /workspace/apps/web/dist apps/web/dist

# The tests are not the server's to run.
RUN find packages/core/src apps/server/src -name '*.test.ts' -delete \
  && mkdir -p /data \
  && chown node:node /data

# One directory for everything the server writes: main.db and worlds/<id>.db. A
# fresh named volume mounted here starts owned by node; a bind mount has to be
# owned by uid 1000 on the host.
ENV DATA_DIR=/data \
  PORT=3000

# Runs unprivileged, as the uid 1000 the base image ships as `node`.
USER node

EXPOSE 3000

# Only the status code is read. GET / answers with the web client, so a 200
# means the process is up and serving. The port is read inside node, from PORT,
# because a `$PORT` in compose would be substituted from the host's environment.
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --start-interval=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# node itself, not `pnpm start`: SIGTERM reaches the server, which saves every
# player and closes each database before it exits. Run it with an init (compose
# `init: true`, `docker run --init`) so zombies are reaped.
CMD ["node", "apps/server/src/main.ts"]
