"""
dispatch/cap_alert.py
Generate CAP 1.2 XML alerts for interoperability with official warning systems.
"""
import uuid
from datetime import datetime, timezone
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom


CAP_NS = "urn:oasis:names:tc:emergency:cap:1.2"


def build_cap_xml(
    advisory_id: str,
    content: str,
    event_name: str = "Cyclone Storm Surge Warning",
    area_desc: str = "Bay of Bengal Coastal District",
    severity: str = "Severe",
    urgency: str = "Expected",
    certainty: str = "Likely",
    sender: str = "anticipatory-action-platform@example.org",
) -> str:
    """
    Build a valid CAP 1.2 XML alert string.
    Demonstrates standards compliance even without live federation.
    """
    now = datetime.now(timezone.utc).isoformat()

    alert = Element("alert")
    alert.set("xmlns", CAP_NS)

    _sub(alert, "identifier", f"{advisory_id}")
    _sub(alert, "sender", sender)
    _sub(alert, "sent", now)
    _sub(alert, "status", "Actual")
    _sub(alert, "msgType", "Alert")
    _sub(alert, "scope", "Public")
    _sub(alert, "note", "DEMO — sandbox only. Not an operational alert.")

    info = SubElement(alert, "info")
    _sub(info, "language", "en-US")
    _sub(info, "category", "Met")
    _sub(info, "event", event_name)
    _sub(info, "responseType", "Evacuate")
    _sub(info, "urgency", urgency)
    _sub(info, "severity", severity)
    _sub(info, "certainty", certainty)
    _sub(info, "effective", now)
    _sub(info, "description", content[:2000])
    _sub(info, "instruction", "Follow instructions from District Disaster Management Authority.")

    area = SubElement(info, "area")
    _sub(area, "areaDesc", area_desc)

    raw = tostring(alert, encoding="unicode")
    pretty = minidom.parseString(raw).toprettyxml(indent="  ")
    return pretty


def _sub(parent: Element, tag: str, text: str) -> Element:
    el = SubElement(parent, tag)
    el.text = text
    return el
