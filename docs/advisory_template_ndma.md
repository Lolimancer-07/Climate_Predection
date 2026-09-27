# National Disaster Management Advisory Standards

This document specifies the institutional advisory formatting guidelines aligned with the National Disaster Management Authority (NDMA India) and WMO Early Warnings for All (EW4All) standards.

---

## 1. Severity Tiers & Action Matrices

| Tier | Lead Time Window | Criteria | Operational Directive |
|---|---|---|---|
| **WATCH** (Yellow) | T-72h to T-48h | Cyclonic disturbance detected; path intersects coastline within 300km radius. | Alert response teams, inspect generators, verify shelter stockpiles. |
| **WARNING** (Orange) | T-48h to T-24h | Cyclone confirmed heading towards district; sustained winds > 65 km/h expected. | Suspend fishing operations, initiate early voluntary evacuations of low-lying wards. |
| **EVACUATION ORDER** (Red) | T-24h to T-0h | Inundation depth > 1.0m or sustained winds > 118 km/h modeled for inhabited wards. | Mandatory evacuation along cleared corridors to designated multi-purpose shelters. |

---

## 2. Standard Institutional Advisory Schema

Every LLM-generated advisory follows this strict structural format:

```text
================================================================================
DISTRICT DISASTER MANAGEMENT AUTHORITY (DDMA) EARLY WARNING ADVISORY
================================================================================
INCIDENT: Cyclone [Cyclone Name] ([Cyclone Category])
TARGET JURISDICTION: [Ward Name / District Name]
SEVERITY TIER: [WATCH / WARNING / EVACUATION ORDER]
ISSUANCE TIMESTAMP: [ISO 8601 UTC]
ANTICIPATED LANDFALL: [Date & Time IST/Local]

1. HAZARD ASSESSMENT
   • Modeled Storm Surge Inundation: [X.X] meters above astronomical tide
   • Accumulated Rainfall (48h): [XXX] mm (Flash flood risk: [Low/Medium/High/Severe])
   • Peak Sustained Wind / Gusts: [XXX] km/h ([XX] knots)

2. CRITICAL ASSET & INFRASTRUCTURE IMPACT
   • At-Risk Facilities: [List of specific hospitals, substations, or low-elevation assets]
   • Evacuation Corridor Status:
     - Primary Route: [Status - Clear / Inundated / Blocked]
     - Designated Alternate: [Route Name, Distance, Clearance Status]

3. DIRECTIVE TO RESIDENTS & OPERATORS
   • Designated Safe Shelters: [List of official shelters within 3km]
   • Evacuation Window: Complete movements before [Timestamp IST]
   • Emergency Helpline: 1077 (District Control Room) / 112 (National Emergency)

================================================================================
AUTHORIZED BY: District Magistrate & DDMA Chairperson
VALIDATION: Verified against physical hydrodynamic and meteorological models.
================================================================================
```
