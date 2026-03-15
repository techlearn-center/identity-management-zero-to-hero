# Lab 02: Implement Identity Lifecycle Management

## Objective

Design and implement a complete identity lifecycle management system covering user provisioning, access management, periodic access reviews, and secure deprovisioning.

---

## Prerequisites

- Completed Lab 01 (RBAC model)
- Node.js 20+ installed
- PostgreSQL running

---

## Scenario

You are implementing identity lifecycle management for **ProjectHub**. The HR system sends events (hire, transfer, terminate), and your system must automatically provision and deprovision user access.

---

## Part 1: Design the Lifecycle State Machine

### Step 1: Define User States

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PENDING  │────▶│  ACTIVE  │────▶│ SUSPENDED│────▶│ ARCHIVED │
│          │     │          │     │          │     │          │
│ Awaiting │     │ Full     │     │ Temp     │     │ Permanent│
│ approval │     │ access   │     │ disabled │     │ removal  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │                ▼                │                │
     │           ┌──────────┐         │                │
     └──────────▶│ REJECTED │◀────────┘                │
                 └──────────┘                          │
                      │                                │
                      └────────────────────────────────┘
                            (data retention period)
```

### Step 2: Define Lifecycle Events

```javascript
const LIFECYCLE_EVENTS = {
  // Onboarding
  USER_CREATED:      'user.created',
  USER_APPROVED:     'user.approved',
  USER_REJECTED:     'user.rejected',
  USER_ACTIVATED:    'user.activated',
  MFA_ENROLLED:      'user.mfa_enrolled',

  // Access Changes
  ROLE_ASSIGNED:     'user.role_assigned',
  ROLE_REMOVED:      'user.role_removed',
  ACCESS_GRANTED:    'user.access_granted',
  ACCESS_REVOKED:    'user.access_revoked',

  // Reviews
  ACCESS_REVIEWED:   'user.access_reviewed',
  ACCESS_CERTIFIED:  'user.access_certified',
  ACCESS_FLAGGED:    'user.access_flagged',

  // Offboarding
  USER_SUSPENDED:    'user.suspended',
  USER_REACTIVATED:  'user.reactivated',
  USER_DEPROVISIONED:'user.deprovisioned',
  USER_ARCHIVED:     'user.archived',
  USER_DELETED:      'user.deleted',
};
```

### Step 3: Create the Database Schema

```sql
-- User lifecycle states
CREATE TYPE user_status AS ENUM (
    'pending', 'active', 'suspended', 'archived', 'rejected'
);

-- Users table with lifecycle fields
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    status          user_status NOT NULL DEFAULT 'pending',
    department      VARCHAR(100),
    manager_id      UUID REFERENCES users(id),
    hire_date       DATE,
    termination_date DATE,
    last_login      TIMESTAMP,
    mfa_enrolled    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    archived_at     TIMESTAMP
);

-- Lifecycle audit log (immutable)
CREATE TABLE lifecycle_events (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id),
    event_type  VARCHAR(50) NOT NULL,
    old_status  user_status,
    new_status  user_status,
    performed_by UUID,
    reason      TEXT,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Access review campaigns
CREATE TABLE access_reviews (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    reviewer_id     UUID NOT NULL REFERENCES users(id),
    status          VARCHAR(20) DEFAULT 'open',
    due_date        DATE NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    completed_at    TIMESTAMP
);

-- Individual access review items
CREATE TABLE access_review_items (
    id              SERIAL PRIMARY KEY,
    review_id       INT REFERENCES access_reviews(id),
    user_id         UUID REFERENCES users(id),
    role_id         INT,
    decision        VARCHAR(20),  -- 'approve', 'revoke', 'modify'
    reviewer_notes  TEXT,
    decided_at      TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_lifecycle_events_user ON lifecycle_events(user_id);
CREATE INDEX idx_lifecycle_events_type ON lifecycle_events(event_type);
CREATE INDEX idx_access_reviews_status ON access_reviews(status);
```

---

## Part 2: Implement Provisioning Workflow

### Step 4: Build the Provisioning Service

```javascript
// lifecycle-service.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/projecthub'
});

