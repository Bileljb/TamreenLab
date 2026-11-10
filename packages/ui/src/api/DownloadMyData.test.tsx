import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../test/intl';
import { DownloadMyData } from './DownloadMyData';
import { SessionProvider } from './session';

const ME = {
  id: 'u1',
  email: 'huda@example.com',
  displayName: 'هدى',
  createdAt: '2026-10-30T00:00:00.000Z',
  settings: { dailyGoal: 900, streakFreeze: false, emailOptIn: false },
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'tamreen_session=; max-age=0';
});

describe('DownloadMyData', () => {
  it('shows nothing to guests', () => {
    renderWithIntl(<DownloadMyData />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('downloads the export as a JSON file for a signed-in learner', async () => {
    document.cookie = 'tamreen_session=1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json(url === '/api/me' ? ME : { exportedAt: '2026-11-10T09:00:00.000Z' }),
      ),
    );
    const createObjectURL = vi.fn(() => 'blob:export');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const user = userEvent.setup();
    renderWithIntl(
      <SessionProvider>
        <DownloadMyData />
      </SessionProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'نزّل بياناتي' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('tamreenlab-data-2026-11-10.json');
  });
});
