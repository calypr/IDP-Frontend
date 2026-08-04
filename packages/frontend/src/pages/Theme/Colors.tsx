import React from 'react';
import { NavPageLayout, NavPageLayoutProps } from '../../features/Navigation';

import ColorTheme from '../../features/Theme/ColorTheme';

const ColorThemePage = ({ headerProps, footerProps, pageProblems }: NavPageLayoutProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Theme Page',
        content: 'Theme page',
        key: 'gen3-theme-page',
      }}
    >
      <div className="flex justify-items-center w-full">
        <ColorTheme />
      </div>
    </NavPageLayout>
  );
};

export default ColorThemePage;
