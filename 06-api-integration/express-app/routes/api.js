const router = require('express').Router();
const { checkPermission } = require('../middleware/rbac');

// GET /api/users/me - Any authenticated user
router.get('/users/me', (req, res) => {
  res.json({
    user_id: req.auth.sub,
    email: req.auth.email || req.auth[`${process.env.AUTH0_NAMESPACE}/email`],
    permissions: req.auth.permissions || [],
  });
});

// GET /api/data - Requires read:data permission
router.get('/data', checkPermission('read:data'), (req, res) => {
  res.json({ data: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }] });
});

// POST /api/data - Requires write:data permission
router.post('/data', checkPermission('write:data'), (req, res) => {
  res.status(201).json({ id: 3, ...req.body, created_by: req.auth.sub });
});

// DELETE /api/data/:id - Requires admin:all permission
router.delete('/data/:id', checkPermission('admin:all'), (req, res) => {
  res.json({ deleted: req.params.id });
});

module.exports = router;
