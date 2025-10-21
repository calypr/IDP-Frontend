import React, { ReactElement } from 'react';
import { Divider } from '@mantine/core';
import { mergeDefaultTailwindClassnames } from '../../../utils/mergeDefaultTailwindClassnames';
import LoginAccountButton from '../../../components/Login/LoginAccountButton';
import { extractClassName } from '../utils';
import { LoginButtonVisibility } from '../../../components/Login/types';
import { StylingOverrideWithMergeControl } from '../../../types';
import { IconButton, TopIconButtonPropsWithLink } from './IconButton';
import { AccountButton } from './AccountButton';
import { LoginMenu } from '../../../components/Login';
import NavigationLogo from '../NavigationLogo';
import { NavigationBarLogo } from '../types';

const processTopBarItems = (
  items: TopIconButtonPropsWithLink[],
  classNames: StylingOverrideWithMergeControl,
  dividerClassname: string,
  isLandingPage: Boolean,
): ReactElement[] => {
  return items.reduce(
    (acc: ReactElement[], item: TopIconButtonPropsWithLink, index: number) => {
      const mergedClassnames = item?.classNames
        ? mergeDefaultTailwindClassnames(classNames, item.classNames)
        : classNames;
      acc.push(
        <React.Fragment key={`${item.href}_${item.name}-topbar-item`}>
          <a
            className="flex"
            target="_blank"
            rel="noopener noreferrer"
            href={item.href}
          >
            <IconButton
              name={item.name}
              iconSize={item.iconSize}
              leftIcon={item.leftIcon}
              rightIcon={item.rightIcon}
              classNames={mergedClassnames}
            />
          </a>
          <Divider
            size="md"
            orientation="vertical"
            classNames={{ root: dividerClassname }}
            color={isLandingPage ? 'black' : 'white'}
          />
        </React.Fragment>,
      );
      return acc;
    },
    [],
  );
};

export interface TopBarProps {
  readonly title?: string;
  readonly items: TopIconButtonPropsWithLink[];
  readonly loginButtonVisibility?: LoginButtonVisibility;
  readonly externalLoginUrl?: string;
  readonly classNames?: StylingOverrideWithMergeControl;
  readonly itemClassnames?: StylingOverrideWithMergeControl;
  readonly logo?: NavigationBarLogo;
  onToggle: () => void;
}

const TopBar = ({
  title,
  items,
  loginButtonVisibility = LoginButtonVisibility.Hidden,
  externalLoginUrl,
  classNames = {},
  itemClassnames = {},
  logo,
  onToggle,
}: TopBarProps) => {
  logo!.basepage = title === 'CALYPR Landing Page';

  const isLandingPage = title === 'CALYPR Landing Page';

  const classNamesDefaults = {
    root: `flex items-center align-middle border-b-8 ${
      isLandingPage
        ? 'bg-white text-black border-white'
        : 'bg-primary text-white border-accent'
    }`,
    login: isLandingPage
      ? 'font-content text-black hover:border-black'
      : 'font-content text-white hover:border-white',
    divider: isLandingPage ? 'border-black my-2' : 'border-white my-2',
    loginMenu: isLandingPage
      ? 'mx-2 text-black border-b-2 border-transparent border-white hover:border-black'
      : 'mx-2 text-white border-b-2 border-transparent border-primary hover:border-white',
  };

  const itemClassnameDefaults = {
    logoAndTitlePanel: 'flex justify-center items-center align-middle',
    root: `flex items-center align-middle px-2`,
    button: isLandingPage
      ? 'flex items-center align-middle border-b-2 h-full border-white hover:border-black'
      : 'flex items-center align-middle border-b-2 h-full border-primary hover:border-white',
    leftIcon: isLandingPage
      ? 'text-black pr-1 flex-shrink-0'
      : 'text-white pr-1 flex-shrink-0',
    label: isLandingPage
      ? 'font-content block leading-none text-black'
      : 'font-content block leading-none text-white',
    rightIcon: isLandingPage
      ? 'pl-1 flex-shrink-0 text-black'
      : 'pl-1 flex-shrink-0 text-white',
  };

  const mergedClassnames = mergeDefaultTailwindClassnames(
    classNamesDefaults,
    classNames,
  );

  const mergedItemClassnames = mergeDefaultTailwindClassnames(
    itemClassnameDefaults,
    itemClassnames,
  );

  return (
    <div>
      <header
        className={
          extractClassName('root', mergedClassnames) + ' flex justify-between'
        }
      >
        <div
          className={extractClassName('logoAndTitlePanel', mergedClassnames)}
        >
          {logo && <NavigationLogo {...{ ...logo }} onToggle={onToggle} />}
        </div>
        <div
          role="navigation"
          aria-label="top most navigation"
          className="flex items-center align-middle"
        >
          {processTopBarItems(
            items,
            mergedItemClassnames,
            extractClassName('divider', mergedClassnames),
            isLandingPage,
          )}
          <div className={extractClassName('loginMenu', mergedClassnames)}>
            <LoginMenu frontBanner={false} classNames={classNamesDefaults} />
          </div>
        </div>
      </header>
    </div>
  );
};

export default TopBar;
