"""AI Agent endpoints for natural-language annotation, quality review, and dataset health."""

from __future__ import annotations

import json
import logging
import math
import re
from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional

import numpy as np
import ollama
import torch
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from models import DEVICE, get_clip_model, get_clip_preprocess, get_clip_tokenizer, get_sam_model, get_sam2_model, get_yolo_world_model
from utils import (
    crop_region,
    image_from_upload,
    mask_to_polygon,
    mask_to_rle,
)

logger = logging.getLogger("dataTail.agents")
router = APIRouter(prefix="/agent", tags=["agents"])


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _clip_prompted(labels: list[str]) -> list[str]:
    """Wrap labels in a CLIP prompt template for better zero-shot accuracy."""
    return [f"a photo of a {l}" for l in labels]


def _clip_encode_image_pil(pil_img) -> np.ndarray:
    preprocess = get_clip_preprocess()
    model = get_clip_model()
    img_tensor = preprocess(pil_img).unsqueeze(0).to(DEVICE)
    with torch.no_grad(), torch.amp.autocast(device_type=str(DEVICE)):
        features = model.encode_image(img_tensor)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy().flatten()


def _clip_encode_text(texts: list[str]) -> np.ndarray:
    tokenizer = get_clip_tokenizer()
    model = get_clip_model()
    tokens = tokenizer(texts).to(DEVICE)
    with torch.no_grad(), torch.amp.autocast(device_type=str(DEVICE)):
        features = model.encode_text(tokens)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy()


def _segment_everything(np_img: np.ndarray, points_per_side: int = 32) -> list[dict]:
    from segment_anything import SamAutomaticMaskGenerator  # type: ignore

    sam_model = get_sam_model()
    generator = SamAutomaticMaskGenerator(
        model=sam_model,
        points_per_side=points_per_side,
        pred_iou_thresh=0.86,
        stability_score_thresh=0.92,
        min_mask_region_area=100,
    )
    return generator.generate(np_img)


def _segment_everything_sam2(pil_img) -> list[dict]:
    """Use ultralytics SAM2 for segment-everything. Returns list of dicts
    with 'bbox' [x,y,w,h], 'segmentation' (binary mask), and 'area'."""
    import tempfile
    sam2 = get_sam2_model()

    # SAM2 needs a file path
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        pil_img.save(f, format="JPEG")
        tmp_path = f.name

    try:
        results = sam2.predict(tmp_path, stream=False)
    finally:
        import os
        os.unlink(tmp_path)

    masks_data = []
    if results and results[0].masks is not None:
        masks = results[0].masks.data.cpu().numpy()
        boxes = results[0].boxes.xyxy.cpu().numpy()
        for i in range(len(masks)):
            binary = masks[i].astype(np.uint8)
            x1, y1, x2, y2 = boxes[i]
            x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
            area = int(binary.sum())
            masks_data.append({
                "bbox": [x, y, w, h],
                "segmentation": binary,
                "area": area,
            })
    return masks_data


