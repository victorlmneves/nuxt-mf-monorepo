#!/usr/bin/env bash
set -euo pipefail

# start-local.sh
# Inicia host + remotes em background e grava logs em ./logs

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
LOG_DIR="$ROOT_DIR/logs"
# Configuráveis via env vars
# HEALTH_TIMEOUT: timeout total para cada health check (segundos)
# BASE_BACKOFF: delay base para exponential backoff (segundos)
# MAX_BACKOFF: delay máximo entre retries (segundos)
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-30}
BASE_BACKOFF=${BASE_BACKOFF:-1}
MAX_BACKOFF=${MAX_BACKOFF:-8}
# START_MODE: 'dev' (default) uses `dev` scripts; set to 'prod' to use `start:prod` (nuxt start)
START_MODE=${START_MODE:-dev}
mkdir -p "$LOG_DIR"

PIDS=()
start_service() {
    name="$1"
    shift
    cmd="$@"
    logfile="$LOG_DIR/${name}.log"
    echo "Starting $name -> $logfile"
    nohup sh -c "$cmd" > "$logfile" 2>&1 &
    pid=$!
    PIDS+=("$pid")
    echo "$name started (PID $pid)"
}

wait_for_health() {
    name="$1"
    url="$2"
    timeout_secs=${3:-30}
    # Exponential backoff: base delay (s) and max delay (s) can be passed as 4th and 5th args
    base=${4:-1}
    max_delay=${5:-8}
    start_ts=$(date +%s)
    end_ts=$((start_ts + timeout_secs))
    attempt=0

    echo "Waiting for $name health at $url (timeout ${timeout_secs}s, base ${base}s, max ${max_delay}s)..."
    while true; do
        attempt=$((attempt+1))
        if curl -sSf "$url" >/dev/null 2>&1; then
            echo "$name is healthy (attempt $attempt)"
            return 0
        fi
        now=$(date +%s)
        if [ "$now" -ge "$end_ts" ]; then
            echo "Timeout waiting for $name health at $url after $attempt attempts"
            return 1
        fi
        # compute exponential delay = min(max_delay, base * 2^(attempt-1))
        pow=$((attempt-1))
        mul=1
        i=0
        while [ $i -lt $pow ]; do
            mul=$((mul * 2))
            i=$((i + 1))
        done
        delay=$((base * mul))
        if [ $delay -gt $max_delay ]; then
            delay=$max_delay
        fi
        echo "Attempt $attempt failed; retrying in ${delay}s..."
        sleep $delay
    done
}

echo "Using pnpm to start services (ensure pnpm installed). Logs: $LOG_DIR"

if [ "$START_MODE" = "prod" ]; then
    echo "START_MODE=prod — starting apps with their production 'start:prod' scripts"
    start_service host "pnpm --filter host start:prod"
    start_service checkout "pnpm --filter checkout start:prod"
    start_service profile "pnpm --filter profile start:prod"
    start_service admin "pnpm --filter admin start:prod"
else
    echo "START_MODE=dev — starting apps with their dev scripts"
    start_service host "pnpm --filter host dev"
    start_service checkout "pnpm --filter checkout dev"
    start_service profile "pnpm --filter profile dev"
    start_service admin "pnpm --filter admin dev"
fi

echo "Services started in background. PIDs: ${PIDS[*]}"
echo "Tail logs with: tail -f $LOG_DIR/host.log $LOG_DIR/checkout.log $LOG_DIR/profile.log $LOG_DIR/admin.log"

# Wait for health endpoints
ALL_OK=0
if ! wait_for_health host "http://localhost:3000/api/health" "$HEALTH_TIMEOUT" "$BASE_BACKOFF" "$MAX_BACKOFF"; then ALL_OK=1; fi
if ! wait_for_health checkout "http://localhost:3001/api/health" "$HEALTH_TIMEOUT" "$BASE_BACKOFF" "$MAX_BACKOFF"; then ALL_OK=1; fi
if ! wait_for_health profile "http://localhost:3002/api/health" "$HEALTH_TIMEOUT" "$BASE_BACKOFF" "$MAX_BACKOFF"; then ALL_OK=1; fi
if ! wait_for_health admin "http://localhost:3003/api/health" "$HEALTH_TIMEOUT" "$BASE_BACKOFF" "$MAX_BACKOFF"; then ALL_OK=1; fi

if [ "$ALL_OK" -eq 0 ]; then
    echo "All services healthy. Ready for local testing."
else
    echo "One or more services failed health checks. Check logs in $LOG_DIR"
fi

cleanup() {
    echo "Stopping services: ${PIDS[*]}"
    for p in "${PIDS[@]}"; do
        if kill -0 "$p" 2>/dev/null; then
            kill "$p" || true
        fi
    done
}

trap cleanup INT TERM EXIT

# Wait for all background processes
wait
