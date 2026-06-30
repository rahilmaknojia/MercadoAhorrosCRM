# Mercado Ahorros CRM — Kubernetes

Manifests for the Next.js CRM (BFF). Mirrors the API's `k8s/` layout.

| File              | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `config.yaml`     | ConfigMap: runtime env (ports, auth URL, API URL, SES)|
| `secret.yaml`     | Opaque Secret (dedicated SES credentials, optional)  |
| `service.yaml`    | ClusterIP Service on port 8102                       |
| `deployment.yaml` | Deployment (1 replica, non-root, health-probed)      |

## Environment reference

| Key | Where | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTH_SERVICE_URL` | ConfigMap **+ build arg** | Public auth origin (`https://auth.dev.mercadoahorros.net`). Inlined into the browser bundle at build time, so it must also be passed as `--build-arg`. |
| `NEXT_PUBLIC_AUTH_BASE_PATH` | ConfigMap + build arg | `/api/auth`. |
| `API_BASE_URL` | ConfigMap | Server-only. In-cluster API Service DNS (`http://svc-mercadoapi.default.svc.cluster.local:8080`). The browser never calls the API directly — the BFF proxies and attaches the JWT. |
| `NEXT_PUBLIC_CRM_URL` | ConfigMap | Public CRM origin, used to build report links in "Send now" emails. |
| `SES_REGION` / `SES_FROM_EMAIL` / `SES_FROM_NAME` | ConfigMap | Report email config. No-ops if `SES_FROM_EMAIL` is empty. |
| `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` | Secret | **Dedicated SES credentials** — see below. |

> The dev `NEXT_PUBLIC_AUTH_SERVICE_URL` is `auth.dev.mercadoahorros.net`. Keep the
> ConfigMap value and the Docker `--build-arg` in sync, or the browser will hit the
> wrong auth host.

## SES / report email (credentials decoupled from AWS default chain)

The CRM sends report emails ("Send now"/scheduled) via AWS SES. As in the auth service,
SES uses **dedicated** `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` + `SES_REGION` and
does **not** read the generic `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` pair (which
DigitalOcean Spaces uses). `src/lib/server/mailer.ts` passes them explicitly; if unset it
falls back to the AWS default chain. Email no-ops cleanly when `SES_FROM_EMAIL` is empty,
so SES is optional for the CRM to run.

## Build & push the image

> **Important:** `NEXT_PUBLIC_*` values are inlined into the browser bundle at
> **build time**, so they must be passed as `--build-arg` (not only at runtime).
> Use the same value in `config.yaml` for the server-side reads.

## Local Docker build and push to registry
```powershell
# Variables (edit these)
$Registry = "registry.digitalocean.com/edi"
$Image    = "mercado-crm"
$Version  = "1.0.4"          # or: (Get-Date -Format "yyyy.MM.dd.HHmm")
$Tag      =  $Registry + "/" + $Image + ":" + $Version

# Build with BuildKit enabled
$env:DOCKER_BUILDKIT = "1"
docker build `
--build-arg NEXT_PUBLIC_AUTH_SERVICE_URL=https://auth.dev.mercadoahorros.net `
--build-arg NEXT_PUBLIC_CRM_URL=https://crm.dev.mercadoahorros.net `
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
--build-arg NEXT_PUBLIC_AUTH_SERVICE_URL=https://auth.mercadoahorros.net `
--build-arg NEXT_PUBLIC_CRM_URL=https://crm.mercadoahorros.net `
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
