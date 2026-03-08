const API = '/api';

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

function jsonPut(url, body) {
  return request(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function jsonDelete(url) {
  return request(url, { method: 'DELETE' });
}

// ── Identity ──────────────────────────────────────────────

export async function fetchMe() {
  return request(`${API}/me`);
}

// ── Projects ──────────────────────────────────────────────

export async function fetchProjects() {
  return request(`${API}/projects`);
}

export async function createProject(name, description) {
  return jsonPost(`${API}/projects`, { name, description });
}

export async function fetchProject(id) {
  return request(`${API}/projects/${id}`);
}

export async function deleteProject(id) {
  return jsonDelete(`${API}/projects/${id}`);
}

export async function fetchProjectActivity(id) {
  return request(`${API}/projects/${id}/activity`);
}

// ── Images ────────────────────────────────────────────────

export async function fetchImages(projectId) {
  return request(`${API}/projects/${projectId}/images`);
}

export async function uploadImages(projectId, files) {
  const form = new FormData();
  for (const file of files) form.append('images', file);
  const res = await fetch(`${API}/projects/${projectId}/images/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function fetchImage(imageId) {
  return request(`${API}/images/${imageId}`);
}

export async function deleteImage(imageId) {
  return jsonDelete(`${API}/images/${imageId}`);
}

export async function updateImageStatus(imageId, status) {
  return request(`${API}/images/${imageId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

// ── Annotations ───────────────────────────────────────────

export async function fetchAnnotations(imageId) {
  return request(`${API}/annotations/image/${imageId}`);
}

export async function createAnnotation(data) {
  // data: { image_id, project_id, label, type, data, source }
  return jsonPost(`${API}/annotations`, data);
}

export async function updateAnnotation(id, data) {
  return jsonPut(`${API}/annotations/${id}`, data);
}

export async function deleteAnnotation(id) {
  return jsonDelete(`${API}/annotations/${id}`);
}

export async function createAnnotationsBatch(annotations) {
  return jsonPost(`${API}/annotations/batch`, { annotations });
}

// ── Labels ────────────────────────────────────────────────

export async function fetchLabels(projectId) {
  return request(`${API}/projects/${projectId}/labels`);
}

export async function createLabel(projectId, name, color) {
  return jsonPost(`${API}/projects/${projectId}/labels`, { name, color });
}

export async function updateLabel(id, name, color, projectId) {
  return jsonPut(`${API}/projects/${projectId}/labels/${id}`, { name, color });
}

export async function deleteLabel(id, projectId) {
  return jsonDelete(`${API}/projects/${projectId}/labels/${id}`);
}

// ── AI ────────────────────────────────────────────────────

export async function segmentClick(imageId, points, labels) {
  return jsonPost(`${API}/ai/segment/click`, {
    image_id: imageId,
    points,
    labels,
  });
}

export async function segmentBox(imageId, box) {
  return jsonPost(`${API}/ai/segment/box`, {
    image_id: imageId,
    box,
  });
}

export async function segmentEverything(imageId) {
  return jsonPost(`${API}/ai/segment/everything`, {
    image_id: imageId,
  });
}

export async function segmentRefine(imageId, mask_rle, positivePoints, negativePoints) {
  return jsonPost(`${API}/ai/segment/refine`, {
    image_id: imageId,
    mask_rle,
    positive_points: positivePoints,
    negative_points: negativePoints,
  });
}

export async function clipClassify(imageId, labels) {
  return jsonPost(`${API}/ai/clip/classify`, {
    image_id: imageId,
    labels,
  });
}

export async function clipEmbed(imageId) {
  return jsonPost(`${API}/ai/clip/embed`, {
    image_id: imageId,
  });
}

export async function agentChat(imageId, message, projectId, history = []) {
  return jsonPost(`${API}/ai/agent/chat`, {
    image_id: imageId,
    project_id: projectId,
    message,
    history,
  });
}

export async function nlAnnotate(imageId, command, projectId) {
  return jsonPost(`${API}/ai/agent/nl-annotate`, {
    image_id: imageId,
    project_id: projectId,
    prompt: command,
  });
}

export async function qualityReview(projectId) {
  return jsonPost(`${API}/ai/agent/quality-review`, {
    project_id: projectId,
  });
}

export async function clearReviewIssues(projectId) {
  return fetch(`${API}/ai/agent/quality-review`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId }),
  }).then((r) => r.json());
}

export async function qualityReviewImage(imageId, projectId, projectLabels) {
  return jsonPost(`${API}/ai/agent/quality-review/image`, {
    image_id: imageId,
    project_id: projectId,
    project_labels: projectLabels || [],
  });
}

export async function datasetHealth(projectId) {
  return jsonPost(`${API}/ai/agent/dataset-health`, {
    project_id: projectId,
  });
}

// ── Export ────────────────────────────────────────────────

export async function exportSummary(projectId) {
  return request(`${API}/projects/${projectId}/export/summary`);
}

export async function exportDataset(projectId, format = 'coco', includeImages = false) {
  const params = new URLSearchParams({ format, includeImages: String(includeImages) });
  const res = await fetch(`${API}/projects/${projectId}/export?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || `export_${format}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Reviews ───────────────────────────────────────────────

export async function fetchReviewIssues(projectId) {
  return request(`${API}/reviews/project/${projectId}`);
}

export async function updateReviewIssue(id, status) {
  return jsonPut(`${API}/reviews/${id}`, { status });
}
