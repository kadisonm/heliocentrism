// `pageChangeCooldown.ts` keeps its clock (`lastChangeAt`) at module scope
// by design (see its own comment — shared across every caller). That means
// state persists across test cases in this file unless the module registry
// is reset between them, so every test below re-imports a fresh instance
// via `jest.resetModules()` + a dynamic import rather than sharing one
// module-level import across the whole file.

async function freshTryClaimPageChange() {
  const { tryClaimPageChange } = await import('../../lib/grid/pageChangeCooldown');
  return tryClaimPageChange;
}

describe('tryClaimPageChange', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('succeeds on the first claim', async () => {
    const tryClaimPageChange = await freshTryClaimPageChange();
    expect(tryClaimPageChange(300)).toBe(true);
  });

  it('rejects a second claim within the cooldown window without resetting the clock', async () => {
    const tryClaimPageChange = await freshTryClaimPageChange();
    expect(tryClaimPageChange(300)).toBe(true);

    jest.advanceTimersByTime(100);
    expect(tryClaimPageChange(300)).toBe(false); // still within the original window

    jest.advanceTimersByTime(100); // 200ms since the first claim — still inside 300ms
    expect(tryClaimPageChange(300)).toBe(false); // clock wasn't reset by the rejected attempt above
  });

  it('succeeds again once the cooldown has fully elapsed since the last successful claim', async () => {
    const tryClaimPageChange = await freshTryClaimPageChange();
    expect(tryClaimPageChange(300)).toBe(true);

    jest.advanceTimersByTime(150);
    expect(tryClaimPageChange(300)).toBe(false); // rejected, does not move the clock

    jest.advanceTimersByTime(150); // 300ms since the first successful claim
    expect(tryClaimPageChange(300)).toBe(true);
  });
});
