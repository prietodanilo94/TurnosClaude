import { test, expect } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const EMAIL = process.env.E2E_ADMIN_EMAIL!;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD!;

test.describe("Auth v2 flow", () => {
  test("Redirects to login if not authenticated", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("Admin can login and is redirected to dashboard", async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, "E2E credentials not set");

    await page.goto("/login");

    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to admin dashboard
    await expect(page).toHaveURL(/.*\/admin/);
    await expect(page.locator("text=Shift Optimizer v2")).toBeVisible();
  });
});
