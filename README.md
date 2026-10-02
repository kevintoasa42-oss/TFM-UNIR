# FlashReto — Frontend

Este repositorio contiene únicamente la aplicación React. El backend y PostgreSQL están en [TFM-BACK-END](https://github.com/kevintoasa42-oss/TFM-BACK-END). Cada proyecto tiene su propio `package.json`, archivo de bloqueo, TypeScript, pruebas y Dockerfile. Se pueden clonar, instalar y compilar por separado. No existe una carpeta `shared` ni se importa código del otro repositorio.

Para ejecutar la aplicación completa, abre Docker Desktop y corre:

```bash
bash iniciar.sh
```

El script descarga el backend en la carpeta vecina `TFM-BACK-END` si falta, prepara su configuración y levanta **tres contenedores**. No necesitas instalar Node ni PostgreSQL en la PC. Consulta [LEVANTAR.md](LEVANTAR.md).

| Contenedor | Responsabilidad |
| --- | --- |
| `frontend` | Archivos de React y proxy HTTP/WebSocket de Nginx; normalmente `localhost:3000` |
| `backend` | API, contraseñas, permisos y partidas; normalmente `localhost:4000/api/health` |
| `db` | PostgreSQL y su volumen persistente |

La configuración de `backend` y `db` pertenece al otro repositorio. El `compose.yaml` de aquí la incorpora con `include`; mantiene separados sus contextos de construcción y Dockerfiles. PostgreSQL conserva el volumen `flashreto-local_postgres-data` que usaba la versión anterior.

## Desarrollo independiente

Usa Node 24 o posterior con tu NVM. Dentro de este repositorio:

```bash
npm ci
npm run dev
```

Vite abre el frontend en `http://127.0.0.1:5173`. Para conectar una API existente, copia `.env.example` a `.env` y ajusta `API_UPSTREAM`, por ejemplo `http://127.0.0.1:4000`. El frontend se comunica mediante JSON en `/api` y mensajes WebSocket. Sus tipos locales describen las respuestas; las reglas definitivas, el tiempo y los puntos se comprueban en el servidor.

En Docker, `API_UPSTREAM` se configura al arrancar el contenedor, sin recompilar React. Puedes construir esta imagen sin tener el repositorio del backend:

```bash
docker build -t flashreto-frontend .
docker run --rm -p 3000:8080 -e API_UPSTREAM=http://host.docker.internal:4000 flashreto-frontend
```

En Linux agrega `--add-host=host.docker.internal:host-gateway` si la API corre en la misma PC. Para otra máquina, usa su dirección en `API_UPSTREAM`. El proxy mantiene la sesión y transmite las conexiones WebSocket. Nginx solo sirve archivos y redirige solicitudes; no ejecuta los casos de uso de la API.

## Estructura

```text
src/App.tsx                 Navegación y sesión de la interfaz
src/main.tsx                Entrada de React
src/styles.css              Estilos adaptables
src/features/               Registro, usuarios, contenido, CSV, estudio y partidas
src/domain/                 Tipos locales y validación de formularios
src/infrastructure/         Cliente HTTP de la API
src/components/             Componentes de interfaz
test/                       Pruebas de contenido y CSV del frontend
scripts/test-system.mjs     Prueba de la unión de los dos repositorios
nginx/                      Proxy y servidor de archivos del frontend
Dockerfile                  Imagen que contiene solo el frontend
compose.yaml                Une los tres servicios con la configuración del backend
iniciar.sh                  Arranque con un solo comando
```

El navegador permite elegir Administrador o Usuario al registrarse. Un administrador crea áreas, temas, preguntas con cuatro opciones, exámenes y salas. Puede importar CSV con revisión por fila y estudiar mediante tarjetas. Un usuario participa con el código de una sala. La generación con IA sigue sin implementarse.

## Comprobaciones

```bash
npm test
npm run build
npm run test:system
```

La primera prueba comprueba asociaciones, bloqueo de preguntas usadas en exámenes y CSV válido e inválido. La compilación incluye TypeScript estricto. `test:system` necesita la carpeta vecina `TFM-BACK-END` con sus dependencias instaladas (`npm ci` allí). Crea un proyecto Docker desechable con sus propios puertos y volumen, prueba la API a través del frontend con **dos clientes WebSocket reales**, recrea los tres contenedores y verifica cuentas, roles, preguntas y resultados. Al terminar retira únicamente los recursos del proyecto de prueba.

Las pruebas incluyen selección de rol, contraseña incorrecta, permisos, creación/edición/eliminación de contenido, pregunta usada en un examen, código inválido, sala completa, respuestas duplicadas y tardías, reconexión, temporizador y clasificación.

## Datos y vista anterior

Los datos de la instalación Docker se conservan en PostgreSQL. El sitio privado `flashreto.soporte197664.chatgpt.site` mantiene la versión previamente publicada con D1; estas bases son independientes. Esta nueva arquitectura se ejecuta mediante los tres contenedores y necesita alojarlos en un servidor para disponer de una URL pública. Los contenedores Docker no se publican mediante Sites.

El proxy sigue la [configuración oficial de WebSocket de Nginx](https://nginx.org/en/docs/http/websocket.html). La composición de los repositorios utiliza [Docker Compose include](https://docs.docker.com/compose/how-tos/multiple-compose-files/include/).
