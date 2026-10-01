#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

fail() { printf '\n%s\n' "$1" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail "Instala Docker Desktop y vuelve a ejecutar el script."
docker compose version >/dev/null 2>&1 || fail "Necesitas Docker Compose. Actualiza Docker Desktop."
docker info >/dev/null 2>&1 || fail "Abre Docker Desktop, espera a que esté listo y vuelve a ejecutar el script."

case "${1:-iniciar}" in
  detener)
    [[ -f .env.docker ]] || fail "Todavía no se ha iniciado este entorno."
    docker compose --env-file .env.docker down
    printf '\nEntorno detenido. Los datos se conservan.\n'
    exit 0
    ;;
  iniciar) ;;
  *) fail "Usa: bash iniciar.sh o bash iniciar.sh detener" ;;
esac

free_port() {
  local candidate="$1"
  for ((attempt=0; attempt<100; attempt++)); do
    if [[ -z "$(docker ps --filter "publish=$candidate" --format '{{.ID}}')" ]] &&
       ! ( : > "/dev/tcp/127.0.0.1/$candidate" ) 2>/dev/null; then
      printf '%s' "$candidate"
      return
    fi
    candidate=$((candidate + 1))
  done
  fail "No se encontró un puerto libre."
}

if [[ ! -f .env.docker ]]; then
  printf 'Preparando la configuración local…\n'
  web_port="$(free_port 3000)"
  db_port="$(free_port 5433)"
  # Generate the secret inside the Node image: the host does not need Node or OpenSSL.
  node_image='node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6'
  db_password="$(docker run --rm "$node_image" node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  [[ "$db_password" =~ ^[a-f0-9]{64}$ ]] || fail "No se pudo generar la contraseña de PostgreSQL."
  ( umask 077; set -o noclobber; printf 'POSTGRES_PASSWORD=%s\nPOSTGRES_PORT=%s\nFLASHRETO_PORT=%s\n' "$db_password" "$db_port" "$web_port" > .env.docker )
  unset db_password
fi

printf '\nLevantando React, el backend, WebSocket y PostgreSQL…\n'
docker compose --env-file .env.docker up --build --detach --wait --wait-timeout 180
web_address="$(docker compose --env-file .env.docker port web 3000)"
printf '\nFlashReto listo: http://localhost:%s/\n' "${web_address##*:}"
printf 'La primera cuenta que registres será administrador.\n'
