CREATE TABLE `meal_plan_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`generationCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_plan_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meal_days` ADD `candidates` json;--> statement-breakpoint
ALTER TABLE `meal_days` ADD `selectedCandidateIndex` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `meal_plan_usage` ADD CONSTRAINT `meal_plan_usage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;