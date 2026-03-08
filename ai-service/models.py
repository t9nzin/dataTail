"""Model loading and caching for MobileSAM and CLIP.

Models are loaded once at startup and cached as module-level singletons.
Uses MPS (Apple Silicon) when available, falling back to CPU.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from urllib.request import urlretrieve

import torch

logger = logging.getLogger("dataTail.models")

# ---------------------------------------------------------------------------
# Device selection
# ---------------------------------------------------------------------------

def _select_device() -> torch.device:
    if torch.backends.mps.is_available():
        logger.info("Using MPS (Apple Silicon) backend")
        return torch.device("mps")
    logger.info("MPS not available, falling back to CPU")
    return torch.device("cpu")

DEVICE = _select_device()

# ---------------------------------------------------------------------------
# Checkpoint paths
# ---------------------------------------------------------------------------

WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"
MOBILE_SAM_CHECKPOINT = WEIGHTS_DIR / "mobile_sam.pt"
MOBILE_SAM_URL = (
    "https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.pt"
)

# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------

_sam_predictor = None
_sam_model = None  # keep a reference to the raw model for the mask generator
_sam2_model = None  # ultralytics SAM2 model
_yolo_world_model = None  # YOLO-World open-vocabulary detector
_clip_model = None
_clip_preprocess = None
_clip_tokenizer = None

# ---------------------------------------------------------------------------
# MobileSAM
# ---------------------------------------------------------------------------

def _download_mobile_sam_checkpoint() -> None:
    """Download the MobileSAM checkpoint if it does not already exist."""
    if MOBILE_SAM_CHECKPOINT.exists():
        return
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading MobileSAM checkpoint to %s ...", MOBILE_SAM_CHECKPOINT)
    urlretrieve(MOBILE_SAM_URL, str(MOBILE_SAM_CHECKPOINT))
    logger.info("Download complete.")


def _load_sam() -> None:
    """Load MobileSAM model and build SamPredictor."""
    global _sam_predictor, _sam_model

    _download_mobile_sam_checkpoint()

    from mobile_sam import sam_model_registry, SamPredictor  # type: ignore

    model_type = "vit_t"
    sam = sam_model_registry[model_type](checkpoint=str(MOBILE_SAM_CHECKPOINT))
    # MPS doesn't support float64 which SAM's automatic mask generator needs,
    # so always load SAM on CPU to avoid runtime errors.
    sam.to(device="cpu")
    sam.eval()

    _sam_model = sam
    _sam_predictor = SamPredictor(sam)
    logger.info("MobileSAM loaded on cpu (MPS incompatible with SAM float64 ops)")


def get_sam_predictor():
    """Return the cached SamPredictor instance."""
    if _sam_predictor is None:
        _load_sam()
    return _sam_predictor


def get_sam_model():
    """Return the raw MobileSAM model (needed for SamAutomaticMaskGenerator)."""
    if _sam_model is None:
        _load_sam()
    return _sam_model


# ---------------------------------------------------------------------------
# SAM2 (via ultralytics) — more accurate than MobileSAM
# ---------------------------------------------------------------------------

def _load_sam2() -> None:
    """Load SAM2 via ultralytics. Auto-downloads weights on first use."""
    global _sam2_model
    from ultralytics import SAM

    _sam2_model = SAM("sam2.1_t.pt")
    logger.info("SAM2 (sam2.1_t) loaded via ultralytics")


def get_sam2_model():
    """Return the cached ultralytics SAM2 model."""
    if _sam2_model is None:
        _load_sam2()
    return _sam2_model


# ---------------------------------------------------------------------------
# YOLO-World (open-vocabulary object detection)
# ---------------------------------------------------------------------------

def _load_yolo_world() -> None:
    """Load YOLO-World for open-vocabulary detection. Auto-downloads weights."""
    global _yolo_world_model
    from ultralytics import YOLOWorld

    _yolo_world_model = YOLOWorld("yolov8x-worldv2.pt")
    logger.info("YOLO-World (yolov8x-worldv2) loaded")


def get_yolo_world_model():
    """Return the cached YOLO-World model."""
    if _yolo_world_model is None:
        _load_yolo_world()
    return _yolo_world_model


# ---------------------------------------------------------------------------
# CLIP (via open_clip)
# ---------------------------------------------------------------------------

def _load_clip() -> None:
    """Load CLIP ViT-B/16 via open_clip."""
    global _clip_model, _clip_preprocess, _clip_tokenizer

    import open_clip  # type: ignore

    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-16", pretrained="laion2b_s34b_b88k"
    )
    model = model.to(DEVICE)
    model.eval()

    tokenizer = open_clip.get_tokenizer("ViT-B-16")

    _clip_model = model
    _clip_preprocess = preprocess
    _clip_tokenizer = tokenizer
    logger.info("CLIP ViT-B/16 loaded on %s", DEVICE)


def get_clip_model():
    """Return the cached CLIP model."""
    if _clip_model is None:
        _load_clip()
    return _clip_model


def get_clip_preprocess():
    """Return the cached CLIP preprocessing transform."""
    if _clip_preprocess is None:
        _load_clip()
    return _clip_preprocess


def get_clip_tokenizer():
    """Return the cached CLIP tokenizer."""
    if _clip_tokenizer is None:
        _load_clip()
    return _clip_tokenizer


# ---------------------------------------------------------------------------
# Bulk loader (called at startup)
# ---------------------------------------------------------------------------

def load_all_models() -> None:
    """Pre-load every model so the first request is fast."""
    _load_sam()
    _load_clip()
    logger.info("All models loaded and ready.")
