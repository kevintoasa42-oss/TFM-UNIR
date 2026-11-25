// CI del frontend: pruebas, compilación, imagen Docker, prueba de los tres contenedores y publicación en Docker Hub.
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }
  environment {
    IMAGE_NAME = 'flashreto-frontend'
  }
  stages {
    stage('Preparar') {
      steps {
        script {
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
          env.CI_PROJECT = "ci-${env.BUILD_TAG}".toLowerCase().replaceAll('[^a-z0-9-]', '-')
          env.BACKEND_CONTEXT = "${env.WORKSPACE}@backend"
        }
        sh 'node --version && npm --version && docker --version && docker compose version'
      }
    }
    stage('Instalar dependencias') {
      steps { sh 'npm ci --no-audit --no-fund' }
    }
    stage('Pruebas unitarias') {
      steps { sh 'npm test' }
    }
    stage('Compilar') {
      steps { sh 'npm run build' }
    }
    stage('Imagen Docker') {
      steps { sh 'docker build --tag "$IMAGE_NAME:$IMAGE_TAG" .' }
    }
    stage('Sistema completo con Docker Compose') {
      steps {
        dir(env.BACKEND_CONTEXT) {
          git url: env.BACKEND_REPO_URL ?: 'https://github.com/kevintoasa42-oss/TFM-BACK-END.git', branch: 'main'
          sh 'npm ci --no-audit --no-fund'
        }
        sh '''
          set -eu
          node -e 'const c=require("node:crypto");process.stdout.write("POSTGRES_PASSWORD="+c.randomBytes(32).toString("hex")+"\\nPOSTGRES_PORT=0\\nBACKEND_PORT=0\\n")' > "$BACKEND_CONTEXT/.env.docker"
          printf 'FLASHRETO_PORT=0\\n' > .env.ci
          compose() { docker compose --project-name "$CI_PROJECT" --env-file "$BACKEND_CONTEXT/.env.docker" --env-file .env.ci "$@"; }
          export FLASHRETO_URL="http://${CI_PROJECT}-frontend-1:8080" FLASHRETO_FRONTEND_URL="http://${CI_PROJECT}-frontend-1:8080" FLASHRETO_TEST_RECORD="$WORKSPACE/record.json"

          compose up --build --detach --wait --wait-timeout 180
          docker network connect "${CI_PROJECT}_default" "$JENKINS_CONTAINER"
          (cd "$BACKEND_CONTEXT" && node test/integration.mjs)

          echo "Recreando los tres contenedores para comprobar la persistencia..."
          docker network disconnect "${CI_PROJECT}_default" "$JENKINS_CONTAINER"
          compose down
          compose up --no-build --detach --wait --wait-timeout 180
          docker network connect "${CI_PROJECT}_default" "$JENKINS_CONTAINER"
          (cd "$BACKEND_CONTEXT" && node test/postgres-persistence.mjs)
        '''
      }
      post {
        always {
          sh '''
            docker network disconnect "${CI_PROJECT}_default" "$JENKINS_CONTAINER" 2>/dev/null || true
            docker compose --project-name "$CI_PROJECT" --env-file "$BACKEND_CONTEXT/.env.docker" --env-file .env.ci down --volumes --remove-orphans --rmi local || true
            rm -f .env.ci record.json
          '''
        }
      }
    }
    stage('Publicar en Docker Hub') {
      when {
        anyOf {
          branch 'main'
          changeRequest target: 'main'
        }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')]) {
          sh '''
            set -eu
            if [ -z "${DOCKERHUB_USER:-}" ] || [ -z "${DOCKERHUB_TOKEN:-}" ]; then
              echo "Sin credenciales de Docker Hub: se omite la publicación."
              exit 0
            fi
            repository="$DOCKERHUB_USER/$IMAGE_NAME"
            if [ -n "${CHANGE_ID:-}" ]; then channel="pr-$CHANGE_ID"; else channel=latest; fi
            export DOCKER_CONFIG="$WORKSPACE@tmp/docker-config"
            trap 'rm -rf "$DOCKER_CONFIG"' EXIT
            echo "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USER" --password-stdin
            for tag in "$IMAGE_TAG" "$channel"; do
              docker tag "$IMAGE_NAME:$IMAGE_TAG" "$repository:$tag"
              docker push "$repository:$tag"
              docker image rm "$repository:$tag"
            done
          '''
        }
      }
    }
  }
  post {
    always {
      sh 'docker image rm "$IMAGE_NAME:$IMAGE_TAG" 2>/dev/null || true'
      cleanWs()
      dir(env.BACKEND_CONTEXT) { deleteDir() }
    }
  }
}
