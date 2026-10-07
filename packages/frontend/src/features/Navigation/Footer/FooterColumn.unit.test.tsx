import React from 'react';
import { render, screen } from '@testing-library/react';
import FooterSection from './FooterColumn';

it('keeps a footer logo inside its configured box without stretching it', () => {
  render(
    <FooterSection
      basePage={false}
      columns={[
        {
          basePage: false,
          rows: [
            {
              Icon: {
                logo: '/icons/knight.svg',
                logolight: '/icons/knight_white.svg',
                width: 100,
                height: 47,
                description: 'Knight Cancer Institute',
              },
            },
          ],
        },
      ]}
    />,
  );

  expect(screen.getByRole('img', { name: 'Knight Cancer Institute' })).toHaveStyle({
    width: '100px',
    height: '47px',
    objectFit: 'contain',
  });
});
