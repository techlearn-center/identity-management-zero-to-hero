# Lab 02: Deploy to Kubernetes

## Objective
Deploy the identity service to a Kubernetes cluster with proper security.

## Steps
1. Create namespace: `kubectl apply -f kubernetes/namespace.yaml`
2. Create ConfigMap and Secrets
3. Deploy: `kubectl apply -f kubernetes/`
4. Verify pods are running and healthy
5. Test with port-forward: `kubectl port-forward svc/identity-api 3001:80 -n identity`
6. Deploy with Helm: `helm install identity-api ./helm/identity-service`
