import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshenAction } from './freshen';
import { upAction } from './up';

vi.mock('./up', () => ({
    upAction: vi.fn().mockResolvedValue(undefined)
}));

describe('freshenAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call upAction with force: true', async () => {
        const options = { global: true };
        const mockCommand = {
            opts: () => ({ global: true })
        };

        await freshenAction(options, mockCommand);

        expect(upAction).toHaveBeenCalledWith(
            expect.objectContaining({ force: true, global: true }),
            mockCommand
        );
    });
});
