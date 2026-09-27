# ── Cloud Scheduler Jobs for Periodic Ingestion & Pipeline Updates ────────────

# Periodic 1-hour check for active cyclone bulletins & forecast runs
resource "google_cloud_scheduler_job" "cyclone_bulletin_poll" {
  name        = "cyclone-bulletin-poll"
  description = "Polls IMD/GDACS for active BoB & Coastal APAC cyclonic disturbances"
  schedule    = "0 * * * *" # Every hour
  time_zone   = "Asia/Kolkata"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.backend_api.uri}/ingest/poll"
    
    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode(jsonencode({
      source = "scheduled_poll",
      basins = ["BoB", "AS"]
    }))
  }
}

# Periodic 6-hour refresh of parametric insurance trigger evaluation
resource "google_cloud_scheduler_job" "parametric_trigger_evaluation" {
  name        = "parametric-trigger-evaluation"
  description = "Evaluates active policy zones against latest modeled hazard surfaces"
  schedule    = "0 */6 * * *" # Every 6 hours
  time_zone   = "Asia/Kolkata"
  project     = var.project_id
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.backend_api.uri}/insurance/evaluate-all-active"

    headers = {
      "Content-Type" = "application/json"
    }
  }
}
