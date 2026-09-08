import { createReadinessProbe } from './readiness';
describe('readiness dependency probes', () => {
  afterEach(() => jest.useRealTimers());
  it('reports failure and subsequent recovery without exposing errors', async () => {
    const check = jest.fn().mockRejectedValueOnce(new Error('private connection details')).mockResolvedValueOnce(1);
    const probe = createReadinessProbe(check);
    expect(await probe()).toBe(false);
    expect(await probe()).toBe(true);
  });
  it('bounds a hung probe and reuses in-flight work', async () => {
    jest.useFakeTimers();
    const check = jest.fn(() => new Promise(() => {}));
    const probe = createReadinessProbe(check, 50);
    const first = probe();
    const second = probe();
    await jest.advanceTimersByTimeAsync(50);
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('handles synchronous dependency errors', async () => {
    expect(await createReadinessProbe(() => { throw new Error('unavailable'); })()).toBe(false);
  });
});
