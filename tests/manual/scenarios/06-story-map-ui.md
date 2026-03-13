# Scenario 06: Story Map UI — Layout & Navigation

**Time:** ~5 minutes
**Parallel Safe:** No
**LLM Required:** No

Verifies the story map UI renders the data created in previous scenarios correctly.

## Prerequisites

- Scenarios 01–04 passed — project has populated map with multiple activities, steps, tasks
- Playwright installed: `npx playwright install chromium`

## Test Script

`tests/e2e/manual-06-map-ui.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const EDEN_URL = process.env.EDEN_URL || 'https://eden.incept5-eden-sandbox.eh1.incept5.dev';
const PROJECT_SLUG = process.env.PROJECT_SLUG || 'manual-test';

test.describe('Scenario 06: Story Map UI', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to Eden and authenticate
    await page.goto(EDEN_URL);
    // Auth flow — adapt to current login mechanism
    await page.waitForURL('**/projects/**', { timeout: 15000 });
  });

  test('map renders activities as horizontal rows', async ({ page }) => {
    await page.click(`text=${PROJECT_SLUG}`);
    await page.waitForSelector('[data-testid="story-map"]', { timeout: 10000 });

    const activities = page.locator('[data-testid^="activity-"]');
    await expect(activities).toHaveCount(3);

    await expect(page.locator('text=Document Ingestion')).toBeVisible();
    await expect(page.locator('text=Expert Review')).toBeVisible();
    await expect(page.locator('text=Map Editing')).toBeVisible();
  });

  test('task cards show title and persona badges', async ({ page }) => {
    await page.click(`text=${PROJECT_SLUG}`);
    await page.waitForSelector('[data-testid="story-map"]');

    const taskCards = page.locator('[data-testid^="task-card-"]');
    await expect(taskCards.first()).toBeVisible();

    await expect(page.locator('text=Upload requirements document')).toBeVisible();
    await expect(page.locator('text=PM').first()).toBeVisible();
  });

  test('stats bar displays correct counts', async ({ page }) => {
    await page.click(`text=${PROJECT_SLUG}`);
    await page.waitForSelector('[data-testid="stats-bar"]', { timeout: 10000 });

    const statsBar = page.locator('[data-testid="stats-bar"]');
    await expect(statsBar).toContainText('4');
  });

  test('minimap is visible and interactive', async ({ page }) => {
    await page.click(`text=${PROJECT_SLUG}`);
    await page.waitForSelector('[data-testid="story-map"]');

    const minimap = page.locator('[data-testid="minimap"]');
    await expect(minimap).toBeVisible();
    await expect(minimap).toContainText('Document Ingestion');
  });

  test('task card hover shows lift effect', async ({ page }) => {
    await page.click(`text=${PROJECT_SLUG}`);
    await page.waitForSelector('[data-testid="story-map"]');

    const card = page.locator('[data-testid^="task-card-"]').first();
    await card.hover();

    const transform = await card.evaluate(el =>
      window.getComputedStyle(el).transform
    );
    expect(transform).not.toBe('none');
  });

  test('persona filter narrows visible tasks', async ({ page }) => {
    await page.click(`text=${PROJECT_SLUG}`);
    await page.waitForSelector('[data-testid="story-map"]');

    const baFilter = page.locator('text=Business Analyst').or(page.locator('text=BA'));
    if (await baFilter.isVisible()) {
      await baFilter.click();
      const cards = page.locator('[data-testid^="task-card-"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(4);
    }
  });
});
```

## Running

```bash
cd apps/web
npx playwright test tests/e2e/manual-06-map-ui.spec.ts --reporter=list
```

## Success Criteria

- [ ] Story map renders with horizontal layout (activities as rows)
- [ ] 3 activities visible with correct names
- [ ] Task cards display title and persona badges
- [ ] Stats bar shows accurate counts
- [ ] Minimap visible with activity labels
- [ ] Hover effect on task cards
- [ ] Persona filter narrows visible tasks
