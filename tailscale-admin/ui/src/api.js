// All calls go through the main dataTail server at /api.
// The server enforces admin-only access on /api/tailnet/* routes.

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function jsonPost(url, body) {
  return request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function jsonDelete(url) {
  return request(url, { method: 'DELETE' });
}

// Identity / auth
export const fetchMe = () => request('/api/me');

// Devices
export const fetchDevices = () => request('/api/tailnet/devices');
export const removeDevice = (id) => jsonDelete(`/api/tailnet/devices/${id}`);

// ACL
export const fetchACL = () => request('/api/tailnet/acls');
export const updateACL = (policy) => jsonPost('/api/tailnet/acls', policy);

// Groups
export const fetchGroups = () => request('/api/tailnet/groups');
export const addUserToGroup = (group, user) =>
  jsonPost(`/api/tailnet/groups/${encodeURIComponent(group)}/add`, { user });
export const removeUserFromGroup = (group, user) =>
  jsonPost(`/api/tailnet/groups/${encodeURIComponent(group)}/remove`, { user });

// Users
export const fetchUserRoles = (user) =>
  request(`/api/tailnet/users/${encodeURIComponent(user)}/roles`);
export const revokeUser = (user) =>
  jsonPost(`/api/tailnet/users/${encodeURIComponent(user)}/revoke`, {});
