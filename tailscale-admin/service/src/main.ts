import * as dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import {
  listDevices,
  removeDevice,
  getACL,
  updateACL,
  addUserToGroup,
  removeUserFromGroup,
  listRoles,
  getUserRoles,
  revokeUser,
  ACLConfig,
} from './tail_admin';

// Extend Express Request with user field
declare global {
  namespace Express {
    interface Request {
      user: string;
    }
  }
}

const app = express();
app.use(express.json());

const PORT = Number(process.env.ADMIN_PORT) || 4000;

// --- User identity middleware ---
// In production over Tailscale serve, the tailscale-user-login header is injected by the Tailscale proxy.
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.user = (req.headers['tailscale-user-login'] as string) || 'unknown';
  next();
});

// --- Admin check helper ---
async function isAdmin(user: string): Promise<boolean> {
  try {
    const roles = await getUserRoles(user);
    return roles.includes('admins');
  } catch {
    return false;
  }
}

// --- Internal endpoint (called only by the main dataTail server, not exposed publicly) ---
// Returns whether a given user login is in group:admins.
app.get('/internal/check-admin/:user', async (req: Request, res: Response) => {
  try {
    const admin = await isAdmin(req.params.user);
    res.json({ user: req.params.user, isAdmin: admin });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Health check (public) ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// --- Admin guard middleware ---
const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user;
  if (!user || user === 'unknown') {
    res.status(401).json({ error: 'No Tailscale user identity. Are you accessing over Tailscale serve?' });
    return;
  }
  const admin = await isAdmin(user);
  if (!admin) {
    res.status(403).json({ error: `User "${user}" is not in group:admins` });
    return;
  }
  next();
};

// All routes below require admin
app.use(requireAdmin);

// --- Device routes ---

app.get('/devices', async (_req: Request, res: Response) => {
  try {
    const devices = await listDevices();
    res.json({ success: true, devices });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

app.delete('/devices/:id', async (req: Request, res: Response) => {
  try {
    await removeDevice(req.params.id);
    res.json({ success: true, message: `Device ${req.params.id} removed.` });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// --- ACL routes ---

app.get('/acls', async (_req: Request, res: Response) => {
  try {
    const { policy } = await getACL();
    res.json({ success: true, policy });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

app.post('/acls', async (req: Request, res: Response) => {
  try {
    const policy: ACLConfig = req.body;
    const { etag } = await getACL();
    await updateACL(policy, etag);
    res.json({ success: true, message: 'ACL updated.' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// --- Group routes ---

app.get('/groups', async (_req: Request, res: Response) => {
  try {
    const groups = await listRoles();
    res.json({ success: true, groups });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

app.post('/groups/:group/add', async (req: Request, res: Response) => {
  try {
    const { user } = req.body as { user?: string };
    if (!user) {
      res.status(400).json({ success: false, error: 'Missing user in body' });
      return;
    }
    await addUserToGroup(user, req.params.group);
    res.json({ success: true, message: `Added ${user} to group:${req.params.group}` });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

app.post('/groups/:group/remove', async (req: Request, res: Response) => {
  try {
    const { user } = req.body as { user?: string };
    if (!user) {
      res.status(400).json({ success: false, error: 'Missing user in body' });
      return;
    }
    await removeUserFromGroup(user, req.params.group);
    res.json({ success: true, message: `Removed ${user} from group:${req.params.group}` });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// --- User routes ---

app.get('/users/:user/roles', async (req: Request, res: Response) => {
  try {
    const roles = await getUserRoles(req.params.user);
    res.json({ success: true, user: req.params.user, roles });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Revoke: remove from all groups + delete all their devices
app.post('/users/:user/revoke', async (req: Request, res: Response) => {
  try {
    await revokeUser(req.params.user);
    res.json({ success: true, message: `User ${req.params.user} fully revoked.` });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Listen only on loopback — never exposed directly, only accessed by the main server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Tailscale Admin Service running at http://127.0.0.1:${PORT}`);
  console.log(`  Tailnet: ${process.env.TS_NET}`);
});
