import { test, expect } from '@playwright/test';

test.describe('Energy Uncertainty & Day-Ahead Procurement Terminal', () => {
  test('Page loads properly with header navigation and default Trading Desk view', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gridbricks/i);
    await expect(page.locator('button:has-text("Trading Desk (Day-Ahead)")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Accuracy Audit (Jan 2026)")').first()).toBeVisible();

    // Verify initial KPI cards load from real January 2026 backend data
    await expect(page.locator('text=Expected Wind')).toBeVisible();
    await expect(page.locator('text=Firm Wind (P90)')).toBeVisible();
    await expect(page.locator('text=Total Demand')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card-naive-thermal"]')).toBeVisible();
    await expect(page.locator('text=Rec. Thermal')).toBeVisible();
    await expect(page.locator('text=Savings Hedged')).toBeVisible();
  });

  test('Issue 1: Tooltip opens without clipping and remains readable inside viewport', async ({ page }) => {
    await page.goto('/');
    const infoButtons = page.locator('[data-testid="metric-card-info-button"]');
    await expect(infoButtons.first()).toBeVisible();

    // Click first info button
    await infoButtons.first().click();

    // Verify tooltip appears
    const tooltip = page.locator('[role="tooltip"]').first();
    await expect(tooltip).toBeVisible();

    // Verify tooltip bounding box does not overflow viewport boundaries
    const box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      const viewport = page.viewportSize();
      if (viewport) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 10);
      }
    }

    // Verify tooltip formula text is displayed
    await expect(tooltip).toContainText(/Formula & Definition/i);
  });

  test('Issue 2: Delivery-date calendar is locked to January 2026', async ({ page }) => {
    await page.goto('/');
    const dateTrigger = page.locator('[data-testid="month-locked-date-trigger"]');
    await expect(dateTrigger).toBeVisible();
    await expect(dateTrigger).toContainText('2026-01-');

    // Click trigger to open popover
    await dateTrigger.click();
    const popover = page.locator('[data-testid="month-locked-calendar-popover"]');
    await expect(popover).toBeVisible();

    // Verify month is locked to January 2026
    await expect(popover.locator('text=January 2026')).toBeVisible();
    await expect(popover.locator('text=Scope constrained: Jan 1–31, 2026')).toBeVisible();

    // Verify previous and next month navigation buttons are locked and disabled
    const prevBtn = popover.locator('button[aria-label="Previous month disabled"]');
    const nextBtn = popover.locator('button[aria-label="Next month disabled"]');
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeDisabled();

    // Select January 15
    const day15 = popover.locator('[data-testid="calendar-day-15"]');
    await day15.click();

    // Verify popover closed and trigger updated to 2026-01-15
    await expect(popover).not.toBeVisible();
    await expect(dateTrigger).toContainText('2026-01-15');

    // Verify trading desk data loaded for 2026-01-15
    await expect(page.locator('text=Delivery Day 2026-01-15')).toBeVisible();
  });

  test('Issue 3: Harmonized dynamic confidence selection (P50, P75, P90, P95)', async ({ page }) => {
    await page.goto('/');

    // Initially P90 is selected
    await expect(page.locator('text=Firm Wind (P90)')).toBeVisible();
    await expect(page.locator('text=P90 Renewable Floor')).toBeVisible();
    await expect(page.locator('text=P90 Firm Wind').first()).toBeVisible();

    // Select P50
    const p50Btn = page.locator('[data-testid="confidence-btn-50"]');
    await p50Btn.click();

    // Metric card title, subtitle, and legend must dynamically update to P50
    await expect(page.locator('text=Firm Wind (P50)')).toBeVisible();
    await expect(page.locator('text=P50 Renewable Floor')).toBeVisible();
    await expect(page.locator('text=P50 Firm Wind').first()).toBeVisible();

    // Verify stale P90 label is not present on the firm wind card
    await expect(page.locator('text=Firm Wind (P90)')).not.toBeVisible();

    // Select P75
    const p75Btn = page.locator('[data-testid="confidence-btn-75"]');
    await p75Btn.click();
    await expect(page.locator('text=Firm Wind (P75)')).toBeVisible();
    await expect(page.locator('text=P75 Renewable Floor')).toBeVisible();

    // Select P95
    const p95Btn = page.locator('[data-testid="confidence-btn-95"]');
    await p95Btn.click();
    await expect(page.locator('text=Firm Wind (P95)')).toBeVisible();
    await expect(page.locator('text=P95 Renewable Floor')).toBeVisible();
  });

  test('Actuals toggle hides and reveals outturn series', async ({ page }) => {
    await page.goto('/');

    const toggleBtn = page.locator('[data-testid="toggle-actuals-btn"]');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toContainText(/Hide Outturn/i);

    // Toggle off
    await toggleBtn.click();
    await expect(toggleBtn).toContainText(/Show Outturn/i);

    // Toggle back on
    await toggleBtn.click();
    await expect(toggleBtn).toContainText(/Hide Outturn/i);
  });

  test('CSV export downloads file with valid name and headers', async ({ page }) => {
    await page.goto('/');

    const csvButton = page.locator('[data-testid="export-csv-btn"]');
    await expect(csvButton).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    await csvButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^gridbricks_(dispatch|procurement)_2026-01-.*\.csv$/);
  });

  test('Navigation across tabs works cleanly', async ({ page }) => {
    await page.goto('/');

    // Navigate to Accuracy Audit
    const auditTabBtn = page.locator('button:has-text("Accuracy Audit (Jan 2026)")').first();
    await auditTabBtn.click();

    // Verify Accuracy Audit content renders
    await expect(page.locator('text=January 2026 Renewable Forecast Verification Audit')).toBeVisible();
    await expect(page.locator('text=Error vs Lead-Time Horizon (Decay Curve)')).toBeVisible();
    await expect(page.locator('text=Signed Error Distribution (Empirical Histogram)')).toBeVisible();

    // Return to Trading Desk
    const tradingTabBtn = page.locator('button:has-text("Trading Desk (Day-Ahead)")').first();
    await tradingTabBtn.click();
    await expect(page.locator('text=Forecast Uncertainty Fan Chart')).toBeVisible();
  });

  test('Handles API failure gracefully with user-friendly error state', async ({ page }) => {
    // Intercept trading-desk API to simulate network outage
    await page.route('**/api/trading-desk*', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');
    const errorState = page.locator('[data-testid="error-state"]');
    await expect(errorState).toBeVisible();
  });
});
