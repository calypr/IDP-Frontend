import type { Meta, StoryObj } from '@storybook/react';

import Footer from './Footer';

const meta = {
  component: Footer,
  title: 'Features/Navigation/Footer',
  parameters: {
    deepControls: { enabled: true },
  },
} satisfies Meta<typeof Footer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    basePage: false,
    classNames: {
      root: 'bg-base-min',
      layout: 'flex items-center justify-end',
    },
    rightSection: {
      basePage: false,
      columns: [
        {
          basePage: false,
          rows: [
            {
              Icon: {
                logo: '/icons/gen3.png',
                width: 132,
                height: 60,
                description: 'Gen3 Logo',
                logolight: '/icons/gen3_light.png',
                basePage: false,
              },
            },
          ],
        },
        {
          basePage: false,
          rows: [
            {
              Icon: {
                logo: '/icons/createdby.png',
                width: 170,
                height: 60,
                description: 'Created by CTDS',
                logolight: '/icons/gen3_light.png',
                basePage: false,
              },
            },
          ],
        },
      ],
    },
  },
};
