#!/usr/bin/env bash
#
# Boot the Docker image on an empty data volume, play it for a moment, stop it
# the way `docker stop` does, and check a new container on the same volume
# still has the account and the world.
#
# The image is published by hand (scripts/docker-build-push.sh), so without this
# a broken Dockerfile would surface only on a maintainer's workstation at
# release time. This is the body of the `docker-smoke` job in
# .github/workflows/ci.yml, so CI and a laptop run the same steps:
#
#   scripts/docker-smoke.sh [IMAGE]
#   pnpm docker:smoke [IMAGE]
#
# With IMAGE, that image is tested as it is; CI builds it first with the buildx
# GitHub Actions cache and passes the tag in. With no argument the Dockerfile at
# the repository root is built for EXPLORE_SMOKE_PLATFORM (default linux/amd64)
# with `--load`, tested, and the tag removed again on the way out.
#
# Either way nothing is pushed anywhere and no registry is logged in to. The
# host needs bash, curl and docker; the WebSocket client runs on the node inside
# the container.
#
# The checks, in order:
#
#   1. GET / answers 200 with the web client, and its script bundle loads.
#   2. A new account signs up, opens its home world over the WebSocket, gets
#      its first screen, and takes a step.
#   3. `docker stop` ends the container with exit code 0 inside its grace
#      period, and leaves no SQLite -wal file behind: the server caught SIGTERM,
#      saved every player and closed every database.
#   4. A new container on the same volume lets the account log in to the same
#      home world, standing where the step left it.
#
# Any other outcome fails the run and prints the container's log. The
# containers and the volume are removed however the run ends.
#
# EXPLORE_SMOKE_PREFIX names the containers, volume and built tag (default
# explore-smoke); a unique suffix is added so parallel runs do not collide.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ROOT
readonly PLATFORM="${EXPLORE_SMOKE_PLATFORM:-linux/amd64}"
readonly PREFIX="${EXPLORE_SMOKE_PREFIX:-explore-smoke}"
readonly NAME="${PREFIX}-$$-${RANDOM}"
readonly VOLUME="${NAME}-data"
readonly USERNAME="smoke"
readonly STEP=4

# How long to wait for GET /: 90 tries, a second apart. The server boots in
# well under a second; the rest is headroom for a slow runner.
readonly READY_TRIES=90
readonly READY_SLEEP=1

# Signs up or logs in, opens the account's home world over the WebSocket and
# prints {home, you, arrival} from the first screen message. With a step, it
# first moves that many pixels east and prints where it ended up. It runs on
# the node inside the container, against the server's own loopback port.
readonly CLIENT=$(
  cat <<'JS'
const [action, username, step] = process.argv.slice(2);
const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const res = await fetch(`${base}/api/${action}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, displayName: username, password: 'correct horse' }),
});
if (!res.ok) fail(`POST /api/${action} answered ${res.status}: ${await res.text()}`);
const { user } = await res.json();
const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

const ws = new WebSocket(`ws://127.0.0.1:${process.env.PORT || 3000}/ws/worlds/${user.home}`, {
  headers: { cookie },
});
const timer = setTimeout(() => fail('no screen message within 10s'), 10_000);
ws.onerror = () => fail('the WebSocket failed');
ws.onclose = (event) => fail(`the WebSocket closed: ${event.code} ${event.reason}`);
ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  if (message.t === 'correct') fail(`the server refused the step: ${event.data}`);
  if (message.t !== 'screen') return;
  clearTimeout(timer);
  let you = message.you;
  if (step) {
    you = { ...you, x: you.x + Number(step), moving: false };
    ws.send(JSON.stringify({ t: 'move', ...you }));
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  ws.onclose = null;
  ws.close();
  console.log(JSON.stringify({ home: user.home, you, arrival: message.arrival }));
  process.exit(0);
};
JS
)

image=""
built_image=""
container=""
volume_created=""

log() {
  printf '\n\033[1m==> %s\033[0m\n' "$*"
}

fail() {
  printf '\033[31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local status=$?

  if [[ -n "${container}" ]]; then
    # The container's own output is only interesting when something went wrong.
    if [[ "${status}" -ne 0 ]]; then
      log "the container said:"
      docker logs "${container}" 2>&1 || true
    fi
    docker rm -f "${container}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${volume_created}" ]]; then
    docker volume rm -f "${VOLUME}" >/dev/null 2>&1 || true
  fi

  if [[ -n "${built_image}" ]]; then
    docker image rm -f "${built_image}" >/dev/null 2>&1 || true
  fi

  if [[ "${status}" -eq 0 ]]; then
    log "docker smoke passed"
  fi
  return "${status}"
}
trap cleanup EXIT

