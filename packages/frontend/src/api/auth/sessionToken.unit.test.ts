import { isExpired } from './sessionToken';

describe('session token expiration', () => {
  it('compares JWT seconds with the current time in milliseconds', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);

    expect(isExpired(1_799_999_999)).toBe(true);
    expect(isExpired(1_800_000_001)).toBe(false);

    now.mockRestore();
  });
});
