import { test, expect } from '@playwright/test';

test('host links to remotes and remotes respond', async ({ page, context }) => {
    await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');

    // Verify the three remote links exist (host shows "render in host" labels)
    const checkoutLink = page.getByRole('link', { name: 'Checkout (render in host)' });
    const profileLink = page.getByRole('link', { name: 'Profile (render in host)' });
    const adminLink = page.getByRole('link', { name: 'Admin (render in host)' });

    await expect(checkoutLink).toHaveCount(1);
    await expect(profileLink).toHaveCount(1);
    await expect(adminLink).toHaveCount(1);

    // Collect hrefs and visit each remote in a new page to ensure they respond
    const links = await Promise.all([checkoutLink.getAttribute('href'), profileLink.getAttribute('href'), adminLink.getAttribute('href')]);

    for (const href of links) {
        test.expect(href).toBeTruthy();

        const page2 = await context.newPage();
        const resp = await page2.goto(href!);

        expect(resp && resp.status() < 400).toBeTruthy();

        await page2.close();
    }
});