# Starts a container of the image on the data volume, as compose runs it (with
# an init as PID 1), and waits for GET / to answer 200. Sets `container` and
# `base`.
start() {
  local name="$1"
  container="$(docker run --detach \
    --init \
    --name "${name}" \
    --publish 127.0.0.1::3000 \
    --volume "${VOLUME}:/data" \
    "${image}")"

  local hostport
  hostport="$(docker port "${container}" 3000/tcp | head -n 1)"
  [[ -n "${hostport}" ]] || fail "the container published no port for 3000"
  base="http://${hostport}"
  echo "container ${name} is listening on ${base}"

  local ready="" code=""
  for _ in $(seq "${READY_TRIES}"); do
    if [[ "$(docker inspect --format '{{.State.Running}}' "${container}")" != "true" ]]; then
      fail "the container exited before GET / answered"
    fi
    # Silent while it is still starting: "connection refused" is the expected
    # answer for the first moment.
    code="$(curl -s -o /dev/null -w '%{http_code}' "${base}/" 2>/dev/null || true)"
    if [[ "${code}" == "200" ]]; then
      ready=1
      break
    fi
    sleep "${READY_SLEEP}"
  done
  [[ -n "${ready}" ]] || fail "GET / did not answer 200 after ${READY_TRIES} tries (last status: ${code:-none})"
}

# Runs CLIENT inside the container: play ACTION USERNAME [STEP].
play() {
  docker exec -i "${container}" node --input-type=module - "$@" <<<"${CLIENT}"
}

# The value of one top-level field of play's JSON, by name.
field() {
  docker exec -i "${container}" node -e \
    "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.stringify(JSON.parse(s)['$1'])))" \
    <<<"$2"
}

if [[ $# -gt 1 ]]; then
  fail "usage: scripts/docker-smoke.sh [IMAGE]"
fi

docker info >/dev/null 2>&1 || fail "Docker is not running; start it and try again"

if [[ $# -eq 1 && -n "$1" ]]; then
  image="$1"
  docker image inspect "${image}" >/dev/null 2>&1 || fail "no local image ${image}; build it with --load first"
else
  image="${NAME}:local"
  log "building ${image} for ${PLATFORM} from ${ROOT}/Dockerfile"
  built_image="${image}"
  docker buildx build \
    --platform "${PLATFORM}" \
    --file "${ROOT}/Dockerfile" \
    --tag "${image}" \
    --load \
    "${ROOT}" || fail "docker buildx build failed"
fi

docker volume create "${VOLUME}" >/dev/null
volume_created=1

log "starting ${image} on an empty data volume"
start "${NAME}-1"

# `curl -f` exits non-zero on any status that is not a success, and the script
# is `set -e`, so a 404 or a 500 fails the run here.
log "checking the web client is served"
home_page="$(curl -fsS "${base}/")"
grep -qF '<title>Geekity Explore</title>' <<<"${home_page}" \
  || fail "GET / answered 200 but is not the web client"
bundle="$(grep -oE 'src="/assets/[^"]+\.js"' <<<"${home_page}" | head -n 1 | cut -d'"' -f2)"
[[ -n "${bundle}" ]] || fail "GET / names no script bundle"
curl -fsS -o /dev/null "${base}${bundle}"
echo "ok  GET / and GET ${bundle}"

log "signing up and opening the home world over the WebSocket"
first="$(play signup "${USERNAME}" "${STEP}")" || fail "signing up and playing failed"
echo "ok  ${first}"
home="$(field home "${first}")"
you="$(field you "${first}")"

log "stopping the container the way docker stop does"
docker stop --time 10 "${container}" >/dev/null
exit_code="$(docker inspect --format '{{.State.ExitCode}}' "${container}")"
[[ "${exit_code}" == "0" ]] \
  || fail "the server exited with ${exit_code} on SIGTERM, not 0: 143 means no handler ran, 137 that it was killed after the grace period"
echo "ok  exited 0 on SIGTERM"

files="$(docker run --rm --volume "${VOLUME}:/data" --entrypoint ls "${image}" -A /data /data/worlds)" \
  || fail "the data volume holds no main.db and worlds/, so the server wrote somewhere else"
if grep -q -- '-wal$' <<<"${files}"; then
  fail "a SQLite -wal file was left behind, so a database was not closed: ${files}"
fi
grep -qx "${home}.db" <<<"${files}" || fail "no worlds/${home}.db on the volume: ${files}"
echo "ok  main.db and worlds/${home}.db closed, no -wal left"

docker rm "${container}" >/dev/null
container=""

log "starting a new container on the same volume"
start "${NAME}-2"

log "logging in again"
second="$(play login "${USERNAME}")" || fail "logging in and playing failed"
echo "ok  ${second}"
[[ "$(field home "${second}")" == "${home}" ]] || fail "the account's home world changed: ${first} then ${second}"
[[ "$(field you "${second}")" == "${you}" ]] || fail "the player is not where the step left them: ${first} then ${second}"
echo "ok  the account, its world ${home} and the player's position survived the restart"
