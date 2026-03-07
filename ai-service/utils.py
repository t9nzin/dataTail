"""Shared utilities for the dataTail AI service."""

from __future__ import annotations

import io
import math
from typing import Any

import numpy as np
from fastapi import UploadFile
from PIL import Image


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

async def image_from_upload(file: UploadFile) -> tuple[Image.Image, np.ndarray]:
    """Read an ``UploadFile`` into a PIL Image and a numpy RGB array."""
    data = await file.read()
    pil_image = Image.open(io.BytesIO(data)).convert("RGB")
    np_image = np.array(pil_image)
    return pil_image, np_image


def crop_region(image: Image.Image, bbox: dict[str, int]) -> Image.Image:
    """Crop a PIL image by a bbox dict ``{x, y, w, h}``."""
    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
    return image.crop((x, y, x + w, y + h))


# ---------------------------------------------------------------------------
# Mask  -->  polygon  (using OpenCV findContours for correct ordering)
# ---------------------------------------------------------------------------

def mask_to_polygon(mask: np.ndarray, simplify_tolerance: float = 2.0) -> list[list[int]]:
    """Convert a binary mask to an ordered list of ``[x, y]`` boundary points.

    Uses OpenCV findContours for proper contour tracing, then simplifies
    with approxPolyDP.  Returns the largest contour.
    """
    import cv2

    if mask.ndim != 2:
        raise ValueError("mask must be 2-D")

    binary = mask.astype(np.uint8)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return []

    # Take the largest contour by area
    largest = max(contours, key=cv2.contourArea)

    # Simplify
    epsilon = simplify_tolerance
    approx = cv2.approxPolyDP(largest, epsilon, closed=True)

    # Convert from OpenCV's (N, 1, 2) shape to [[x, y], ...]
    return approx.reshape(-1, 2).tolist()


# ---------------------------------------------------------------------------
# Run-Length Encoding
# ---------------------------------------------------------------------------

def mask_to_rle(mask: np.ndarray) -> dict[str, Any]:
    """Encode a binary mask as run-length encoding.

    Returns ``{"counts": [...], "size": [height, width]}``.
    Counts alternate between runs of 0s and 1s, starting with 0.
    """
    flat = mask.astype(np.uint8).ravel(order="C")
    if len(flat) == 0:
        return {"counts": [], "size": list(mask.shape)}

    diffs = np.diff(flat)
    change_indices = np.where(diffs != 0)[0] + 1
    change_indices = np.concatenate([[0], change_indices, [len(flat)]])
    counts = np.diff(change_indices).tolist()

    # Ensure we start with a run of 0s.
    if flat[0] == 1:
        counts = [0] + counts

    return {"counts": counts, "size": [int(mask.shape[0]), int(mask.shape[1])]}


def rle_to_mask(rle: dict[str, Any], shape: tuple[int, int] | None = None) -> np.ndarray:
    """Decode an RLE dict back into a binary mask."""
    if shape is None:
        shape = tuple(rle["size"])
    counts = rle["counts"]
    mask_flat = np.zeros(shape[0] * shape[1], dtype=np.uint8)
    pos = 0
    for i, c in enumerate(counts):
        if i % 2 == 1:
            mask_flat[pos: pos + c] = 1
        pos += c
    return mask_flat.reshape(shape)


# ---------------------------------------------------------------------------
# IoU
# ---------------------------------------------------------------------------

def compute_iou(mask1: np.ndarray, mask2: np.ndarray) -> float:
    """Compute Intersection-over-Union for two binary masks."""
    intersection = np.logical_and(mask1, mask2).sum()
    union = np.logical_or(mask1, mask2).sum()
    if union == 0:
        return 0.0
    return float(intersection / union)
