import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
// The app's real message file, so tests fail if a key the components use is missing.
import messages from '../../../../apps/web/messages/ar.json';

export function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider
      locale="ar"
      messages={messages}
      onError={(e) => {
        throw e;
      }}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
