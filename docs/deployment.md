# OneParty guest deployment

The East guest workload is reconciled by Argo CD from `deploy/k8s` on `main`. `deploy/argocd/oneparty-project.yaml` scopes the project to this repository and the East API's `oneparty` namespace; `deploy/argocd/oneparty-east.yaml` retains automated self-heal with pruning disabled. The namespace is pre-created and intentionally excluded from the application resources.

## Guest CI and digest promotion

`.github/workflows/guest-app-image.yml` runs `public/` tests and builds the public guest image from `public/`. Pull requests validate without publishing. Non-PR runs publish to `registry.tgm.one/oneparty/guest` using `HARBOR_USERNAME` and `HARBOR_PASSWORD`; the existing metadata tags are retained (main `latest` and SHA tag, and `guest-v*` release tags). Only a green `main` push or a manual dispatch on `main` promotes. Promotion takes the exact digest output by that run's build, verifies `main` still equals the triggering `github.sha`, pins that digest in `deploy/k8s/deployment.yaml`, then commits and pushes the manifest update. PR builds and guest release-tag builds never promote. Changes under `deploy/**` trigger the pipeline too.

The deployment is pinned to the digest published by CI. The first successful promotion replaced the bootstrap placeholder before the Argo Application was created; never sync an unbuilt digest. The workflow does not build or deploy the hub.

Hub and guest test jobs run on GitHub-hosted runners. Pull-request image builds also stay hosted and have no publishing step. Main and release image publication uses the repository-scoped `oneparty-runners` ARC scale set on-prem, which can reach Harbor without weakening registry access controls. Its versioned Helm values and operator procedure are in `deploy/runner/`; secrets remain in Kubernetes. Runtime resources in `deploy/k8s` are managed by Argo, while the namespace, credentials, DNS record, and runner release are operator-managed bootstrap resources.

Repository Actions secrets required for image publication: `HARBOR_USERNAME` and `HARBOR_PASSWORD`. Namespace `oneparty` must already contain `harbor-pull` and `oneparty-admin` (key `ADMIN_KEY`). Runtime admin credentials are not stored in Git or sent to CI.

## Guest runtime and ingress

The guest Deployment uses the public image's default Docker CMD, runs non-root as UID/GID 1000, uses a 2Gi Longhorn PVC mounted at `/data`, and provides `PORT=8080`, `DATA_DIR=/data`, `TRUST_PROXY=1`, and the secret-backed `ADMIN_KEY`. Readiness/liveness use `/healthz`. The ingress serves `spook.tgm.one` through nginx with `guest-tls` and `letsencrypt-cloudflare`; the 11m body limit supports uploads up to 10MB.

## Offline validation

From the repository root:

```sh
kubectl kustomize deploy/k8s
python3 -c 'import yaml, pathlib; [list(yaml.safe_load_all(p.read_text())) for p in pathlib.Path("deploy").rglob("*.yaml")]'
```

These checks render/parse source only; they do not verify the remote image digest, cluster storage readiness, Argo credentials, certificate issuance, image pull, or live rollout.
