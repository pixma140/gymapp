#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

seed=auto
confirmed=false
for argument in "$@"; do
    case "$argument" in
        --seed) seed=true ;;
        --yes|-y) confirmed=true ;;
        --help|-h)
            echo "Usage: $0 [--seed] [--yes]"
            echo "Stops GymApp, resets its configured SQLite database, then rebuilds and starts Compose."
            echo "By default, fixture seeding follows SEED_DEV_DATA from .env; --seed forces it on."
            exit 0
            ;;
        *)
            echo "Unknown argument: $argument" >&2
            echo "Usage: $0 [--seed] [--yes]" >&2
            exit 2
            ;;
    esac
done

if [[ "$seed" == auto ]]; then
    seed="$(node --input-type=module -e "try { process.loadEnvFile?.(); } catch (error) { if (error.code !== 'ENOENT') throw error; } const { readServerConfig } = await import('./server/config.js'); process.stdout.write(String(readServerConfig(process.env).seedDevData));")"
fi

if [[ "$confirmed" != true ]]; then
    read -r -p "This permanently wipes the configured GymApp database. Continue? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }
fi

if [[ "$(docker inspect --format '{{.State.Running}}' gymapp 2>/dev/null || true)" == true ]]; then
    echo "Stopping GymApp container..."
    docker compose stop gymapp
else
    echo "GymApp container is not running."
fi

if [[ "$seed" == true ]]; then
    echo "Resetting with development fixtures..."
    npm run db:reset:seed
else
    echo "Resetting as an empty installation..."
    npm run db:reset
fi

echo "Building and starting the Compose stack..."
docker compose up --detach --build
