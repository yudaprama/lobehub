import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageService } from '../index';

// Mock prest client — the big-bang migration routes updateMessageMetadata
// through pREST. The abortableRequest wrapper still cancels the outer
// promise on a new call for the same id; the underlying prest update may
// complete in the background but the caller never sees the result.
const prestMock = vi.hoisted(() => ({
  update: vi.fn(),
}));

vi.mock('@/libs/prest/client', () => ({
  getPrestClient: vi.fn(() => Promise.resolve(prestMock)),
}));

describe('MessageService - Race Condition Control', () => {
  let messageService: MessageService;

  beforeEach(() => {
    vi.clearAllMocks();
    messageService = new MessageService();
  });

  describe('updateMessageMetadata race condition', () => {
    it('should cancel previous request when new update is triggered for same message', async () => {
      const messageId = 'test-message-id';

      // Mock first request (slow)
      prestMock.update.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 200);
          }),
      );

      // Mock second request (fast)
      prestMock.update.mockImplementationOnce(async () => []);

      // Start first update
      const firstPromise = messageService.updateMessageMetadata(messageId, { compare: true });

      // Wait a bit then start second update
      await new Promise((resolve) => setTimeout(resolve, 10));
      const secondPromise = messageService.updateMessageMetadata(messageId, { compare: false });

      // First should be aborted (outer promise rejected by abortableRequest)
      await expect(firstPromise).rejects.toThrow('Aborted');

      // Second should complete successfully
      await expect(secondPromise).resolves.toEqual({ success: true });
      expect(prestMock.update).toHaveBeenCalledTimes(2);
    });

    it('should allow concurrent updates for different messages', async () => {
      const message1Id = 'message-1';
      const message2Id = 'message-2';

      prestMock.update.mockResolvedValue([]);

      const [result1, result2] = await Promise.all([
        messageService.updateMessageMetadata(message1Id, { cost: 0.001 }),
        messageService.updateMessageMetadata(message2Id, { cost: 0.002 }),
      ]);

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });
      expect(prestMock.update).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid successive updates correctly', async () => {
      const messageId = 'test-message-id';

      prestMock.update.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 50);
          }),
      );

      // Trigger 5 rapid updates sequentially with catch to prevent unhandled rejections
      const promise1 = messageService
        .updateMessageMetadata(messageId, { cost: 0.001 })
        .catch((e) => e);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const promise2 = messageService
        .updateMessageMetadata(messageId, { cost: 0.002 })
        .catch((e) => e);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const promise3 = messageService.updateMessageMetadata(messageId, { tps: 10 }).catch((e) => e);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const promise4 = messageService.updateMessageMetadata(messageId, { tps: 20 }).catch((e) => e);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const promise5 = messageService
        .updateMessageMetadata(messageId, { compare: true })
        .catch((e) => e);

      // Wait for all to settle
      const results = await Promise.all([promise1, promise2, promise3, promise4, promise5]);

      // First 4 should be errors (aborted), last should succeed
      expect(results[0]).toBeInstanceOf(Error);
      expect(results[1]).toBeInstanceOf(Error);
      expect(results[2]).toBeInstanceOf(Error);
      expect(results[3]).toBeInstanceOf(Error);
      expect(results[4]).toEqual({ success: true });
    });
  });
});
