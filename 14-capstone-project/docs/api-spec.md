# Capstone API Specification

## Base URL
`http://localhost:3001/api`

## Authentication
All endpoints (except health) require `Authorization: Bearer <access_token>`

## Endpoints

### Health
- `GET /api/health` - Health check (public)

### Users
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update profile

### Organizations
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create organization (admin)
- `GET /api/organizations/:id/members` - List members
- `POST /api/organizations/:id/members` - Invite member

### Data
- `GET /api/data` - List data (scoped to org)
- `POST /api/data` - Create data (requires write:data)
- `DELETE /api/data/:id` - Delete data (requires admin:all)
