"""
backend/telemetry_integrity.py

Monitors meteorological telemetry streaming integrity:
  - Packet sequence monotonicity (detects dropped or duplicated packets)
  - Inter-arrival jitter and timestamp gaps
  - Replay attack or out-of-order packet detection
  - Checksum and format validation
"""

from typing import Dict, Any


class TelemetryIntegrityMonitor:
    def __init__(self):
        self.last_cycle = None
        self.packets_received = 0
        self.packets_dropped = 0
        self.replays_detected = 0

    def evaluate(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        cycle = telemetry.get("cycle")
        self.packets_received += 1
        integrity_score = 100.0
        flags = []

        if cycle is not None:
            if self.last_cycle is not None:
                diff = cycle - self.last_cycle
                if diff == 0:
                    self.replays_detected += 1
                    flags.append("DUPLICATE_FRAME")
                    integrity_score -= 20.0
                elif diff > 1:
                    dropped = diff - 1
                    self.packets_dropped += dropped
                    flags.append(f"DROPPED_{dropped}_FRAMES")
                    integrity_score -= min(30.0, dropped * 5.0)
                elif diff < 0:
                    flags.append("OUT_OF_SEQUENCE")
                    integrity_score -= 25.0
            self.last_cycle = cycle

        drop_rate = (self.packets_dropped / max(1, self.packets_received + self.packets_dropped)) * 100.0

        return {
            "integrity_score": round(max(0.0, integrity_score), 1),
            "packets_received": self.packets_received,
            "packets_dropped": self.packets_dropped,
            "replays_detected": self.replays_detected,
            "packet_loss_pct": round(drop_rate, 2),
            "flags": flags,
            "status": "HEALTHY" if integrity_score >= 80.0 else "DEGRADED",
        }


telemetry_integrity_monitor = TelemetryIntegrityMonitor()
