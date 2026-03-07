// Uses Node 18+ built-in global fetch — no node-fetch dependency needed.

const TAILNET = process.env.TS_NET;
const API_KEY = process.env.TS_KEY;

if (!TAILNET) throw new Error('TS_NET environment variable is not set.');
if (!API_KEY) throw new Error('TS_KEY environment variable is not set.');

const BASE_URL = `https://api.tailscale.com/api/v2/tailnet/${TAILNET}`;
const DEVICE_BASE_URL = 'https://api.tailscale.com/api/v2/device';

export interface Device {
  id: string;
  hostname: string;
  user: string;
  online: boolean;
}

interface DevicesResponse {
  devices: Device[];
}

export interface ACLRule {
  action: 'accept' | 'deny';
  users: string[];
  ports: string[];
}

export interface ACLConfig {
  acls: ACLRule[];
  groups?: Record<string, string[]>;
  hosts?: Record<string, string>;
}

export interface ACLState {
  policy: ACLConfig;
  etag: string;
}

async function api(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tailscale API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getACL(): Promise<ACLState> {
  const res = await fetch(`${BASE_URL}/acl`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ACL: ${res.status}`);
  }

  const etag = res.headers.get('etag');
  if (!etag) throw new Error('Missing ETag from ACL response');

  const policy = (await res.json()) as ACLConfig;
  return { policy, etag };
}

export async function listDevices(): Promise<Device[]> {
  const data = (await api('/devices')) as DevicesResponse;
  return data.devices;
}

export async function removeDevice(deviceId: string): Promise<void> {
  const res = await fetch(`${DEVICE_BASE_URL}/${deviceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to remove device ${deviceId}: ${res.status} ${await res.text()}`);
  }
}

export async function updateACL(policy: ACLConfig, etag: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/acl`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'If-Match': etag,
    },
    body: JSON.stringify(policy),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ACL update failed: ${res.status} ${text}`);
  }
}

export async function addUserToGroup(user: string, group: string): Promise<void> {
  const { policy, etag } = await getACL();
  const key = `group:${group}`;
  if (!policy.groups) policy.groups = {};
  if (!policy.groups[key]) policy.groups[key] = [];
  if (!policy.groups[key].includes(user)) {
    policy.groups[key].push(user);
  }
  await updateACL(policy, etag);
}

export async function removeUserFromGroup(user: string, group: string): Promise<void> {
  const { policy, etag } = await getACL();
  const key = `group:${group}`;
  if (!policy.groups?.[key]) return;
  policy.groups[key] = policy.groups[key].filter((u) => u !== user);
  await updateACL(policy, etag);
}

export async function listRoles(): Promise<Record<string, string[]>> {
  const { policy } = await getACL();
  return policy.groups ?? {};
}

export async function getUserRoles(user: string): Promise<string[]> {
  const { policy } = await getACL();
  const roles: string[] = [];
  if (!policy.groups) return roles;
  for (const [group, users] of Object.entries(policy.groups)) {
    if (users.includes(user)) {
      roles.push(group.replace('group:', ''));
    }
  }
  return roles;
}

export async function revokeUser(user: string): Promise<void> {
  // Remove from all ACL groups
  const { policy, etag } = await getACL();
  if (policy.groups) {
    for (const group of Object.keys(policy.groups)) {
      policy.groups[group] = policy.groups[group].filter((u) => u !== user);
    }
  }
  await updateACL(policy, etag);

  // Remove all devices belonging to this user
  const devices = await listDevices();
  for (const d of devices.filter((d) => d.user === user)) {
    await removeDevice(d.id);
  }
}
