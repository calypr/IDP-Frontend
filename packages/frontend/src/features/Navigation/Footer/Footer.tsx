import React from 'react';
import { extractClassName } from '../utils';
import { mergeDefaultTailwindClassnames } from '../../../utils/mergeDefaultTailwindClassnames';
import { FooterProps } from './types';
import FooterSection from './FooterColumn';

const Footer = ({
  rightSection,
  leftSection,
  classNames = {},
  basePage,
}: FooterProps) => {
  const classNamesDefaults = {
    root: `${basePage ? 'white' : 'bg-primary'} text-primary-contrast p-4 shadow-sm`,
    layout: 'flex items-center justify-between',
  };

  const mergedClassNames = mergeDefaultTailwindClassnames(
    classNamesDefaults,
    classNames,
  );

  return (
    <footer>
      <div className={extractClassName('root', mergedClassNames)}>
        <div className={extractClassName('layout', mergedClassNames)}>
          {leftSection && (
            <FooterSection {...leftSection} basePage={basePage} />
          )}
          {rightSection && (
            <FooterSection {...rightSection} basePage={basePage} />
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
