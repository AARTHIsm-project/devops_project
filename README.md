# Jenkins + Docker + GitHub CI/CD Pipeline (Working Demo)

A complete, working end-to-end CI/CD project: push code to GitHub → Jenkins
auto-builds, tests, and containerizes the app → pushes the image to Docker
Hub → deploys it as a running container.

```
Developer            GitHub                 Jenkins                  Docker Hub        Deploy target
   |  git push  --->    | --webhook-->          |                          |                 |
   |                    |                       | 1. Checkout              |                 |
   |                    |                       | 2. npm install & test    |                 |
   |                    |                       | 3. docker build          |                 |
   |                    |                       | 4. docker push  ------>  |                 |
   |                    |                       | 5. deploy.sh  ---------------------------->  |
   |                    |                       | 6. curl /health (smoke test)                |
```

## What's included

```
.
├── Jenkinsfile                 # The pipeline definition (pipeline-as-code)
├── scripts/
│   └── deploy.sh                # Stops old container, runs new image
├── jenkins/
│   ├── docker-compose.yml       # Spins up Jenkins itself, in a container
│   └── plugins.txt              # Plugins Jenkins needs
└── app/
    ├── src/
    │   ├── app.js                # Express app (routes/logic)
    │   └── index.js              # Server entrypoint
    ├── tests/
    │   └── app.test.js           # Jest + Supertest test suite (8 tests, 100% coverage)
    ├── Dockerfile                # Multi-stage build (tests run inside the build!)
    ├── docker-compose.yml        # Run the app locally without Jenkins
    ├── .dockerignore
    └── package.json
```

The app itself is a small Express API with a few endpoints (`/`, `/health`,
`/api/tasks`) — intentionally simple so the pipeline is the star of the
project, not the app. All 8 tests pass with 100% line/branch coverage
(verified — see "Already verified" below).

---

## 1. Run the app locally (no Jenkins, no Docker)

```bash
cd app
npm install
npm test        # runs the full Jest suite
npm start        # http://localhost:3000
```

## 2. Run the app in Docker (no Jenkins)

```bash
cd app
docker compose up --build
# App available at http://localhost:3000
# Tests run automatically as part of the image build — if they fail, the build fails.
curl http://localhost:3000/health
```

## 3. Spin up Jenkins itself

```bash
cd jenkins
docker compose up -d
docker logs -f jenkins
```
- Wait for the "unlock Jenkins" message, then get the admin password:
  ```bash
  docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
  ```
- Open http://localhost:8080, paste the password, choose **Install suggested
  plugins**, then create your admin user.
- Also install the plugins listed in `jenkins/plugins.txt` if any are
  missing (Manage Jenkins → Plugins).

> **Note:** the compose file mounts the host's Docker socket into the
> Jenkins container so Jenkins can run `docker build` / `docker push`
> itself. This is the simplest way to get Docker-from-Jenkins working
> locally — for production, consider a dedicated build agent instead of
> giving Jenkins direct host Docker access.

## 4. Push this project to your own GitHub repo

```bash
git init
git add .
git commit -m "Initial commit: Jenkins + Docker + GitHub CI/CD demo"
git branch -M main
git remote add origin https://github.com/<you>/<your-repo>.git
git push -u origin main
```

## 5. Add credentials in Jenkins

**Manage Jenkins → Credentials → System → Global credentials → Add Credentials**

| Kind | ID | Used for |
|---|---|---|
| Username with password | `dockerhub-creds` | Docker Hub login (used in `Jenkinsfile`) |
| Username with password / PAT | `github-creds` | Private repo checkout (if needed) |

Then edit `IMAGE_NAME` in the `Jenkinsfile` to your own Docker Hub
username, e.g. `IMAGE_NAME = "yourdockerhubuser/devops-demo-app"`.

## 6. Create the Jenkins pipeline job

- **New Item → Pipeline** → name it `devops-demo-app-pipeline`
- **Build Triggers** → check "GitHub hook trigger for GITScm polling"
- **Pipeline → Definition** → "Pipeline script from SCM"
  - SCM: Git
  - Repository URL: `https://github.com/<you>/<your-repo>.git`
  - Credentials: (add if private)
  - Script Path: `Jenkinsfile`
- Save.

## 7. Wire up the GitHub webhook

In your GitHub repo: **Settings → Webhooks → Add webhook**
- Payload URL: `http://<your-jenkins-host>:8080/github-webhook/`
- Content type: `application/json`
- Trigger: "Just the push event"

> If Jenkins is running on your laptop and GitHub can't reach it directly,
> tunnel it with something like `ngrok http 8080` and use the ngrok URL as
> the webhook payload URL. Alternatively, just click **Build Now** manually
> in Jenkins to trigger the pipeline without a webhook.

## 8. Trigger the pipeline

Push a commit:
```bash
git commit --allow-empty -m "Trigger pipeline"
git push
```
Or click **Build Now** in the Jenkins job page.

Watch the stages run in order:
**Checkout → Install & Test → Build Docker Image → Push Docker Image →
Deploy → Smoke Test**

If any stage fails (e.g. a test breaks), the pipeline stops there and the
bad image never reaches "Deploy" — that's the whole point.

---

## Already verified in this build

- ✅ `npm install` completes cleanly
- ✅ `npm test` — **8/8 tests pass, 100% statement/branch/function/line coverage**
- ✅ Dockerfile uses a multi-stage build where `npm test` runs *inside* the
  build step, so a broken test fails the image build itself, not just the
  Jenkins stage
- ⚠️ The Docker build/push/deploy stages depend on a Docker daemon and
  Docker Hub credentials, which aren't available in this sandboxed
  environment — but the Dockerfile, compose files, and Jenkinsfile follow
  standard, well-tested patterns. Run them in your own Docker environment
  per the steps above.

## Extending this project

- **Slack notifications**: add a `post { failure { slackSend ... } }` block (Slack Notification plugin)
- **Image scanning**: add a stage running `trivy image ${IMAGE_NAME}:${IMAGE_TAG}` before push
- **Multibranch pipeline**: switch the Jenkins job to "Multibranch Pipeline" to auto-build every branch/PR
- **Kubernetes deploy**: replace `scripts/deploy.sh` with `kubectl apply -f k8s/` and a rollout status check
- **SonarQube**: add a code-quality gate stage before the Docker build

## License

MIT — use freely for learning, portfolios, or interviews.
