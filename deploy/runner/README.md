# OneParty ARC image-build runner

This is a repository-scoped Actions Runner Controller scale set in the existing
`arc-runners-onprem` namespace, using the existing controller in `arc-systems`.
It is separate from `tgmstudios-runners` (Foligo) and `onprem-runners` (Medusa).

- Runner label / scale-set name: `oneparty-runners`
- GitHub repository: `https://github.com/tgmstudios/oneparty`
- Scale: `minRunners: 0`, `maxRunners: 1`
- Docker-in-Docker follows the existing on-prem ARC convention. Storage is
  pod-local `emptyDir`; no new hostPath mounts are added.
- Helm chart: `oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set`
- Chart version: `0.14.2`
- Credential secret: `oneparty-github-auth` in `arc-runners-onprem`.
  Provision a repository-authorized GitHub App or fine-grained credential whose
  permissions support ARC runner registration. Do not commit credentials.

Install/upgrade from this directory with the existing Kubernetes context:

```sh
KUBECONFIG=/home/tgm/.kube/config helm upgrade --install oneparty-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.14.2 -n arc-runners-onprem --create-namespace \
  -f deploy/runner/values.yaml
```

Before applying, ensure `oneparty-github-auth` is provisioned with the ARC
credential format documented by GitHub ARC. Verify the resulting
`AutoscalingRunnerSet` and listener are scoped to the OneParty repository, then
queue an image-build workflow on `runs-on: oneparty-runners` to prove dispatch.
