"""
notifications/templates package
HTML and short-form notification templates.
"""
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent


def load_email_template(name: str) -> str:
    path = TEMPLATES_DIR / "email" / f"{name}.html"
    if not path.exists():
        raise FileNotFoundError(f"Template '{name}.html' not found in {path}")
    return path.read_text(encoding="utf-8")


def render_template(template_name: str, context: dict) -> str:
    html = load_email_template(template_name)
    for k, v in context.items():
        placeholder = f"{{{{ {k} }}}}"
        html = html.replace(placeholder, str(v))
    return html
