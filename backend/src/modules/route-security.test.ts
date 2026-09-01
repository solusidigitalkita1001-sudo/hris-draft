import { authenticate } from '@/shared/middleware/Authenticate';
import ewaRoutes from '@/modules/ewa/ewa.routes';
import dailyActivityRoutes from '@/modules/daily-activity/daily-activity.routes';

type RouterLayer = {
  route?: unknown;
  handle: unknown;
};

function expectAuthenticationBeforeRoutes(router: unknown) {
  const stack = (router as { stack: RouterLayer[] }).stack;
  const firstRouteIndex = stack.findIndex((layer) => Boolean(layer.route));
  const authenticateIndex = stack.findIndex((layer) => layer.handle === authenticate);

  expect(firstRouteIndex).toBeGreaterThan(-1);
  expect(authenticateIndex).toBeGreaterThanOrEqual(0);
  expect(authenticateIndex).toBeLessThan(firstRouteIndex);

  // The company-scope middleware is mounted immediately after authenticate.
  expect(stack[authenticateIndex + 1]?.route).toBeUndefined();
}

describe('module router security baseline', () => {
  it('authenticates EWA requests before route authorization', () => {
    expectAuthenticationBeforeRoutes(ewaRoutes);
  });

  it('authenticates daily-activity requests before route authorization', () => {
    expectAuthenticationBeforeRoutes(dailyActivityRoutes);
  });
});