def _detect_and_segment(pil_img, labels: list[str], conf: float = 0.2) -> list[dict]:
    """Use YOLO-World for detection + SAM2 for precise masks.
    Returns list of dicts with label, confidence, bbox, segmentation mask.
    Only returns detections whose label is in the requested *labels* list."""
    import tempfile, os

    yolo = get_yolo_world_model()
    sam2 = get_sam2_model()

    # Add a small set of contrastive/negative classes so YOLO-World can
    # discriminate.  Too many dilutes confidence; too few causes false positives.
    # Pick semantically close categories first (animals if target is animal, etc.)
    target_set = {l.lower() for l in labels}
    # Nearby animal/object categories make the best contrastive set
    _ANIMAL_WORDS = {"dog", "cat", "bird", "horse", "cow", "sheep", "fish", "bear"}
    target_is_animal = bool(target_set & _ANIMAL_WORDS)
    if target_is_animal:
        contrastive = [c for c in COMMON_CATEGORIES
                       if c.lower() not in target_set and c.lower() in _ANIMAL_WORDS]
    else:
        contrastive = [c for c in COMMON_CATEGORIES if c.lower() not in target_set]
    all_classes = list(labels) + contrastive[:6]

    # Save image to temp file (ultralytics needs a path)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        pil_img.save(f, format="JPEG")
        tmp_path = f.name

    try:
        # Step 1: YOLO-World detects objects by text labels
        yolo.set_classes(all_classes)
        det_results = yolo.predict(tmp_path, conf=conf, verbose=False)[0]

        if len(det_results.boxes) == 0:
            return []

        # Filter to only boxes matching the requested labels
        keep_indices = []
        for i, box in enumerate(det_results.boxes):
            cls_idx = int(box.cls[0])
            if yolo.names[cls_idx].lower() in target_set:
                keep_indices.append(i)

        if not keep_indices:
            return []

        # Step 2: SAM2 generates precise masks using detected bboxes
        all_bboxes = det_results.boxes.xyxy.cpu().numpy().tolist()
        kept_bboxes = [all_bboxes[i] for i in keep_indices]
        seg_results = sam2.predict(tmp_path, bboxes=kept_bboxes, verbose=False)[0]

        results = []
        for seg_i, det_i in enumerate(keep_indices):
            box = det_results.boxes[det_i]
            cls_idx = int(box.cls[0])
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)

            binary = seg_results.masks.data[seg_i].cpu().numpy().astype(np.uint8)
            results.append({
                "label": yolo.names[cls_idx],
                "confidence": round(confidence, 3),
                "bbox": [x, y, w, h],
                "segmentation": binary,
            })

        return results
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# POST /agent/nl-annotate
# ---------------------------------------------------------------------------

class NLAnnotateMatch(BaseModel):
    label: str
    confidence: float
    bbox: List[int]  # [x, y, w, h]
    polygon: List[List[int]]
    rle: Dict[str, Any]


class NLAnnotateResponse(BaseModel):
    command: str
    parsed_query: str
    matches: List[NLAnnotateMatch]
    total_segments: int


_ANNOTATE_PATTERNS = [
    # "annotate all cars", "find every person", "select all dogs"
    re.compile(r"(?:annotate|find|select|detect|label|mark)\s+(?:all|every|each)?\s*(.+)", re.I),
    # "how many cars", "count the dogs"
    re.compile(r"(?:how many|count(?:\s+the)?)\s+(.+)", re.I),
]


def _parse_command(command: str) -> str:
    """Extract the target noun/phrase from a natural-language command."""
    for pattern in _ANNOTATE_PATTERNS:
        m = pattern.match(command.strip())
        if m:
            return m.group(1).strip().rstrip("?.,!")
    # Fallback: use the whole command as a query.
    return command.strip()


@router.post("/nl-annotate", response_model=NLAnnotateResponse)
async def nl_annotate(
    image: UploadFile = File(...),
    command: str = Form(...),
    threshold: float = Form(0.25),
):
    """Natural-language annotation: segment the image, classify each segment,
    and return those matching the command.

    Examples of *command*:
    - ``"annotate all cars"``
    - ``"how many people are there?"``
    - ``"find every dog"``
    """
    query_noun = _parse_command(command)
    if not query_noun:
        raise HTTPException(status_code=422, detail="Could not parse a target from the command")

    pil_img, np_img = await image_from_upload(image)

    # 1. Segment everything.
    masks_data = _segment_everything(np_img, points_per_side=32)

    # 2. Encode target text once.
    text_emb = _clip_encode_text([query_noun, "other", "background"])  # (3, D)
    target_vec = text_emb[0]  # the query noun vector

    # 3. Score each segment.
    matches: List[NLAnnotateMatch] = []
    for entry in masks_data:
        x, y, w, h = [int(v) for v in entry["bbox"]]
        # Guard against degenerate crops.
        if w < 2 or h < 2:
            continue

        crop = pil_img.crop((x, y, x + w, y + h))
        img_emb = _clip_encode_image_pil(crop)

        # Cosine similarity with all text embeddings -> softmax.
        sims = text_emb @ img_emb  # (3,)
        exp = np.exp(sims - sims.max())
        probs = exp / exp.sum()
        confidence = float(probs[0])

        if confidence >= threshold:
            binary = entry["segmentation"].astype(np.uint8)
            matches.append(
                NLAnnotateMatch(
                    label=query_noun,
                    confidence=confidence,
                    bbox=[x, y, w, h],
                    polygon=mask_to_polygon(binary),
                    rle=mask_to_rle(binary),
                )
            )

    matches.sort(key=lambda m: m.confidence, reverse=True)

    return NLAnnotateResponse(
        command=command,
        parsed_query=query_noun,
        matches=matches,
        total_segments=len(masks_data),
    )


