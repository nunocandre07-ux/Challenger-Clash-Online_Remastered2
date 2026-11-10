# Fix the Railway startup crash

The original Gambler release Dockerfile omitted `gambler-rules.js` from the Docker image, even though server.js requires it at startup. Railway detects and builds Dockerfiles at repository root, which leads to `Cannot find module './gambler-rules'` during launch.

## To fix an existing GitHub repository
1. Download the `CHANGED-FILES.zip` and extract it.
2. In GitHub, open your game repository and replace the root `Dockerfile` with the new one. Also replace `scripts/check.js` to prevent a repeat.
3. Commit the changes to your default branch.
4. If Railway is linked to that branch, a new deployment should start automatically. Otherwise open Railway > your service > Deployments and redeploy the latest commit.
5. When the deployment is running, open `https://YOUR-RAILWAY-DOMAIN/health` in your browser. It should return JSON with `ok: true`.

You can also simply edit the Dockerfile in the GitHub website, changing:
```
COPY server.js ./
```
to:
```
COPY server.js gambler-rules.js ./
```
This one-line change is sufficient to fix the missing-module crash.

## If it still crashes
Open Railway > your service > Deployments > latest deployment > View Logs and copy the first error and stack trace. Other failures have different causes.

The server already listens on 0.0.0.0 and the Railway-injected PORT. Recommended healthcheck path: /health.
