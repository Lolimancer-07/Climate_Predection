terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "cyclone-anticipatory-platform"
}

variable "region" {
  description = "GCP Region (closest to Bay of Bengal: asia-south1 Mumbai or asia-south2 Delhi)"
  type        = string
  default     = "asia-south1"
}

variable "db_password" {
  description = "Password for postgres database user"
  type        = string
  sensitive   = true
  default     = "cyclone-secure-db-pass-2024"
}

# ── Cloud SQL PostgreSQL Instance with PostGIS support ────────────────────────
resource "google_sql_database_instance" "postgis_instance" {
  name             = "cyclone-postgis-instance"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  settings {
    tier              = "db-custom-2-7680" # 2 vCPU, 7.5GB RAM
    availability_type = "ZONAL"            # REGIONAL for HA production

    disk_size         = 50
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    database_flags {
      name  = "cloudsql.enable_pgvector"
      value = "on"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    ip_configuration {
      ipv4_enabled    = true
      ssl_mode        = "ENCRYPTED_ONLY"
    }
  }

  deletion_protection = false # Set to true in production
}

resource "google_sql_database" "cyclone_db" {
  name     = "cyclone_db"
  instance = google_sql_database_instance.postgis_instance.name
  project  = var.project_id
}

resource "google_sql_user" "postgres_user" {
  name     = "postgres"
  instance = google_sql_database_instance.postgis_instance.name
  password = var.db_password
  project  = var.project_id
}

output "db_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.postgis_instance.connection_name
}
