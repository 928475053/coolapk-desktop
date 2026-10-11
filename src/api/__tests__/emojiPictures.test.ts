import { beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { CoolapkTauriAPI } from '../coolapk';
beforeEach(() => { vi.mocked(invoke).mockReset(); });
it('uses the authenticated native favorite emoji command and preserves list data', async () => {
  const picture = { id: '1', url: 'https://image.coolapk.com/test.gif' };
  vi.mocked(invoke).mockResolvedValue({ code: 200, data: [picture] });
  expect((await CoolapkTauriAPI.getEmojiPictures()).data).toEqual([picture]);
  expect(invoke).toHaveBeenCalledWith('get_emoji_pictures', {});
});
it('routes favorite emoji mutations through dedicated native commands', async () => {
  vi.mocked(invoke).mockResolvedValue({ code: 200, data: 'ok' });
  await CoolapkTauriAPI.addEmojiPicture('https://image.coolapk.com/new.gif');
  expect(invoke).toHaveBeenCalledWith('add_emoji_picture', { url: 'https://image.coolapk.com/new.gif' });
  await CoolapkTauriAPI.editEmojiPictures('sort', ['2', '1']);
  expect(invoke).toHaveBeenCalledWith('edit_emoji_pictures', { action: 'sort', ids: ['2', '1'] });
});
