#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"
fail() { printf '\n%s\n' "$1" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || fail "Instala Docker Desktop."
docker compose version >/dev/null 2>&1 || fail "Actualiza Docker Desktop para tener Docker Compose."
docker info >/dev/null 2>&1 || fail "Abre Docker Desktop y espera a que esté listo."
case "${1:-iniciar}" in iniciar|detener) ;; *) fail "Usa: bash iniciar.sh [detener]" ;; esac

backend_dir="${BACKEND_CONTEXT:-$project_dir/../TFM-BACK-END}"
if [[ ! -d "$backend_dir" ]]; then
  [[ "${1:-iniciar}" != detener ]] || fail "No existe el entorno del backend."
  command -v git >/dev/null 2>&1 || fail "Instala Git para descargar el backend."
  git clone https://github.com/kevintoasa42-oss/TFM-BACK-END.git "$backend_dir"
fi
[[ -f "$backend_dir/iniciar.sh" && -f "$backend_dir/package.json" ]] || fail "La carpeta TFM-BACK-END no contiene el backend."
backend_dir="$(cd "$backend_dir" && pwd)"
# Docker Compose on Windows needs a Windows path when launched from Git Bash.
if command -v cygpath >/dev/null 2>&1; then
  export BACKEND_CONTEXT="$(cygpath -m "$backend_dir")"
else
  export BACKEND_CONTEXT="$backend_dir"
fi
bash "$backend_dir/iniciar.sh" preparar

if [[ ! -f .env.frontend ]]; then
  web_port=3000
  for ((attempt=0; attempt<100; attempt++)); do
    if [[ -z "$(docker ps --filter "publish=$web_port" --format '{{.ID}}')" ]] &&
       ! ( : > "/dev/tcp/127.0.0.1/$web_port" ) 2>/dev/null; then break; fi
    web_port=$((web_port + 1))
  done
  ((attempt < 100)) || fail "No se encontró un puerto libre para el frontend."
  (umask 077; set -o noclobber; printf 'FLASHRETO_PORT=%s\n' "$web_port" > .env.frontend)
fi
compose=(docker compose --env-file "$backend_dir/.env.docker" --env-file .env.frontend)
if [[ "${1:-iniciar}" == detener ]]; then
  "${compose[@]}" down
  printf '\nEntorno detenido. Los datos de PostgreSQL se conservan.\n'
  exit 0
fi
printf '\nLevantando frontend, backend y PostgreSQL en tres contenedores…\n'
"${compose[@]}" up --build --detach --wait --wait-timeout 180 --remove-orphans
web_address="$("${compose[@]}" port frontend 8080)"
printf '\nFlashReto listo: http://localhost:%s/\n' "${web_address##*:}"
printf 'Al registrarte, elige Administrador para crear preguntas o Usuario para jugar.\n'
