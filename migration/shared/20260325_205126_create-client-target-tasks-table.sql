CREATE TABLE `client_target_tasks` (
 `id` varchar(36) NOT NULL,
 `client_id` varchar(36) NOT NULL,
 `activity_id` varchar(36) NOT NULL,
 `name` varchar(255) NOT NULL,
 `step_order` int NOT NULL,
 `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (`id`),
 KEY `idx_client_activity_id` (`client_id`, `activity_id`),
 KEY `idx_activity_id` (`activity_id`),
 CONSTRAINT `client_activity_tasks_ibfk_1` FOREIGN KEY (`activity_id`) REFERENCES `client_targets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

