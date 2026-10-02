# Levantar FlashReto

La PC necesita **Docker Desktop abierto**, **Git** e internet para la primera ejecución. En Windows usa Git Bash; en macOS o Linux, una terminal con Bash. Docker Compose debe ser 2.20.3 o posterior, incluido en Docker Desktop actualizado.

Dentro de la carpeta del frontend, ejecuta:

```bash
bash iniciar.sh
```

El script descarga el repositorio del backend si falta y levanta tres contenedores: frontend, backend y PostgreSQL. Abre la dirección que muestra, normalmente **http://localhost:3000**.

Al registrarte, elige **Administrador** para crear preguntas o **Usuario** para participar en partidas. Para jugar, el administrador crea un examen y una sala, y la otra persona entra con el código desde otro navegador.

Para detener todo:

```bash
bash iniciar.sh detener
```

Para volver a iniciarlo, ejecuta `bash iniciar.sh`. Conserva `.env.frontend` en el frontend y `.env.docker` en `TFM-BACK-END`. Los datos permanecen en el volumen de PostgreSQL. No necesitas instalar Node, npm ni PostgreSQL en la PC.
