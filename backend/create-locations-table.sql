-- Create locations table for managing facility and billing location information

CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(36) PRIMARY KEY,
    
    -- General Office Information
    tax_id_professional VARCHAR(50) NOT NULL,
    office_phone_number VARCHAR(20) NOT NULL,
    office_phone_ext VARCHAR(10),
    time_zone VARCHAR(100),
    start_time TIME,
    end_time TIME,
    location_name VARCHAR(255) NOT NULL,
    location_description TEXT,
    
    -- Facility Service Location Information / Box 32
    facility_type VARCHAR(50) NOT NULL,
    facility_npi_number VARCHAR(20) NOT NULL,
    facility_name VARCHAR(255) NOT NULL,
    facility_address VARCHAR(255) NOT NULL,
    facility_apt_unit VARCHAR(50),
    facility_country VARCHAR(10) NOT NULL DEFAULT 'US',
    facility_city VARCHAR(100) NOT NULL,
    facility_state VARCHAR(10) NOT NULL,
    facility_zip_code VARCHAR(20) NOT NULL,
    
    -- Billing Provider Information / Box 33
    taxonomy_code VARCHAR(20) NOT NULL,
    billing_npi_number VARCHAR(20),
    billing_provider_name VARCHAR(255),
    billing_address VARCHAR(255),
    billing_apt_unit VARCHAR(50),
    billing_country VARCHAR(10) DEFAULT 'US',
    billing_city VARCHAR(100),
    billing_state VARCHAR(10),
    billing_zip_code VARCHAR(20),
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'Active',
    archived TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_location_name (location_name),
    INDEX idx_facility_name (facility_name),
    INDEX idx_status (status),
    INDEX idx_archived (archived)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
