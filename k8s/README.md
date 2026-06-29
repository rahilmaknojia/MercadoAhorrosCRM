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

```bash
REG=registry.digitalocean.com/edi
docker build \
  --build-arg NEXT_PUBLIC_AUTH_SERVICE_URL=https://auth.mercadoahorros.net \
  --build-arg NEXT_PUBLIC_AUTH_BASE_PATH=/api/auth \
  -t $REG/mercado-crm:1.0.0 .
docker push $REG/mercado-crm:1.0.0
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
