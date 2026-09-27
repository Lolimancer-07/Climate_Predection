"""
ai-reasoning/gemini_client.py
Gemini API wrapper for multimodal advisory generation.
"""
import os
import base64
import json
from pathlib import Path
from typing import Optional
import google.generativeai as genai


def _init_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY environment variable not set.")
    genai.configure(api_key=api_key)


def _get_model(model_name: Optional[str] = None):
    _init_client()
    model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    return genai.GenerativeModel(model_name)


def generate_text(system_prompt: str, user_prompt: str) -> str:
    """Generate text from Gemini with a system + user prompt."""
    model = _get_model()
    response = model.generate_content([
        {"role": "user", "parts": [
            f"SYSTEM INSTRUCTIONS:\n{system_prompt}\n\nUSER REQUEST:\n{user_prompt}"
        ]}
    ])
    return response.text


def generate_multimodal(
    system_prompt: str,
    user_text: str,
    image_path: Optional[str] = None,
    image_bytes: Optional[bytes] = None,
    image_mime: str = "image/png",
) -> str:
    """
    Generate a response from Gemini with optional image input.
    Either image_path or image_bytes must be provided for multimodal use.
    """
    model = _get_model()
    parts = [f"SYSTEM INSTRUCTIONS:\n{system_prompt}\n\nUSER REQUEST:\n{user_text}"]

    if image_path and Path(image_path).exists():
        with open(image_path, "rb") as f:
            image_bytes = f.read()

    if image_bytes:
        parts.append({"inline_data": {"mime_type": image_mime, "data": base64.b64encode(image_bytes).decode()}})

    response = model.generate_content(parts)
    return response.text


def load_prompt_template(template_name: str) -> str:
    """Load a prompt template from the prompts/ directory."""
    prompt_dir = Path(__file__).parent / "prompts"
    template_path = prompt_dir / f"{template_name}.md"
    if not template_path.exists():
        raise FileNotFoundError(f"Prompt template not found: {template_path}")
    return template_path.read_text()
