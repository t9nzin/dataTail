import express from 'express';

const router = express.Router();

const TAILNET_SERVICE = process.env.TAILNET_SERVICE_URL || 'http://127.0.0.1:4000';

// Ask the tailscale-admin service whether the given user is in group:admins.
// Returns false if the service is unreachable (fail closed).
async function checkAdmin(user) {
  try {
    const res = await fetch(
      `${TAILNET_SERVICE}/internal/check-admin/${encodeURIComponent(user)}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.isAdmin === true;
  } catch {
    return false;
  }
}

// Middleware: reject non-admins before proxying anything
async function requireAdmin(req, res, next) {
  const admin = await checkAdmin(req.user);
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.use(requireAdmin);

// Forward a request to the tailscale-admin service, injecting the Tailscale identity header.
async function proxy(req, res, servicePath) {
  try {
    const url = `${TAILNET_SERVICE}${servicePath}`;
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method);
    const fetchRes = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'tailscale-user-login': req.user,
      },
      ...(hasBody ? { body: JSON.stringify(req.body) } : {}),
    });
    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Tailscale admin service unavailable', detail: err.message });
  }
}

// Devices
router.get('/devices', (req, res) => proxy(req, res, '/devices'));
router.delete('/devices/:id', (req, res) => proxy(req, res, `/devices/${req.params.id}`));

// ACL
router.get('/acls', (req, res) => proxy(req, res, '/acls'));
router.post('/acls', (req, res) => proxy(req, res, '/acls'));

// Groups
router.get('/groups', (req, res) => proxy(req, res, '/groups'));
router.post('/groups/:group/add', (req, res) =>
  proxy(req, res, `/groups/${req.params.group}/add`)
);
router.post('/groups/:group/remove', (req, res) =>
  proxy(req, res, `/groups/${req.params.group}/remove`)
);

// Users
router.get('/users/:user/roles', (req, res) =>
  proxy(req, res, `/users/${encodeURIComponent(req.params.user)}/roles`)
);
router.post('/users/:user/revoke', (req, res) =>
  proxy(req, res, `/users/${encodeURIComponent(req.params.user)}/revoke`)
);

export default router;
