"""
backend/ml_chatbot/train_intent_clf.py

Trains TF-IDF + Logistic Regression model on the cyclone emergency intent dataset.
Outputs:
  - backend/ml_chatbot/intent_clf.joblib
  - backend/ml_chatbot/training_report.json
"""

import os
import json
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

try:
    from backend.ml_chatbot.intent_dataset import TRAINING_DATA
except ImportError:
    from intent_dataset import TRAINING_DATA

DIR_PATH = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(DIR_PATH, "intent_clf.joblib")
REPORT_PATH = os.path.join(DIR_PATH, "training_report.json")


def train():
    texts = [t[0] for t in TRAINING_DATA]
    labels = [t[1] for t in TRAINING_DATA]

    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
        ('clf', LogisticRegression(C=5.0, max_iter=200, random_state=42))
    ])

    pipeline.fit(texts, labels)
    preds = pipeline.predict(texts)
    report = classification_report(labels, preds, output_dict=True)

    joblib.dump(pipeline, MODEL_PATH)
    with open(REPORT_PATH, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"Model saved to {MODEL_PATH}")
    print(f"Accuracy: {report.get('accuracy', 0):.4f}")


if __name__ == '__main__':
    train()
