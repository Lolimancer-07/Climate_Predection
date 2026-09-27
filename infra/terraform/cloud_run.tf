# ── Cloud Run Backend Service ──────────────────────────────────────────────────
resource "google_cloud_run_v2_service" "backend_api" {
  name     = "cyclone-backend-api"
  location = var.region
  project  = var.project_id

  template {
    scaling {
      min_instance_count = 1  # warm instance for sub-second early warnings
      max_instance_count = 10
    }

    containers {
      image = "gcr.io/${var.project_id}/cyclone-backend:latest"

      resources {
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
      }

      ports {
        container_port = 8000
      }

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }
      env {
        name  = "DATABASE_URL"
        value = "postgresql+asyncpg://postgres:${var.db_password}@localhost:5432/cyclone_db"
      }
      env {
        name  = "GEMINI_MODEL"
        value = "gemini-3.7-flash"
      }
      env {
        name  = "HITL_ENFORCE_HUMAN_CONFIRMATION"
        value = "true"
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "gemini-api-key"
            version = "latest"
          }
        }
      }
      env {
        name = "TWILIO_AUTH_TOKEN"
        value_source {
          secret_key_ref {
            secret  = "twilio-auth-token"
            version = "latest"
          }
        }
      }
      env {
        name = "WHATSAPP_API_TOKEN"
        value_source {
          secret_key_ref {
            secret  = "whatsapp-api-token"
            version = "latest"
          }
        }
      }
      env {
        name = "PAYOUT_SIGNING_KEY"
        value_source {
          secret_key_ref {
            secret  = "payout-signing-key"
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.postgis_instance.connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Allow public unauthenticated invocation (frontend & webhooks call the API)
resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_v2_service.backend_api.name
  location = google_cloud_run_v2_service.backend_api.location
  project  = var.project_id
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "backend_api_url" {
  description = "Public URL of the deployed FastAPI backend"
  value       = google_cloud_run_v2_service.backend_api.uri
}
