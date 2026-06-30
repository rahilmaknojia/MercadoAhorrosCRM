# Mercado Ahorros CRM — Kubernetes

Manifests for the Next.js CRM (BFF). Mirrors the API's `k8s/` layout.

| File              | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `config.yaml`     | ConfigMap: runtime env (ports, auth URL, API URL)    |
| `secret.yaml`     | Opaque Secret (empty — reserved for future secrets)  |
| `service.yaml`    | ClusterIP Service on port 8102                       |
| `deployment.yaml` | Deployment (1 replica, non-root, health-probed)      |

## Build & push the image

> **Important:** `NEXT_PUBLIC_*` values are inlined into the browser bundle at
> **build time**, so they must be passed as `--build-arg` (not only at runtime).
> Use the same value in `config.yaml` for the server-side reads.

## Local Docker build and push to registry
```powershell
# Variables (edit these)
$Registry = "registry.digitalocean.com/edi"
$Image    = "mercado-crm"
$Version  = "1.0.3"          # or: (Get-Date -Format "yyyy.MM.dd.HHmm")
$Tag      =  $Registry + "/" + $Image + ":" + $Version

# Build with BuildKit enabled
$env:DOCKER_BUILDKIT = "1"
docker build `
--build-arg NEXT_PUBLIC_AUTH_SERVICE_URL=https://auth.dev.mercadoahorros.net `
--build-arg NEXT_PUBLIC_AUTH_BASE_PATH=/api/auth `
-f Dockerfile -t $Tag .

# Push both tags
docker push $Tag

# (Optional) output digest for pinning in deployment
(docker inspect --format='{{index .RepoDigests 0}}' $Tag)
```

PROD
```powershell
# Variables (edit these)
$Registry = "registry.digitalocean.com/edi"
$Image    = "mercado-crm"
$Version  = "1.0.2"          # or: (Get-Date -Format "yyyy.MM.dd.HHmm")
$Tag      =  $Registry + "/" + $Image + ":prod-" + $Version

# Build with BuildKit enabled
$env:DOCKER_BUILDKIT = "1"
docker build `
--build-arg NEXT_PUBLIC_AUTH_SERVICE_URL=https://auth.dev.mercadoahorros.net `
--build-arg NEXT_PUBLIC_AUTH_BASE_PATH=/api/auth `
-f Dockerfile -t $Tag .

# Push both tags
docker push $Tag

# (Optional) output digest for pinning in deployment
(docker inspect --format='{{index .RepoDigests 0}}' $Tag)
```

## Deploy

```bash
kubectl apply -f k8s/config.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
```

Expose the Service via your Ingress/load balancer at the CRM's public hostname.
The browser must be able to reach `NEXT_PUBLIC_AUTH_SERVICE_URL` directly (for the
Microsoft OAuth redirect); the session cookie is shared between the CRM and the auth
service per the BFF design, so they should sit under a common parent domain.
