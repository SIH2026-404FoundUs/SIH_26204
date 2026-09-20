# ai-service/app/services/demand_predictor.py
import json
import logging
from pathlib import Path
import joblib
import numpy as np

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "models" / "model_demand_causal.pkl"
FEATURES_PATH = BASE_DIR / "config" / "features.json"
RUNTIME_CONFIG_PATH = BASE_DIR / "config" / "runtime_config.json"


def _load_feature_order() -> list:
    """Load the strict feature order from features.json or runtime_config.json."""
    if FEATURES_PATH.exists():
        try:
            with open(FEATURES_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "production" in data and isinstance(data["production"], list):
                    return data["production"]
        except Exception as e:
            logger.warning("Failed to parse features.json: %s", e)

    if RUNTIME_CONFIG_PATH.exists():
        try:
            with open(RUNTIME_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "production_features" in data and isinstance(data["production_features"], list):
                    return data["production_features"]
        except Exception as e:
            logger.warning("Failed to parse runtime_config.json: %s", e)

    raise RuntimeError("Could not load production feature order from features.json or runtime_config.json")


# 1. Load model and feature order at module import time
try:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    
    MODEL = joblib.load(MODEL_PATH)
    FEATURE_ORDER = _load_feature_order()
    
    logger.info(
        "Loaded demand model from %s with %d features. First: '%s', Last: '%s'",
        MODEL_PATH,
        len(FEATURE_ORDER),
        FEATURE_ORDER[0] if FEATURE_ORDER else None,
        FEATURE_ORDER[-1] if FEATURE_ORDER else None,
    )
    print(
        f"[DemandPredictor] Model loaded from {MODEL_PATH} ({len(FEATURE_ORDER)} features). "
        f"First feature: {FEATURE_ORDER[0]}, Last feature: {FEATURE_ORDER[-1]}"
    )
except Exception as e:
    logger.error("Failed to initialize demand predictor module: %s", e, exc_info=True)
    MODEL = None
    FEATURE_ORDER = []


def predict_demand(features: dict) -> dict:
    """Validate 19 input features and predict visitor volume using the XGBoost causal model.

    Args:
        features: Dictionary containing feature names and numerical values.

    Returns:
        {"ok": True, "predictedVisitors": float} on success,
        or {"ok": False, "error": str} on failure.
    """
    if MODEL is None or not FEATURE_ORDER:
        return {"ok": False, "error": "ML demand model is not initialized or failed at startup."}

    if not isinstance(features, dict):
        return {"ok": False, "error": "Features must be provided as a dictionary."}

    missing_features = [k for k in FEATURE_ORDER if k not in features or features[k] is None]
    if missing_features:
        return {
            "ok": False,
            "error": f"Missing required features: {missing_features}",
        }

    try:
        # Construct numpy array in exact feature order
        vector = [float(features[k]) for k in FEATURE_ORDER]
        X = np.array(vector, dtype=np.float32).reshape(1, -1)

        # Execute model inference
        prediction = MODEL.predict(X)
        predicted_visitors = float(prediction[0])

        return {
            "ok": True,
            "predictedVisitors": predicted_visitors,
        }
    except Exception as e:
        logger.error("Demand prediction inference failed: %s", e, exc_info=True)
        return {"ok": False, "error": f"Prediction error: {str(e)}"}
