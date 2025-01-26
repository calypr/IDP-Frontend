import { ReactElement } from 'react';
import { Icon } from '@iconify/react';
import { mergeDefaultTailwindClassnames } from '../../utils/mergeDefaultTailwindClassnames';
import LoginMenu from '../../components/Login/LoginMenu';
import { extractClassName } from './utils';
import { LoginButtonVisibility } from '../../components/Login/types';
import { StylingOverrideWithMergeControl } from '../../types';
import NavigationLogo from './NavigationLogo';
import { NavigationBarLogo } from './types';

export interface NameAndIcon {
  readonly name: string;
  readonly rightIcon?: string;
  readonly leftIcon?: string;
  readonly classNames: StylingOverrideWithMergeControl;
  readonly drawBorder?: boolean;
}

export interface TopIconButtonProps extends NameAndIcon {
  readonly href: string;
  readonly tooltip?: string;
}

const TopIconButton = ({
  name,
  leftIcon = undefined,
  rightIcon = undefined,
  classNames = {},
  drawBorder = true,
}: NameAndIcon) => {
  const classNamesDefaults = {
    root: `flex items-center align-middle px-2 ${
      drawBorder && 'border-r-2 border-accent'
    } my-2`,
    logoAndTitlePanel: 'flex justify-center items-center align-middle',
    button:
      'flex flex-nowrap items-center align-middle border-b-2 hover:border-accent border-transparent',
    leftIcon: 'text-secondary-contrast-lighter pr-1',
    label: 'font-content text-secondary-contrast-lighter block',
    rightIcon: 'text-secondary-contrast-lighter pl-1',
  };
  const mergedClassnames = mergeDefaultTailwindClassnames(
    classNamesDefaults,
    classNames,
  );

  return (
    <div
      className={extractClassName('root', mergedClassnames)}
      aria-label={name}
    >
      <div
        className={extractClassName('button', mergedClassnames)}
        role="button"
      >
        {leftIcon ? (
          <Icon
            icon={leftIcon}
            className={extractClassName('leftIcon', mergedClassnames)}
          />
        ) : null}
        <p className={extractClassName('label', mergedClassnames)}> {name} </p>
        {rightIcon ? (
          <Icon
            icon={rightIcon}
            className={extractClassName('rightIcon', mergedClassnames)}
          />
        ) : null}
      </div>
    </div>
  );
};

const processTopBarItems = (
  items: TopIconButtonProps[],
  showLogin: boolean,
): ReactElement[] => {
  return items.reduce(
    (acc: ReactElement[], item: TopIconButtonProps, index: number) => {
      const needsBorder = !(index === items.length - 1 && !showLogin);
      acc.push(
        <a
          className="flex"
          href={item.href}
          key={`${item.href}_${item.name}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {' '}
          <TopIconButton
            name={item.name}
            leftIcon={item.leftIcon}
            rightIcon={item.rightIcon}
            classNames={item.classNames}
            drawBorder={needsBorder}
          />{' '}
        </a>,
      );
      return acc;
    },
    [],
  );
};

export interface TopBarProps {
  readonly logo?: NavigationBarLogo;
  readonly items: TopIconButtonProps[];
  readonly loginButtonVisibility?: LoginButtonVisibility;
  readonly classNames?: StylingOverrideWithMergeControl;
}

const TopBar = ({ items, classNames, logo }: TopBarProps) => {
  const classNamesDefaults = {
    root: 'flex justify-end items-center align-middle w-100 bg-primary',
  };

  const mergedClassnames = mergeDefaultTailwindClassnames(
    classNamesDefaults,
    classNames || {},
  );
  return (
    <div>
      <header className={extractClassName('root', mergedClassnames)}>
        <div
          className={extractClassName('logoAndTitlePanel', mergedClassnames)}
        >
          {logo && <NavigationLogo {...{ ...logo }} />}
        </div>
        <nav className="flex items-center align-middle justify-end w-full">
          {processTopBarItems(items, true)}
          <div className="border-r-2 border-primary-contrast">
            <LoginMenu />
          </div>
        </nav>
      </header>
    </div>
  );
};

export default TopBar;
