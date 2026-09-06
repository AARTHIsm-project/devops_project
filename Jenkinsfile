// Jenkinsfile — Declarative pipeline for the devops-demo-app
// Lives at the repo root. Jenkins job type: "Pipeline script from SCM".

pipeline {
    agent any

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    environment {
        // Change to your own Docker Hub username/repo
        IMAGE_NAME        = "aarthidevops/devops-demo-app"
        IMAGE_TAG         = "${env.BUILD_NUMBER}"
        DOCKERHUB_CREDS   = credentials('dockerhub-creds')   // Jenkins credential ID (Username/Password)
        DEPLOY_CONTAINER  = "devops-demo-app"
        DEPLOY_PORT       = "3000"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Test') {
            steps {
                dir('app') {
                    sh '''
                        node -v
                        npm install
                        npm test
                    '''
                }
            }
            post {
                always {
                    // Publish coverage/junit if you wire up jest-junit; harmless if absent
                    archiveArtifacts artifacts: 'app/coverage/**', allowEmptyArchive: true
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('app') {
                    sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
                }
            }
        }

        stage('Push Docker Image') {
            steps {
                sh '''
                    echo "$DOCKERHUB_CREDS_PSW" | docker login -u "$DOCKERHUB_CREDS_USR" --password-stdin
                    docker push ${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    chmod +x scripts/deploy.sh
                    IMAGE_NAME=${IMAGE_NAME} \
                    IMAGE_TAG=${IMAGE_TAG} \
                    DEPLOY_CONTAINER=${DEPLOY_CONTAINER} \
                    DEPLOY_PORT=${DEPLOY_PORT} \
                    ./scripts/deploy.sh
                '''
            }
        }

        stage('Smoke Test') {
    steps {
        sh '''
            sleep 5
            curl -f http://host.docker.internal:${DEPLOY_PORT}/health
        '''
    }
}
        
    }

    post {
        success {
            echo "✅ Pipeline succeeded — ${IMAGE_NAME}:${IMAGE_TAG} deployed."
        }
        failure {
            echo "❌ Pipeline failed — check the stage logs above."
        }
        always {
            sh 'docker logout || true'
        }
    }
}
