# Hackathon Demo Walkthrough Script

This step-by-step presentation script is designed for live demonstrations to technical judges, disaster management experts, and insurance underwriters.

---

## ⏱️ 3-Minute Demo Run Plan

### Minute 0:00 – The Hook & Problem Statement
- **Narrative**: *"Every cyclone in the Bay of Bengal triggers the same tragic cycle: national bulletins arrive too coarse for ward-level decisions, evacuation routes get cut off unexpectedly, and disaster insurance payouts take 3 months to reach communities when relief is needed immediately."*
- **Solution**: *"We built the Cyclone Anticipatory Action Platform to shift the entire response curve left — into the 72-hour pre-landfall window."*

---

### Minute 0:45 – Live Operational Dashboard
- **Screen**: Open the React + MapLibre Operational Dashboard (`http://localhost:5173`).
- **Action**:
  1. Highlight **Cyclone Fani (2019)** simulated at **T-72h pre-landfall** heading for Puri, Odisha.
  2. Point to the real-time layer controls:
     - **Storm Surge Inundation footprint** (calibrated against SRTM DEM & coastal shelf slope).
     - **Flash Flood Risk surface** (computed using Topographic Wetness Index & GFS rainfall grids).
     - **Critical Assets Overlay**: Real hospitals, schools, cyclone shelters, and road networks from OpenStreetMap.
  3. Click on **Ward 7 (Puri Urban)**:
     - Note the computed hazard metrics: 280 mm rainfall (48h), 215 km/h gusts, runoff risk score 0.64 (High).

---

### Minute 1:30 – AI Multimodal Reasoning & Zero-Hallucination Validation
- **Action**: Click **"Generate Advisory with Gemini 3.7 Flash"**.
- **Explanation**:
  - *"Gemini 3.7 Flash inspects both the structured numerical hazard JSON and the rendered multi-layer map."*
  - *"Notice the advisory draft: it explicitly names safe shelters (e.g. Puri Women's College Cyclone Shelter), identifies impassable arterial roads, and provides an alternate evacuation corridor computed via NetworkX Dijkstra."*
  - *"Crucially: our post-generation validator checks every single number against the source database. If Gemini had hallucinated a 500mm rainfall figure, the advisory would be immediately blocked from reaching operators."*

---

### Minute 2:15 – Human-in-the-Loop & Multi-Channel Dispatch
- **Action**: Click **"Confirm & Dispatch"** in the operator review gate.
- **Explanation**:
  - Select channels: **SMS (Twilio)**, **WhatsApp Cloud API**, **CAP 1.2 XML (WMO standard)**, and **Official PDF Report**.
  - Review the instant dispatch log showing live simulated sandbox receipts.

---

### Minute 2:45 – Pre-Landfall Parametric Insurance Liquidity
- **Action**: Highlight the **Parametric Insurance Trigger Panel**.
- **Explanation**:
  - *"Notice how the trigger engine evaluated 3 contractual policies: Rainfall (>200mm) and Wind Speed (>150km/h) have both FIRED."*
  - *"Gemini did not decide this payout. The trigger boolean is 100% deterministic code. We generate a cryptographically signed HMAC-SHA256 payload ready for insurer webhooks."*
  - *"Instead of waiting 90 days for adjusters to survey ruined buildings, $500,000 in emergency liquidity is unlocked 48 hours BEFORE landfall to fund evacuations and pre-position supplies."*

---

### Minute 3:00 – Wrap-up
- *"48 passing unit and integration tests, scalable to any coastal district across the Bay of Bengal and wider Indo-Pacific."*
