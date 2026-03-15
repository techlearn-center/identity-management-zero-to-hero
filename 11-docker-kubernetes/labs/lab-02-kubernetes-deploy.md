# Lab 02: Deploy to Kubernetes

## Objective

Deploy your containerized identity service to Kubernetes. You'll create deployments, services, config maps, secrets, health probes, and horizontal pod autoscaling. By the end, your identity API will be running in a local Kubernetes cluster.

## Prerequisites

- Completed Lab 01 (Docker image built)
- **Kubernetes cluster** — one of:
  - **Docker Desktop**: Enable Kubernetes in Docker Desktop settings
  - **minikube**: `brew install minikube && minikube start`
  - **kind**: `brew install kind && kind create cluster`
- **kubectl** installed: `kubectl version --client`

## Estimated Time

60–75 minutes

---

## Part 1: Kubernetes Basics for Identity Services

### Key Concepts

| Concept | What It Is | Identity Use Case |
|---|---|---|
| **Pod** | Smallest deployable unit (1+ containers) | One instance of your API |
| **Deployment** | Manages pod replicas and updates | Ensures 3 copies of your API run |
| **Service** | Stable network endpoint for pods | How other services find your API |
| **ConfigMap** | Non-secret configuration | Auth0 domain, API audience |
| **Secret** | Sensitive configuration | Database passwords, API keys |
| **Ingress** | External HTTP routing | `api.example.com → your service` |
| **HPA** | Horizontal Pod Autoscaler | Scale up during login storms |

---

## Part 2: Create the Kubernetes Manifests

### Step 1: Create a namespace

```bash
mkdir -p ~/k8s-lab && cd ~/k8s-lab
```

Create `namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: identity
  labels:
    app.kubernetes.io/name: identity-lab
```

```bash
kubectl apply -f namespace.yaml
kubectl get namespaces | grep identity
```

### Step 2: Create a ConfigMap for non-secret config

Create `configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: identity-api-config
  namespace: identity
data:
  AUTH0_DOMAIN: "your-tenant.us.auth0.com"
  AUTH0_AUDIENCE: "https://api.identity-lab.local"
  PORT: "3001"
  LOG_LEVEL: "info"
  NODE_ENV: "production"
```

```bash
kubectl apply -f configmap.yaml
```

### Step 3: Create a Secret for sensitive data

```bash
# Create secret from literal values (base64 encoded automatically)
kubectl create secret generic identity-api-secrets \
  --namespace identity \
  --from-literal=DATABASE_URL='postgresql://identity:labpass@postgres:5432/identity_db' \
  --from-literal=REDIS_URL='redis://redis:6379'

# Verify (values are base64 encoded)
kubectl get secret identity-api-secrets -n identity -o yaml
```

> **In production**: Use AWS Secrets Manager, HashiCorp Vault, or External Secrets Operator instead of Kubernetes Secrets (which are only base64 encoded, not encrypted at rest by default).

### Step 4: Create the Deployment

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: identity-api
  namespace: identity
  labels:
    app: identity-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: identity-api
  template:
    metadata:
      labels:
        app: identity-api
    spec:
      # Don't run as root
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001

      containers:
        - name: identity-api
          image: identity-api:latest
          imagePullPolicy: IfNotPresent  # Use local image

          ports:
            - containerPort: 3001
              name: http

          # Load config from ConfigMap
          envFrom:
            - configMapRef:
                name: identity-api-config
            - secretRef:
                name: identity-api-secrets

          # Resource limits — prevents one pod from consuming all cluster resources
          resources:
            requests:
              cpu: 100m        # 0.1 CPU core minimum
              memory: 128Mi    # 128MB minimum
            limits:
              cpu: 500m        # 0.5 CPU core maximum
              memory: 256Mi    # 256MB maximum

          # Liveness probe — restart the pod if it becomes unhealthy
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
            failureThreshold: 3

          # Readiness probe — don't send traffic until ready
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3

          # Startup probe — give slow-starting apps time
          startupProbe:
            httpGet:
              path: /health
              port: http
            failureThreshold: 30
            periodSeconds: 2
```

**Understanding the probes:**
- **Startup**: Checks if the app started. Runs first, then stops.
- **Readiness**: Checks if the app can handle requests. Failed = no traffic.
- **Liveness**: Checks if the app is alive. Failed = pod gets restarted.

```bash
kubectl apply -f deployment.yaml

# Watch pods come up
kubectl get pods -n identity -w
# Wait until STATUS is "Running" and READY is "2/2"
```

### Step 5: Create the Service

Create `service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: identity-api
  namespace: identity
spec:
  selector:
    app: identity-api
  ports:
    - port: 80
      targetPort: 3001
      protocol: TCP
  type: ClusterIP
```

```bash
kubectl apply -f service.yaml
```

### Step 6: Test the deployment

```bash
# Port-forward to access the service locally
kubectl port-forward -n identity svc/identity-api 8080:80 &

# Test
curl http://localhost:8080/health
# {"status":"healthy","timestamp":"..."}

curl http://localhost:8080/api/public
# {"message":"Public endpoint — no auth required"}

# Stop port-forward
kill %1
```

### Step 7: Add Horizontal Pod Autoscaler

Create `hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: identity-api
  namespace: identity
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: identity-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

```bash
kubectl apply -f hpa.yaml

# Check the HPA
kubectl get hpa -n identity
```

> The HPA will automatically add more pods when CPU usage exceeds 70% average across pods — perfect for handling login storms.

---

## Part 3: Verify Everything

### Step 8: Run diagnostic commands

```bash
# Check all resources in the identity namespace
kubectl get all -n identity

# Describe the deployment (shows events, conditions)
kubectl describe deployment identity-api -n identity

# View pod logs
kubectl logs -n identity -l app=identity-api --tail=50

# Check resource usage
kubectl top pods -n identity
```

---

## Part 4: Clean Up

```bash
kubectl delete namespace identity
```

This deletes everything in the namespace (deployment, service, configmap, secret, HPA).

---

## Validation Checklist

- [ ] Namespace `identity` created
- [ ] ConfigMap stores non-secret config
- [ ] Secret stores database URL and Redis URL
- [ ] Deployment runs 2 replicas
- [ ] Pods run as non-root (securityContext)
- [ ] All three probes (startup, liveness, readiness) configured
- [ ] Resource requests and limits set
- [ ] Service exposes the deployment on port 80
- [ ] Port-forward works and API responds
- [ ] HPA configured to scale 2-10 pods based on CPU

---

**Next Module**: [Module 12: CI/CD with GitHub Actions →](../../12-cicd-github-actions/README.md)
