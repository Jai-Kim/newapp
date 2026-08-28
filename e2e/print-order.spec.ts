import type { SupabaseClient } from '@supabase/supabase-js';

import { expect, test } from '@playwright/test';

import { createChild, openApp, signIn } from './support/flow';
import { installStubs } from './support/stubs';
import {
  clientFor,
  confirmEmail,
  deleteTestUser,
  newTestUser,
  provisionUser,
} from './support/test-user';

/**
 * Concierge print capture (issue #22, ADR-0003, slice 4): at Volume
 * completion, a parent can order/gift the hardcover. No payment, no POD
 * integration — this proves the order is captured with the right chapter
 * snapshot and is retrievable, and that a second attempt on the same book is
 * recognised rather than duplicated.
 *
 * Chapters are seeded directly against the database, same as volumes.spec.ts
 * — a Volume is derived purely from child_readable_chapters, so nothing here
 * needs generation. submit-print-order itself runs through the stub (see
 * support/stubs.ts), which shares the real function's chapter-snapshot logic.
 */

const CHILD_NAME = 'Yuna';

async function seedApprovedChapter(
  db: SupabaseClient,
  childId: string,
  number: number,
): Promise<void> {
  const { data, error } = await db
    .from('chapters')
    .insert({
      child_id: childId,
      number,
      title_en: `Chapter ${number}`,
      title_ko: `${number}장`,
      pages: [{
        page: 1,
        en: 'Once upon a time, on a quiet night.',
        ko: '어느 조용한 밤, 옛날 옛적에.',
        scene: 'a child by a window at night',
        wardrobe: 'soft pyjamas',
      }],
      summary: `Seeded chapter ${number} for the print-order e2e (issue #22).`,
      safety: {
        verdict: 'safe',
        concerns: [],
        checked_languages: ['en', 'ko'],
        model: 'e2e-seed',
        latency_ms: 0,
      },
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  const { error: approveError } = await db.rpc('approve_chapter', {
    p_chapter_id: data!.id as string,
    p_approved: true,
  });
  if (approveError) {
    throw approveError;
  }
}

test.describe('concierge print capture', () => {
  const user = newTestUser();

  test.afterAll(async () => {
    await deleteTestUser(user.email);
  });

  test('a completed book can be ordered, is retrievable, and a repeat order is recognised', async ({ page }) => {
    await openApp(page);
    await provisionUser(user);
    await signIn(page, user, () => confirmEmail(user.email));
    const db = await clientFor(user);

    await createChild(page, CHILD_NAME);
    const { data: child } = await db.from('children').select('id').single();
    const childId = child!.id as string;

    await installStubs({ page, db, childId: () => childId });

    for (let number = 1; number <= 10; number += 1) {
      await seedApprovedChapter(db, childId, number);
    }

    await page.goto('/library');
    await expect(page.locator('[data-testid="volume-complete"]'))
      .toBeVisible({ timeout: 30_000 });

    await page.locator('[data-testid="print-order-cta"]').click();
    await expect(page).toHaveURL(/\/print-order\/1\?/);

    // No payment collection anywhere on this screen.
    await expect(page.getByText(/card number/i)).toHaveCount(0);

    await page.locator('[data-testid="print-order-recipient"]').fill('Grandma Kim');
    await page.locator('[data-testid="print-order-line1"]').fill('123 Sea Breeze Rd');
    await page.locator('[data-testid="print-order-city"]').fill('Busan');
    await page.locator('[data-testid="print-order-postal-code"]').fill('48058');
    await page.locator('[data-testid="print-order-country"]').fill('KR');
    await page.locator('[data-testid="print-order-gift"]').click();
    await page.locator('[data-testid="print-order-gift-message"]').fill('We love you!');

    await page.locator('[data-testid="print-order-submit"]').click();

    await expect(page.locator('[data-testid="print-order-confirmation"]'))
      .toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Your order is in!')).toBeVisible();
    await expect(page.getByText('주문이 접수되었어요!')).toBeVisible();

    // Retrievable: a real RLS-scoped row, with the server-computed snapshot,
    // not just a client-side success message.
    const { data: orders } = await db
      .from('print_orders')
      .select('*')
      .eq('child_id', childId);
    expect(orders).toHaveLength(1);
    const order = orders![0];
    expect(order.volume_index).toBe(1);
    expect(order.chapter_ids).toHaveLength(10);
    expect(order.recipient_name).toBe('Grandma Kim');
    expect(order.gift).toBe(true);
    expect(order.gift_message).toBe('We love you!');
    expect(order.shipping_address).toMatchObject({
      line1: '123 Sea Breeze Rd',
      city: 'Busan',
      postal_code: '48058',
      country: 'KR',
    });
    expect(order.status).toBe('captured');

    // A second attempt on the same book is recognised, not duplicated — the
    // whole point of the one-live-order-per-volume index.
    await page.goto('/print-order/1?childId=' + childId + '&lead=en');
    await page.locator('[data-testid="print-order-recipient"]').fill('Grandma Kim, again');
    await page.locator('[data-testid="print-order-line1"]').fill('123 Sea Breeze Rd');
    await page.locator('[data-testid="print-order-city"]').fill('Busan');
    await page.locator('[data-testid="print-order-postal-code"]').fill('48058');
    await page.locator('[data-testid="print-order-country"]').fill('KR');
    await page.locator('[data-testid="print-order-submit"]').click();

    await expect(page.getByText('This book has already been ordered.')).toBeVisible({ timeout: 15_000 });

    const { data: ordersAfterRepeat } = await db
      .from('print_orders')
      .select('id')
      .eq('child_id', childId);
    expect(ordersAfterRepeat).toHaveLength(1);
  });
});
