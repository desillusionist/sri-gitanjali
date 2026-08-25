CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `verse_secondary_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`verse_key` varchar(192) NOT NULL,
	`source_hash` varchar(64) NOT NULL,
	`language` varchar(8) NOT NULL,
	`translated_text` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verse_secondary_translations_id` PRIMARY KEY(`id`),
	CONSTRAINT `verse_secondary_translation_source_language` UNIQUE(`verse_key`,`source_hash`,`language`)
);
