import React, { ReactElement } from 'react';
import Link from 'next/link';
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
): ReactElement[] => {
  return items.flatMap(
    (item: TopIconButtonPropsWithLink, index: number): ReactElement[] => {
      const mergedClassnames = item?.classNames
        ? mergeDefaultTailwindClassnames(classNames, item.classNames)
        : classNames;
      const renderedItem = (
        <React.Fragment key={`${item.href}_${item.name}-topbar-item`}>
          <div className="flex h-full items-center">
            {item.openInNewTab === false ? (
              <Link className="flex h-full items-center" href={item.href}>
                <IconButton
                  name={item.name}
                  iconSize={item.iconSize}
                  leftIcon={item.leftIcon}
                  rightIcon={item.rightIcon}
                  classNames={mergedClassnames}
                />
              </Link>
            ) : (
              <a
                className="flex h-full items-center"
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
            )}
          </div>
        </React.Fragment>
      );

      if (index === items.length - 1) {
        return [renderedItem];
      }

      return [
        renderedItem,
        <span
          aria-hidden="true"
          className="mx-1 text-white/80"
          key={`${item.href}_${item.name}-topbar-divider`}
        >
          |
        </span>,
      ];
    },
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
  onToggle?: () => void;
}

const TopBar = ({
  title,
  items,
  loginButtonVisibility = LoginButtonVisibility.Hidden,
  externalLoginUrl,
  classNames = {},
  itemClassnames = {},
  logo,
  onToggle = () => undefined,
}: TopBarProps) => {
  if (logo) {
    logo.basepage = title === 'CALYPR Landing Page';
  }

  const isLandingPage = title === 'CALYPR Landing Page';

  const classNamesDefaults = {
    root: `fixed top-0 left-0 right-0 z-10 flex h-16 w-full items-center border-b shadow-sm
   ${
     isLandingPage
       ? 'bg-white text-black border-slate-100'
       : 'bg-primary text-white border-black/10'
   }`,
    login: isLandingPage
      ? 'font-content text-black hover:border-black'
      : 'font-content text-white hover:border-white',
    loginMenu: isLandingPage
      ? 'flex h-full items-center px-2 text-black border-b-2 border-transparent border-white transition-colors duration-150 hover:border-black'
      : 'flex h-full items-center px-2 text-white border-b-2 border-transparent border-primary transition-colors duration-150 hover:border-white',
  };

  const itemClassnameDefaults = {
    logoAndTitlePanel: 'flex h-full items-center',
    root: 'flex h-full items-center px-2',
    button: isLandingPage
      ? 'flex h-full items-center border-b-2 border-white transition-colors duration-150 hover:border-black'
      : 'flex h-full items-center border-b-2 border-primary transition-colors duration-150 hover:border-white',
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
          className="flex h-full items-center"
        >
          {processTopBarItems(items, mergedItemClassnames)}
          {items.length > 0 && (
            <span aria-hidden="true" className="mx-1 text-white/80">
              |
            </span>
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