class LifecycleService {

  // Step 1: Create user (triggered by HR system)
  async createUser(userData, performedBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create user in pending state
      const result = await client.query(
        `INSERT INTO users (email, display_name, department, manager_id, hire_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, status`,
        [userData.email, userData.displayName, userData.department,
         userData.managerId, userData.hireDate]
      );

      const user = result.rows[0];

      // Log lifecycle event
      await this.logEvent(client, {
        userId: user.id,
        eventType: 'user.created',
        newStatus: 'pending',
        performedBy,
        metadata: { source: 'hr_system', department: userData.department }
      });

      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Step 2: Approve and activate user
  async activateUser(userId, performedBy, roles = ['member']) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update status to active
      const result = await client.query(
        `UPDATE users SET status = 'active', updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id, email, status`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found or not in pending state');
      }

      // Assign default roles
      for (const roleName of roles) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by)
           SELECT $1, id, $2 FROM roles WHERE name = $3`,
          [userId, performedBy, roleName]
        );
      }

      // Log event
      await this.logEvent(client, {
        userId,
        eventType: 'user.activated',
        oldStatus: 'pending',
        newStatus: 'active',
        performedBy,
        metadata: { roles_assigned: roles }
      });

      await client.query('COMMIT');

      // Trigger downstream actions
      await this.sendWelcomeEmail(userId);
      await this.notifyManager(userId);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Step 3: Suspend user (leave, investigation, etc.)
  async suspendUser(userId, performedBy, reason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE users SET status = 'suspended', updated_at = NOW()
         WHERE id = $1 AND status = 'active'
         RETURNING id, email`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found or not active');
      }

      await this.logEvent(client, {
        userId,
        eventType: 'user.suspended',
        oldStatus: 'active',
        newStatus: 'suspended',
        performedBy,
        reason,
      });

      await client.query('COMMIT');

      // Revoke all active sessions
      await this.revokeAllSessions(userId);

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Step 4: Deprovision user (termination)
  async deprovisionUser(userId, performedBy, reason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove all role assignments
      await client.query(
        'DELETE FROM user_roles WHERE user_id = $1',
        [userId]
      );

      // Update status to archived
      await client.query(
        `UPDATE users
         SET status = 'archived',
             termination_date = CURRENT_DATE,
             archived_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, email`,
        [userId]
      );

      await this.logEvent(client, {
        userId,
        eventType: 'user.deprovisioned',
        oldStatus: 'active',
        newStatus: 'archived',
        performedBy,
        reason,
        metadata: { roles_removed: 'all', sessions_revoked: true }
      });

      await client.query('COMMIT');

      // Downstream cleanup
      await this.revokeAllSessions(userId);
      await this.revokeAllTokens(userId);
      await this.transferOwnership(userId, performedBy);
      await this.notifyIT(userId, 'deprovisioned');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Helper: Log lifecycle event
  async logEvent(client, { userId, eventType, oldStatus, newStatus, performedBy, reason, metadata }) {
    await client.query(
      `INSERT INTO lifecycle_events
       (user_id, event_type, old_status, new_status, performed_by, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, eventType, oldStatus, newStatus, performedBy, reason, JSON.stringify(metadata || {})]
    );
  }

  // Placeholder methods for downstream actions
  async sendWelcomeEmail(userId) { console.log(`Welcome email sent to ${userId}`); }
  async notifyManager(userId) { console.log(`Manager notified for ${userId}`); }
  async revokeAllSessions(userId) { console.log(`Sessions revoked for ${userId}`); }
  async revokeAllTokens(userId) { console.log(`Tokens revoked for ${userId}`); }
  async transferOwnership(userId, newOwner) { console.log(`Ownership transferred from ${userId}`); }
  async notifyIT(userId, action) { console.log(`IT notified: ${action} for ${userId}`); }
}

module.exports = LifecycleService;
```

---

## Part 3: Implement Access Reviews

### Step 5: Build Access Review Campaign

```javascript
class AccessReviewService {

  // Create a new access review campaign
  async createReview(reviewData) {
    const result = await pool.query(
      `INSERT INTO access_reviews (name, description, reviewer_id, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [reviewData.name, reviewData.description, reviewData.reviewerId, reviewData.dueDate]
    );

    const reviewId = result.rows[0].id;

    // Generate review items for all active user-role assignments
    await pool.query(
      `INSERT INTO access_review_items (review_id, user_id, role_id)
       SELECT $1, ur.user_id, ur.role_id
       FROM user_roles ur
       JOIN users u ON ur.user_id = u.id
       WHERE u.status = 'active'`,
      [reviewId]
    );

    return reviewId;
  }

  // Process a review decision
  async submitDecision(itemId, decision, reviewerNotes, reviewerId) {
    const result = await pool.query(
      `UPDATE access_review_items
       SET decision = $1, reviewer_notes = $2, decided_at = NOW()
       WHERE id = $3
       RETURNING user_id, role_id`,
      [decision, reviewerNotes, itemId]
    );

    const item = result.rows[0];

    // If decision is 'revoke', remove the role
    if (decision === 'revoke') {
      await pool.query(
        'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
        [item.user_id, item.role_id]
      );
    }

    return item;
  }

  // Get overdue reviews
  async getOverdueReviews() {
    const result = await pool.query(
      `SELECT ar.*, COUNT(ari.id) as pending_items
       FROM access_reviews ar
       LEFT JOIN access_review_items ari ON ar.id = ari.review_id AND ari.decision IS NULL
       WHERE ar.status = 'open' AND ar.due_date < CURRENT_DATE
       GROUP BY ar.id`
    );
    return result.rows;
  }
}
```

---

## Part 4: Deprovisioning Checklist

### Step 6: Implement Offboarding Workflow

Create a comprehensive offboarding checklist:

```javascript
const OFFBOARDING_CHECKLIST = [
  { id: 1,  task: 'Disable user account in IdP',          automated: true  },
  { id: 2,  task: 'Revoke all active sessions',           automated: true  },
  { id: 3,  task: 'Revoke OAuth tokens',                  automated: true  },
  { id: 4,  task: 'Remove from all roles/groups',         automated: true  },
  { id: 5,  task: 'Disable email forwarding',             automated: false },
  { id: 6,  task: 'Transfer file ownership',              automated: true  },
  { id: 7,  task: 'Remove from Slack/Teams',              automated: true  },
  { id: 8,  task: 'Revoke VPN access',                    automated: true  },
  { id: 9,  task: 'Remove SSH keys',                      automated: true  },
  { id: 10, task: 'Rotate shared credentials',            automated: false },
  { id: 11, task: 'Collect hardware (laptop, badge)',     automated: false },
  { id: 12, task: 'Archive mailbox per retention policy', automated: true  },
  { id: 13, task: 'Remove from distribution lists',       automated: true  },
  { id: 14, task: 'Document data retention compliance',   automated: false },
];
```

---

## Validation Checklist

- [ ] User states machine is complete (pending → active → suspended → archived)
- [ ] All state transitions are logged in lifecycle_events
- [ ] Provisioning assigns correct default roles
- [ ] Deprovisioning removes all access (roles, sessions, tokens)
- [ ] Access review campaign generates items for all active users
- [ ] Review decisions trigger automatic access changes
- [ ] Offboarding checklist covers all access points

---

## Troubleshooting

| Issue | Solution |
|---|---|
| State transition fails | Check current status matches expected status in WHERE clause |
| Events not logging | Verify transaction is committed, not rolled back |
| Roles not removed on deprovision | Check CASCADE on foreign keys |
| Access review misses users | Verify JOIN includes all active user_roles |

---

**Next Lab**: [Lab 03: Zero Trust Assessment →](./lab-03-zero-trust-assessment.md)