# ---------------------------------------------------------------------------
# POST /agent/quality-review
# ---------------------------------------------------------------------------

class QualityIssue(BaseModel):
    type: str  # "label_mismatch" | "missing_annotation"
    severity: str  # "high" | "medium" | "low"
    message: str
    annotation_id: Optional[str] = None
    suggestion: Optional[str] = None
    bbox: Optional[List[float]] = None  # [x1, y1, x2, y2] for missing annotation regions
    predicted_label: Optional[str] = None
    confidence: Optional[float] = None


class QualityReviewResponse(BaseModel):
    issues: List[QualityIssue]
    summary: str


@router.post("/quality-review", response_model=QualityReviewResponse)
async def quality_review(
    image: UploadFile = File(...),
    annotations: str = Form(...),
    project_labels: str = Form("[]"),
):
    """Review annotation quality on an image.

    *annotations*: JSON list of ``{"label": str, "bbox": {x, y, w, h} | None,
    "polygon": [[x,y],...] | None, "id": str}``.
    *project_labels*: JSON list of label class names for the project.

    Checks performed:
    a. Label-region consistency via CLIP
    b. Missing annotation detection via SAM + CLIP
    """
    import json

    try:
        annot_list: list[dict] = json.loads(annotations)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in annotations: {exc}")

    try:
        proj_labels: list[str] = json.loads(project_labels)
    except (json.JSONDecodeError, TypeError):
        proj_labels = []

    pil_img, np_img = await image_from_upload(image)

    issues: List[QualityIssue] = []

    # Build candidate labels from the full project label set so CLIP can
    # discriminate across all classes (not just those on the current image).
    image_labels = list({a["label"] for a in annot_list if "label" in a})
    candidate_labels = list(dict.fromkeys(proj_labels + image_labels)) if proj_labels else image_labels
    if len(candidate_labels) < 2:
        candidate_labels = candidate_labels + ["other"]

    # Pre-encode prompted candidate labels once for all annotations
    prompted_candidates = _clip_prompted(candidate_labels)
    text_emb_labels = _clip_encode_text(prompted_candidates)

    # --- a) Label-region consistency ---
    for ann in annot_list:
        bbox = ann.get("bbox")
        if not bbox:
            continue
        ann_id = ann.get("id", "unknown")
        label = ann.get("label", "")

        try:
            crop = crop_region(pil_img, bbox)
        except Exception:
            continue

        if crop.width < 2 or crop.height < 2:
            continue

        img_emb = _clip_encode_image_pil(crop)
        sims = text_emb_labels @ img_emb
        exp = np.exp(sims - sims.max())
        probs = exp / exp.sum()

        label_idx = candidate_labels.index(label) if label in candidate_labels else -1
        if label_idx >= 0:
            label_prob = float(probs[label_idx])
            best_idx = int(np.argmax(probs))
            best_prob = float(probs[best_idx])
            # Use absolute gap threshold instead of ratio (works with any class count)
            if best_idx != label_idx and (best_prob - label_prob) > 0.10:
                issues.append(QualityIssue(
                    type="label_mismatch",
                    severity="high",
                    message=(
                        f"Annotation '{ann_id}' labelled as '{label}' "
                        f"(score {label_prob:.2f}), but CLIP thinks it is "
                        f"'{candidate_labels[best_idx]}' (score {best_prob:.2f})."
                    ),
                    annotation_id=ann_id,
                    suggestion=f"Consider re-labelling to '{candidate_labels[best_idx]}'.",
                ))

    # --- b) Missing annotation detection via YOLO-World + SAM2 ---
    if proj_labels and pil_img is not None:
        # Build list of existing annotation bboxes [x1, y1, x2, y2]
        existing_bboxes = []
        for ann in annot_list:
            b = ann.get("bbox")
            if b and isinstance(b, dict) and all(k in b for k in ("x", "y", "w", "h")):
                existing_bboxes.append([b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]])

        try:
            detections = _detect_and_segment(pil_img, proj_labels, conf=0.15)
        except Exception as exc:
            logger.warning("YOLO-World detection failed during quality review: %s", exc)
            detections = []

        for det in detections:
            x, y, w, h = det["bbox"]
            det_box = [x, y, x + w, y + h]
            confidence = det["confidence"]

            # Check bbox IoU against existing annotation bboxes — skip if overlaps
            skip = False
            for eb in existing_bboxes:
                ix1 = max(det_box[0], eb[0])
                iy1 = max(det_box[1], eb[1])
                ix2 = min(det_box[2], eb[2])
                iy2 = min(det_box[3], eb[3])
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                area_a = (det_box[2] - det_box[0]) * (det_box[3] - det_box[1])
                area_b = (eb[2] - eb[0]) * (eb[3] - eb[1])
                union = area_a + area_b - inter
                iou = inter / union if union > 0 else 0.0
                if iou > 0.3:
                    skip = True
                    break
            if skip:
                continue

            # Severity based on detection confidence
            if confidence > 0.50:
                severity = "high"
            elif confidence > 0.30:
                severity = "medium"
            else:
                severity = "low"

            issues.append(QualityIssue(
                type="missing_annotation",
                severity=severity,
                message=(
                    f"Possible unannotated '{det['label']}' detected "
                    f"(confidence {confidence:.0%})."
                ),
                bbox=[float(det_box[0]), float(det_box[1]), float(det_box[2]), float(det_box[3])],
                predicted_label=det["label"],
                confidence=round(confidence, 3),
            ))

    n_mismatch = sum(1 for i in issues if i.type == "label_mismatch")
    n_missing = sum(1 for i in issues if i.type == "missing_annotation")
    summary = (
        f"Found {n_mismatch} label mismatch(es) and {n_missing} possible missing "
        f"annotation(s) across {len(annot_list)} annotation(s)."
    )

    return QualityReviewResponse(issues=issues, summary=summary)


