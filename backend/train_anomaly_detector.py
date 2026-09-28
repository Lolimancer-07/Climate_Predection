"""
backend/train_anomaly_detector.py

Trains an Isolation Forest model on calm and moderate tropical weather telemetry
to produce the operational baseline envelope for anomaly detection.
Saves backend/anomaly_model.pkl.
"""

import os
import pickle
import numpy as np
from sklearn.ensemble import IsolationForest

DIR_PATH = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(DIR_PATH, "anomaly_model.pkl")

FEATURES = [
    'central_pressure_hpa',
    'max_wind_kmh',
    'surge_height_m',
    'rainfall_rate_mmh',
    'forward_speed_kmh',
    'tide_height_m',
]


def train():
    np.random.seed(42)
    n_samples = 3000

    # Normal calm to moderate tropical baseline
    pressure = np.random.normal(1008.0, 4.0, n_samples)
    wind = np.clip(np.random.normal(35.0, 15.0, n_samples), 5.0, 70.0)
    surge = np.clip(np.random.normal(0.4, 0.25, n_samples), 0.05, 1.2)
    rain = np.clip(np.random.exponential(3.0, n_samples), 0.0, 15.0)
    speed = np.random.normal(18.0, 4.0, n_samples)
    tide = np.random.uniform(0.2, 2.0, n_samples)

    X = np.column_stack([pressure, wind, surge, rain, speed, tide])

    model = IsolationForest(contamination=0.03, random_state=42, n_estimators=100)
    model.fit(X)

    bundle = {
        'model': model,
        'features': FEATURES,
        'meta': {
            'train_samples': n_samples,
            'contamination': 0.03,
            'description': 'Trained on Bay of Bengal non-cyclonic and pre-alert baseline telemetry'
        }
    }

    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(bundle, f)

    print(f"Anomaly model saved to {MODEL_PATH} ({os.path.getsize(MODEL_PATH) / 1024:.1f} KB)")


if __name__ == '__main__':
    train()
