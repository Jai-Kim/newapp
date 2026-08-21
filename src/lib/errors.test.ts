import { messageOf } from './errors';

/**
 * This exists because the obvious version of this helper shipped a bug into
 * three screens: supabase-js rejects with PostgrestError and StorageError,
 * which carry a `message` but do not extend Error, so the usual
 * `instanceof Error ? … : String(e)` rendered "[object Object]" to the parent.
 */
describe('messageOf', () => {
  it('reads a real Error', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
  });

  it('reads a supabase error, which is not an Error', () => {
    // The actual shape supabase-js rejects with.
    const postgrestError = {
      message: 'JSON object requested, multiple (or no) rows returned',
      details: null,
      hint: null,
      code: 'PGRST116',
    };
    expect(messageOf(postgrestError)).toBe(
      'JSON object requested, multiple (or no) rows returned',
    );
    expect(messageOf(postgrestError)).not.toContain('[object Object]');
  });

  it('never renders [object Object]', () => {
    for (const value of [{}, { message: 42 }, [], null, undefined, 0]) {
      expect(messageOf(value)).not.toContain('[object Object]');
    }
  });

  it('falls back to something a person can read', () => {
    expect(messageOf({})).toBe('Something went wrong.');
    expect(messageOf(null)).toBe('Something went wrong.');
  });

  it('passes a bare string through', () => {
    expect(messageOf('plain')).toBe('plain');
  });
});
