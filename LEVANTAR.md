# Levantar FlashReto

La PC necesita:

- Docker Desktop instalado, abierto y funcionando. En Linux también sirve Docker Engine con Docker Compose.
- En Windows, **Git Bash** para ejecutar el script. En macOS o Linux, una terminal con Bash.
- Internet para la primera ejecución y la carpeta completa del proyecto.

No necesitas instalar Node, npm ni PostgreSQL en la PC: Docker se encarga de todo.

Abre la terminal dentro de la carpeta del proyecto, donde está `iniciar.sh`, y ejecuta:

```bash
bash iniciar.sh
```

Cuando termine, abre la dirección que muestra el script, normalmente **http://localhost:3000**. Ya estarán funcionando el frontend, el backend, WebSocket y PostgreSQL. Al registrarte, elige **Administrador** para crear preguntas o **Usuario** para participar en partidas.

Para detener todo:

```bash
bash iniciar.sh detener
```

Los datos se conservan. Para volver a levantarlo, ejecuta `bash iniciar.sh` otra vez. Conserva el archivo `.env.docker` que genera el script: contiene la contraseña de la base de datos.
