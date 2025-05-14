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
      drawBorder && 'border-r-2'
    } my-2`,
    logoAndTitlePanel: 'flex justify-center items-center align-middle',
    button: 'flex items-center align-middle border-b-2 h-full',
    leftIcon: 'text-white pr-1 flex-shrink-0',
    label: 'font-content block leading-none',
    rightIcon: 'pl-1 flex-shrink-0',
    loginMenu: 'flex justify-center h-full border-r-1',
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
  readonly title?: string;
  readonly logo?: NavigationBarLogo;
  readonly items: TopIconButtonProps[];
  readonly loginButtonVisibility?: LoginButtonVisibility;
  readonly classNames?: StylingOverrideWithMergeControl;
}

const TopBar = ({ title, items, classNames, logo }: TopBarProps) => {
  logo!.basepage = title === 'CALYPR Landing Page';

  const defaultClassNames = {
    root:
      title === 'CALYPR Landing Page'
        ? 'flex justify-end items-center align-middle px-2 border-r-2 bg-white text-black border-black'
        : 'flex justify-end items-center align-middle px-2 border-r-2 bg-primary text-white border-primary',
    label:
      title === 'CALYPR Landing Page'
        ? 'font-content text-black block align-middle'
        : 'font-content text-white block align middle',
    button:
      title === 'CALYPR Landing Page'
        ? 'flex flex-nowrap items-center align-middle border-white hover:border-black'
        : 'flex flex-nowrap items-center align-middle px-2 border-primary hover:border-white',
    loginMenu:
      title === 'CALYPR Landing Page'
        ? 'mx-2 text-black border-b-2 border-transparent border-white hover:border-black'
        : 'mx-2 text-white border-b-2 border-transparent border-primary hover:border-white',
  };
  
  const mergedClassnames = mergeDefaultTailwindClassnames(
    defaultClassNames,
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
        <nav className="flex items-center justify-end w-full my-2">
          {processTopBarItems(
            title === 'CALYPR Landing Page'
              ? [
                  {
                    ...items[0],
                    classNames: {
                      ...items[0].classNames,
                      root: defaultClassNames.root,
                      label: defaultClassNames.label,
                      button: defaultClassNames.button,
                    },
                  },
                  ...items.slice(1),
                ]
              : items,
            true,
          )}
          <div className={extractClassName('loginMenu', mergedClassnames)}>
            <LoginMenu frontBanner={false} classNames={defaultClassNames} />
          </div>
        </nav>
      </header>
    </div>
  );
};

export default TopBar;
