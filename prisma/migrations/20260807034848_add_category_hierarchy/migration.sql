/*
  Warnings:

  - Added the required column `path` to the `Category` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Category" ("createdAt", "icon", "id", "isPrivate", "name", "sortOrder", "updatedAt", "path") SELECT "createdAt", "icon", "id", "isPrivate", "name", "sortOrder", "updatedAt", "name" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE UNIQUE INDEX "Category_path_key" ON "Category"("path");
CREATE INDEX "Category_path_idx" ON "Category"("path");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
