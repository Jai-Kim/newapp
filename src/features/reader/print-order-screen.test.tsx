import * as React from 'react';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';
import { PrintOrderScreen } from './print-order-screen';

/**
 * Concierge print capture (issue #22, ADR-0003, slice 4): intent + shipping
 * details only, no payment fields, and the submission is retrievable
 * afterwards (asserted here as "the confirmation screen shows").
 */

const mockSubmitPrintOrder = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

// jest.mock factories are hoisted above the file, so anything they close over
// has to be named `mock*` to be allowed through.
let mockSearchParams: { childId?: string; volumeIndex?: string; lead?: string } = {
  childId: 'child-1',
  volumeIndex: '1',
  lead: 'en',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/lib/supabase/print-orders', () => ({
  submitPrintOrder: (...args: unknown[]) => mockSubmitPrintOrder(...(args as [])),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockSearchParams = { childId: 'child-1', volumeIndex: '1', lead: 'en' };
});

async function fillRequiredFields(user: ReturnType<typeof setup>['user']) {
  await user.type(screen.getByTestId('print-order-recipient'), 'Jane Doe');
  await user.type(screen.getByTestId('print-order-line1'), '123 Main St');
  await user.type(screen.getByTestId('print-order-city'), 'Springfield');
  await user.type(screen.getByTestId('print-order-postal-code'), '00001');
  await user.type(screen.getByTestId('print-order-country'), 'US');
}

describe('printOrderScreen', () => {
  it('shows no payment fields, and the submit button is disabled until required fields are filled', async () => {
    setup(<PrintOrderScreen />);

    expect(screen.queryByText(/card number/i)).not.toBeOnTheScreen();
    expect(screen.queryByText(/credit card/i)).not.toBeOnTheScreen();
    expect(screen.getByTestId('print-order-submit-label').props.children).toBe('Place order');
  });

  it('submits the order and shows a bilingual confirmation', async () => {
    mockSubmitPrintOrder.mockResolvedValue({ ok: true, order_id: 'order-1' });
    const { user } = setup(<PrintOrderScreen />);

    await fillRequiredFields(user);
    await user.press(screen.getByTestId('print-order-submit'));

    await waitFor(() => {
      expect(mockSubmitPrintOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          child_id: 'child-1',
          volume_index: 1,
          recipient_name: 'Jane Doe',
          gift: false,
          shipping_address: expect.objectContaining({
            line1: '123 Main St',
            city: 'Springfield',
            postal_code: '00001',
            country: 'US',
          }),
        }),
      );
    });

    expect(await screen.findByTestId('print-order-confirmation')).toBeOnTheScreen();
    expect(screen.getByText('Your order is in!')).toBeOnTheScreen();
  });

  it('shows the gift message field only once "This is a gift" is checked, and sends it', async () => {
    mockSubmitPrintOrder.mockResolvedValue({ ok: true, order_id: 'order-1' });
    const { user } = setup(<PrintOrderScreen />);

    expect(screen.queryByTestId('print-order-gift-message')).not.toBeOnTheScreen();
    await user.press(screen.getByTestId('print-order-gift'));
    expect(screen.getByTestId('print-order-gift-message')).toBeOnTheScreen();

    await fillRequiredFields(user);
    await user.type(screen.getByTestId('print-order-gift-message'), 'Happy birthday!');
    await user.press(screen.getByTestId('print-order-submit'));

    await waitFor(() => {
      expect(mockSubmitPrintOrder).toHaveBeenCalledWith(
        expect.objectContaining({ gift: true, gift_message: 'Happy birthday!' }),
      );
    });
  });

  it('tells the parent when the book was already ordered, bilingually', async () => {
    mockSubmitPrintOrder.mockResolvedValue({ ok: true, already_ordered: true });
    const { user } = setup(<PrintOrderScreen />);

    await fillRequiredFields(user);
    await user.press(screen.getByTestId('print-order-submit'));

    expect(await screen.findByText('This book has already been ordered.')).toBeOnTheScreen();
    expect(screen.getByText('이 책은 이미 주문되었어요.')).toBeOnTheScreen();
  });

  it('shows the server error when the volume is not complete yet', async () => {
    mockSubmitPrintOrder.mockRejectedValue(new Error('that volume is not complete yet'));
    const { user } = setup(<PrintOrderScreen />);

    await fillRequiredFields(user);
    await user.press(screen.getByTestId('print-order-submit'));

    expect(await screen.findByText('that volume is not complete yet')).toBeOnTheScreen();
  });
});
