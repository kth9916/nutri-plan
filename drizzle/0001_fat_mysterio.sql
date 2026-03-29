CREATE TABLE `meal_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mealPlanId` int NOT NULL,
	`dayOfMonth` int NOT NULL,
	`meals` json NOT NULL,
	`nutritionInfo` json,
	`status` enum('pending','approved','replaced') NOT NULL DEFAULT 'pending',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_days_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meal_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sourceFileId` int,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`title` varchar(255),
	`status` enum('draft','confirmed') NOT NULL DEFAULT 'draft',
	`exportFileKey` varchar(512),
	`exportFileUrl` text,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meal_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orderId` varchar(128) NOT NULL,
	`paymentKey` varchar(256),
	`plan` enum('free','pro') NOT NULL DEFAULT 'pro',
	`amount` decimal(10,2) NOT NULL,
	`status` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `uploaded_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`fileSize` int NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`status` enum('uploaded','processing','completed','failed') NOT NULL DEFAULT 'uploaded',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `uploaded_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `plan` enum('free','pro') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `meal_days` ADD CONSTRAINT `meal_days_mealPlanId_meal_plans_id_fk` FOREIGN KEY (`mealPlanId`) REFERENCES `meal_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meal_plans` ADD CONSTRAINT `meal_plans_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `meal_plans` ADD CONSTRAINT `meal_plans_sourceFileId_uploaded_files_id_fk` FOREIGN KEY (`sourceFileId`) REFERENCES `uploaded_files`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `uploaded_files` ADD CONSTRAINT `uploaded_files_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;