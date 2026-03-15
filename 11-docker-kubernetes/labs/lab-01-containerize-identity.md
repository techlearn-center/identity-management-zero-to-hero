# Lab 01: Containerize an Identity Service

## Objective

Build production-ready Docker images for your identity API (both Express and FastAPI versions from Module 06). You'll learn multi-stage builds, security best practices, Docker Compose for local development, and how to handle secrets in containers.

## Prerequisites

- **Docker Desktop** installed — [docker.com/get-started](https://www.docker.com/get-started/)
  - Verify: `docker --version` and `docker compose version`
- Module 06 Express or FastAPI app (or we'll create a minimal one)

## Estimated Time

45–60 minutes

---

## Part 1: Understand Container Security for Identity Services

### Why Identity Services Need Extra Care

Identity services handle passwords, tokens, and secrets. Container security matters more here than for a typical CRUD app:

| Risk | Mitigation |
|---|---|
| Secrets in image layers | Multi-stage builds, runtime env vars |
| Running as root | `USER node` / `USER nobody` directive |
| Vulnerable dependencies | Minimal base images, security scanning |
| Debug tools in production | Multi-stage builds strip dev dependencies |
| Environment leakage | `.dockerignore` prevents `.env` from entering image |

---

## Part 2: Containerize the Express API

### Step 1: Create the application files

```bash
mkdir -p ~/docker-lab/express-api && cd ~/docker-lab/express-api
```

Create `package.json`:

```json
{
  "name": "identity-api",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "express-oauth2-jwt-bearer": "^1.6.0"
  }
}
```

Create `server.js`:

```javascript
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check (for Docker and Kubernetes probes)
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/api/public", (req, res) => {
  res.json({ message: "Public endpoint — no auth required" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Identity API running on port ${PORT}`);
});
```

### Step 2: Create .dockerignore

```bash
cat > .dockerignore << 'EOF'
node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
Dockerfile
docker-compose*.yaml
README.md
*.md
EOF
```

> **Critical:** `.dockerignore` prevents `.env` files (with secrets) from being copied into the Docker image. Without this, your secrets could end up in a pushed image.

### Step 3: Write the Dockerfile (multi-stage)

Create `Dockerfile`:

```dockerfile
# ============================================================
# Stage 1: Install dependencies
# ============================================================
FROM node:18-alpine AS deps

# Set working directory
WORKDIR /app

# Copy ONLY package files first (better layer caching)
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# ============================================================
# Stage 2: Production image
# ============================================================
FROM node:18-alpine AS production

# Security: Don't run as root
# Create a non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

# Copy dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the port (documentation only — doesn't actually open it)
EXPOSE 3001

# Health check — Docker and ECS use this
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "server.js"]
```

**Why multi-stage?**
- Stage 1 installs dependencies in a temporary container
- Stage 2 copies only what's needed into a clean image
- Result: smaller image, no build tools in production

**Why `node:18-alpine`?**
- Alpine Linux is ~5MB vs ~900MB for full Debian
- Fewer packages = smaller attack surface

### Step 4: Build and test the image

```bash
# Build the image
docker build -t identity-api:latest .

# Check the image size
docker images identity-api
# Should be ~150-180MB (vs ~1GB for non-alpine)

# Run it
docker run -d --name identity-api -p 3001:3001 identity-api:latest

# Test
curl http://localhost:3001/health
# {"status":"healthy","timestamp":"..."}

curl http://localhost:3001/api/public
# {"message":"Public endpoint — no auth required"}

# Check it's running as non-root
docker exec identity-api whoami
# Should output: appuser (NOT root)

# Clean up
docker stop identity-api && docker rm identity-api
```

---

## Part 3: Docker Compose for Local Development

### Step 5: Create docker-compose.yaml

```bash
cd ~/docker-lab
```

Create `docker-compose.yaml`:

```yaml
version: "3.8"

services:
  # Identity API
  api:
    build:
      context: ./express-api
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - AUTH0_DOMAIN=${AUTH0_DOMAIN}
      - AUTH0_AUDIENCE=${AUTH0_AUDIENCE}
      - DATABASE_URL=postgresql://identity:labpass@postgres:5432/identity_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
      interval: 10s
      timeout: 3s
      retries: 5

  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: identity_db
      POSTGRES_USER: identity
      POSTGRES_PASSWORD: labpass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U identity -d identity_db"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Redis (for session/token caching)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

### Step 6: Create a `.env` file for Docker Compose

```bash
cat > .env << 'EOF'
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.identity-lab.local
EOF
```

### Step 7: Run the full stack

```bash
# Start all services
docker compose up -d

# Watch the logs
docker compose logs -f api

# Test the API
curl http://localhost:3001/health

# Check PostgreSQL
docker compose exec postgres psql -U identity -d identity_db -c "SELECT version();"

# Check Redis
docker compose exec redis redis-cli ping
# PONG

# Stop everything
docker compose down
# Add -v to also delete the database volume:
# docker compose down -v
```

---

## Part 4: Security Scanning

### Step 8: Scan your image for vulnerabilities

```bash
# Option 1: Docker Scout (built into Docker Desktop)
docker scout cves identity-api:latest

# Option 2: Trivy (open source)
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image identity-api:latest
```

Review the output. Fix any CRITICAL or HIGH vulnerabilities by updating base images or dependencies.

---

## Validation Checklist

- [ ] Multi-stage Dockerfile builds successfully
- [ ] Image runs as non-root user (not root)
- [ ] `.dockerignore` excludes `.env` and `node_modules`
- [ ] Health check endpoint works
- [ ] Docker Compose starts API + PostgreSQL + Redis
- [ ] All services healthy (check with `docker compose ps`)
- [ ] Image size is reasonable (<200MB for Alpine-based)
- [ ] Security scan completed with no critical vulnerabilities

---

**Next Lab**: [Lab 02: Deploy to Kubernetes →](./lab-02-kubernetes-deploy.md)