# ---------------------------------------------------------------------------
# POST /agent/dataset-health
# ---------------------------------------------------------------------------

class AnnotatorStats(BaseModel):
    annotator: str
    count: int
    labels: Dict[str, int]


class DatasetHealthResponse(BaseModel):
    total_annotations: int
    total_images: int
    class_distribution: Dict[str, int]
    class_percentages: Dict[str, float]
    images_annotated: int
    images_unannotated: int
    annotation_progress: float  # 0-1
    per_annotator: List[AnnotatorStats]
    quality_score: float  # 0-100
    warnings: List[str]


@router.post("/dataset-health", response_model=DatasetHealthResponse)
async def dataset_health(
    annotations: str = Form(...),
    total_images: int = Form(0),
    image_embeddings: str = Form("[]"),
):
    """Compute dataset health statistics.

    *annotations*: JSON list of ``{"image_id": str, "label": str, "bbox": ...,
    "annotator": str | None}``.
    *total_images*: total number of images in the dataset (for progress calc).
    *image_embeddings*: optional JSON list of ``{"image_id": str, "embedding": [...]}``.
    """
    import json

    try:
        annot_list: list[dict] = json.loads(annotations)
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid JSON in annotations: {exc}")

    try:
        embeddings_list: list[dict] = json.loads(image_embeddings)
    except (json.JSONDecodeError, TypeError):
        embeddings_list = []

    total_annots = len(annot_list)
    warnings: list[str] = []

    # --- Class distribution ---
    label_counts: Counter = Counter()
    for a in annot_list:
        label_counts[a.get("label", "unlabelled")] += 1

    class_distribution = dict(label_counts.most_common())
    total_labels = sum(label_counts.values()) or 1
    class_percentages = {lbl: round(cnt / total_labels * 100, 2) for lbl, cnt in class_distribution.items()}

    # Warn on imbalanced classes.
    if len(label_counts) > 1:
        most_common_count = label_counts.most_common(1)[0][1]
        least_common_count = label_counts.most_common()[-1][1]
        if most_common_count > 5 * least_common_count:
            warnings.append(
                f"Class imbalance detected: most common class has {most_common_count} "
                f"annotations vs {least_common_count} for the least common."
            )

    # --- Annotation progress ---
    image_ids = {a.get("image_id") for a in annot_list if a.get("image_id")}
    images_annotated = len(image_ids)
    if total_images <= 0:
        total_images = max(images_annotated, 1)
    images_unannotated = max(total_images - images_annotated, 0)
    annotation_progress = round(images_annotated / total_images, 4)

    if annotation_progress < 0.5:
        warnings.append(
            f"Only {annotation_progress * 100:.1f}% of images have been annotated."
        )

    # --- Per-annotator stats ---
    annotator_map: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    annotator_counts: Counter = Counter()
    for a in annot_list:
        annotator = a.get("annotator", "unknown")
        annotator_counts[annotator] += 1
        annotator_map[annotator][a.get("label", "unlabelled")] += 1

    per_annotator = [
        AnnotatorStats(
            annotator=name,
            count=annotator_counts[name],
            labels=dict(annotator_map[name]),
        )
        for name in sorted(annotator_counts)
    ]

    # Warn if an annotator has very few annotations compared to average.
    if len(annotator_counts) > 1:
        avg_count = total_annots / len(annotator_counts)
        for name, count in annotator_counts.items():
            if count < avg_count * 0.2:
                warnings.append(
                    f"Annotator '{name}' has significantly fewer annotations "
                    f"({count}) than average ({avg_count:.0f})."
                )

    # --- Quality score ---
    # Heuristic score 0-100 based on progress, class balance, coverage.
    score = 100.0
    # Penalise low progress.
    score -= max(0, (1 - annotation_progress) * 30)
    # Penalise class imbalance.
    if len(label_counts) > 1:
        values = list(label_counts.values())
        std = float(np.std(values))
        mean = float(np.mean(values))
        cv = std / mean if mean > 0 else 0
        score -= min(cv * 20, 30)
    # Penalise very few annotations.
    if total_annots < 10:
        score -= 20
    elif total_annots < 50:
        score -= 10

    quality_score = round(max(0.0, min(100.0, score)), 1)

    if quality_score < 50:
        warnings.append("Overall dataset quality score is low. Consider adding more annotations.")

    return DatasetHealthResponse(
        total_annotations=total_annots,
        total_images=total_images,
        class_distribution=class_distribution,
        class_percentages=class_percentages,
        images_annotated=images_annotated,
        images_unannotated=images_unannotated,
        annotation_progress=annotation_progress,
        per_annotator=per_annotator,
        quality_score=quality_score,
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# POST /agent/chat — Ollama-powered tool-calling agent
# ---------------------------------------------------------------------------

OLLAMA_MODEL = "qwen2.5:3b"

AGENT_SYSTEM_PROMPT = """You are dataTail, an AI annotation assistant.
You help users annotate images in a dataset by calling tools.
Always use the provided tools to fulfill requests. Do not ask for images - you already have access to the image through tools.
Be concise. Report results and suggest next steps.
When the user asks to annotate or find objects, use segment_and_annotate.
When asking about existing annotations, use get_annotation_summary.
When asked to remove annotations, use remove_annotations.
When asked to relabel/rename annotations, use relabel_annotations.
When asked to check quality, use quality_check.
You can chain multiple tools in one turn if needed."""

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "segment_and_annotate",
            "description": "Find and segment all objects matching a label in the current image using AI vision (SAM + CLIP). Returns candidate annotations with bounding boxes and polygons for user review.",
            "parameters": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Object class to find, e.g. 'car', 'person', 'dog'",
                    },
                    "confidence_threshold": {
                        "type": "number",
                        "description": "Minimum confidence score 0-1, default 0.25",
                    },
                },
                "required": ["label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "count_objects",
            "description": "Count how many objects matching a label are visible in the current image. Uses AI vision to detect and count.",
            "parameters": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Object class to count, e.g. 'car', 'person'",
                    },
                },
                "required": ["label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "describe_image",
            "description": "Describe what objects are visible in the current image using CLIP classification against common categories.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_annotation_summary",
            "description": "Get a summary of existing annotations on the current image, including label counts and totals.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_annotations",
            "description": "Remove all annotations with a specific label from the current image.",
            "parameters": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Label of annotations to remove",
                    },
                },
                "required": ["label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "relabel_annotations",
            "description": "Change the label of all annotations from one label to another on the current image.",
            "parameters": {
                "type": "object",
                "properties": {
                    "old_label": {
                        "type": "string",
                        "description": "Current label to change from",
                    },
                    "new_label": {
                        "type": "string",
                        "description": "New label to change to",
                    },
                },
                "required": ["old_label", "new_label"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "quality_check",
            "description": "Run a quality check on the current image's annotations, looking for label mismatches, missing annotations, and geometric anomalies.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]

COMMON_CATEGORIES = [
    "person", "car", "truck", "bus", "bicycle", "motorcycle",
    "dog", "cat", "bird", "horse", "cow", "sheep",
    "tree", "building", "house", "road", "sign", "traffic light",
    "chair", "table", "bottle", "cup", "food", "flower",
    "sky", "grass", "water", "mountain", "sidewalk", "fence",
]


async def _execute_tool(
    name: str,
    args: dict,
    np_img: np.ndarray | None,
    pil_img: Any | None,
    context: dict,
) -> dict:
    """Dispatch a tool call and return the result dict."""

    if name == "segment_and_annotate":
        label = args.get("label", "object")
        threshold = args.get("confidence_threshold", 0.2)
        if pil_img is None:
            return {"error": "No image available", "summary": "No image provided."}

        # Use YOLO-World + SAM2 for accurate detection + segmentation
        detections = _detect_and_segment(pil_img, [label], conf=threshold)

        annotations = []
        for det in detections:
            binary = det["segmentation"]
            annotations.append({
                "label": det["label"],
                "confidence": det["confidence"],
                "bbox": det["bbox"],
                "polygon": mask_to_polygon(binary),
                "rle": mask_to_rle(binary),
            })

        annotations.sort(key=lambda m: m["confidence"], reverse=True)
        return {
            "annotations": annotations,
            "summary": f"Found {len(annotations)} '{label}' object(s).",
        }

    elif name == "count_objects":
        label = args.get("label", "object")
        if pil_img is None:
            return {"count": 0, "summary": "No image provided."}

        detections = _detect_and_segment(pil_img, [label], conf=0.2)
        count = len(detections)

        return {
            "count": count,
            "summary": f"Counted {count} '{label}' object(s) in the image.",
        }

    elif name == "describe_image":
        if pil_img is None:
            return {"summary": "No image provided."}

        text_emb = _clip_encode_text(COMMON_CATEGORIES)
        img_emb = _clip_encode_image_pil(pil_img)
        sims = text_emb @ img_emb
        exp = np.exp(sims - sims.max())
        probs = exp / exp.sum()

        ranked = sorted(zip(COMMON_CATEGORIES, probs.tolist()), key=lambda x: x[1], reverse=True)
        top5 = ranked[:5]
        descriptions = [f"{cat} ({score:.1%})" for cat, score in top5]
        return {
            "top_categories": [{"category": cat, "score": round(score, 3)} for cat, score in top5],
            "summary": f"Image likely contains: {', '.join(descriptions)}.",
        }

    elif name == "get_annotation_summary":
        annotations = context.get("annotations", [])
        if not annotations:
            return {"summary": "No annotations on this image yet.", "total": 0, "labels": {}}
        label_counts: dict[str, int] = {}
        for ann in annotations:
            lbl = ann.get("label", "unlabeled")
            label_counts[lbl] = label_counts.get(lbl, 0) + 1
        parts = [f"{count} {label}" for label, count in label_counts.items()]
        return {
            "total": len(annotations),
            "labels": label_counts,
            "summary": f"{len(annotations)} annotation(s): {', '.join(parts)}.",
        }

    elif name == "remove_annotations":
        label = args.get("label", "")
        annotations = context.get("annotations", [])
        count = sum(1 for a in annotations if a.get("label") == label)
        return {
            "action": "remove",
            "label": label,
            "count": count,
            "summary": f"Will remove {count} '{label}' annotation(s) from the current image.",
        }

    elif name == "relabel_annotations":
        old_label = args.get("old_label", "")
        new_label = args.get("new_label", "")
        annotations = context.get("annotations", [])
        count = sum(1 for a in annotations if a.get("label") == old_label)
        return {
            "action": "relabel",
            "old_label": old_label,
            "new_label": new_label,
            "count": count,
            "summary": f"Will relabel {count} annotation(s) from '{old_label}' to '{new_label}'.",
        }

    elif name == "quality_check":
        if np_img is None or pil_img is None:
            return {"summary": "No image provided for quality check."}
        annotations = context.get("annotations", [])
        if not annotations:
            return {"issues": [], "summary": "No annotations to check."}

        # Build candidate labels from project label classes (not just image labels)
        label_classes = context.get("labelClasses", [])
        proj_label_names = [lc["name"] for lc in label_classes if "name" in lc] if label_classes else []
        image_labels = list({a.get("label", "") for a in annotations})
        candidate_labels = list(dict.fromkeys(proj_label_names + image_labels)) if proj_label_names else image_labels
        if len(candidate_labels) < 2:
            candidate_labels = candidate_labels + ["other"]

        prompted = _clip_prompted(candidate_labels)
        text_emb = _clip_encode_text(prompted)

        issues = []
        for ann in annotations:
            bbox = ann.get("data")
            if isinstance(bbox, str):
                try:
                    bbox = json.loads(bbox)
                except Exception:
                    continue
            if not isinstance(bbox, dict) or "bbox" not in bbox:
                continue
            b = bbox["bbox"] if isinstance(bbox.get("bbox"), dict) else bbox
            if not all(k in b for k in ("x", "y", "w", "h")):
                continue
            try:
                crop = crop_region(pil_img, b)
            except Exception:
                issues.append({"type": "geometric_anomaly", "message": f"Invalid bbox for annotation {ann.get('id', '?')}"})
                continue
            if crop.width < 2 or crop.height < 2:
                continue
            label = ann.get("label", "")
            img_emb = _clip_encode_image_pil(crop)
            sims = text_emb @ img_emb
            exp = np.exp(sims - sims.max())
            probs = exp / exp.sum()
            label_idx = candidate_labels.index(label) if label in candidate_labels else -1
            if label_idx >= 0:
                best_idx = int(np.argmax(probs))
                best_prob = float(probs[best_idx])
                label_prob = float(probs[label_idx])
                if best_idx != label_idx and (best_prob - label_prob) > 0.10:
                    issues.append({
                        "type": "label_mismatch",
                        "message": f"'{ann.get('id', '?')}' labelled '{label}' but looks like '{candidate_labels[best_idx]}'",
                    })

        return {
            "issues": issues,
            "summary": f"Quality check found {len(issues)} issue(s) across {len(annotations)} annotation(s).",
        }

    return {"error": f"Unknown tool: {name}", "summary": f"Unknown tool '{name}'."}


async def _run_agent_loop(
    message: str,
    np_img: np.ndarray | None,
    pil_img: Any | None,
    context: dict,
    history: list[dict],
) -> dict:
    """Run the Ollama tool-calling agent loop."""
    messages = [{"role": "system", "content": AGENT_SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": message})

    all_annotations: list[dict] = []
    all_actions: list[dict] = []
    response = None

    for _ in range(5):  # max iterations to prevent infinite loops
        try:
            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=messages,
                tools=TOOL_DEFINITIONS,
            )
        except Exception as exc:
            logger.error("Ollama chat failed: %s", exc)
            return {
                "message": f"LLM error: {exc}. Make sure Ollama is running with model '{OLLAMA_MODEL}'.",
                "annotations": [],
                "actions": [],
                "history": messages,
            }

        msg = response.message
        tool_calls = msg.tool_calls or []

        if not tool_calls:
            # LLM is done — has a text response
            break

        # Append the assistant message with tool calls
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    }
                }
                for tc in tool_calls
            ],
        })

        # Execute each tool call
        for tc in tool_calls:
            tool_name = tc.function.name
            tool_args = tc.function.arguments if isinstance(tc.function.arguments, dict) else {}

            logger.info("Agent calling tool: %s(%s)", tool_name, tool_args)

            result = await _execute_tool(tool_name, tool_args, np_img, pil_img, context)

            if "annotations" in result:
                all_annotations.extend(result["annotations"])
            if "action" in result:
                all_actions.append(result)

            # Feed result back to LLM
            messages.append({
                "role": "tool",
                "content": json.dumps(result.get("summary", result)),
            })

    # Extract final text response
    final_message = ""
    if response and response.message:
        final_message = response.message.content or ""

    # If LLM didn't produce a text response, generate a summary
    if not final_message:
        parts = []
        if all_annotations:
            parts.append(f"Found {len(all_annotations)} annotation candidate(s).")
        if all_actions:
            for a in all_actions:
                parts.append(a.get("summary", ""))
        final_message = " ".join(parts) if parts else "Done."

    # Build history for multi-turn (only keep user/assistant messages)
    output_history = [m for m in messages if m["role"] in ("user", "assistant") and "tool_calls" not in m]

    return {
        "message": final_message,
        "annotations": all_annotations,
        "actions": all_actions,
        "history": output_history,
    }


class AgentChatResponse(BaseModel):
    message: str
    annotations: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]
    history: List[Dict[str, Any]]


@router.post("/chat", response_model=AgentChatResponse)
async def agent_chat(
    image: UploadFile = File(...),
    message: str = Form(...),
    context: str = Form("{}"),
    history: str = Form("[]"),
):
    """Ollama-powered tool-calling agent for natural-language annotation.

    Receives a user message, image, and DB context. Uses Ollama to decide
    which tools to call (SAM/CLIP vision tools, context queries, DB actions),
    executes them, and returns a conversational response with any annotations
    or structured actions for the server to execute.
    """
    try:
        ctx = json.loads(context)
    except (json.JSONDecodeError, TypeError):
        ctx = {}

    try:
        hist = json.loads(history)
    except (json.JSONDecodeError, TypeError):
        hist = []

    pil_img, np_img = await image_from_upload(image)

    result = await _run_agent_loop(message, np_img, pil_img, ctx, hist)

    return AgentChatResponse(
        message=result["message"],
        annotations=result["annotations"],
        actions=result["actions"],
        history=result["history"],
    )
