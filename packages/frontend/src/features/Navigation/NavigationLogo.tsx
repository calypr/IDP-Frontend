import { NavigationBarLogo } from './types';
import HoverLink from './HoverLink';
import Image from 'next/image';
import React from 'react';
import { extractClassName } from './utils';
import { mergeDefaultTailwindClassnames } from '../../utils/mergeDefaultTailwindClassnames';
import { UnstyledButton } from '@mantine/core';
const NavigationLogo = ({
  src,
  title,
  description,
  width,
  height,
  divider = false,
  basePath = '',
  noBasePath = undefined,
  classNames = {},
  href,
  basepage,
  onToggle = () => undefined,
}: NavigationBarLogo) => {
  const classNamesDefaults = {
    root: 'relative flex py-2 justify-start items-center align-middle font-heading font-bold tracking-wide text-xl',
    link: 'relative object-contain',
    logo: 'flex-shrink-0 min-w-[50px] max-h-[40px]',
    title: 'border-solid border-base-darker ml-1 mr-3',
    divider:
      'border-solid border-gen3-smoke border-l-1 ml-[2px] mr-[7px] h-[64px] w-1',
    titleLink:
      basepage === true
        ? 'font-heading text-md pt-2 text-black hover:text-black hover:border-black hover:border-b-3'
        : 'font-heading text-md pt-2 text-white hover:text-white border-black hover:border-white hover:border-b-3',
  };

  const mergedClassnames = mergeDefaultTailwindClassnames(
    classNamesDefaults,
    classNames,
  );

  return (
    <div
      className={extractClassName('root', mergedClassnames)}
      role="navigation"
    >
      {basepage === true ? (
        <React.Fragment />
      ) : (
        <UnstyledButton
          onClick={onToggle}
          className="ml-4 p-2 rounded-full hover:bg-black transition duration-150"
          aria-label="Toggle Navigation Drawer"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </UnstyledButton>
      )}
      <HoverLink
        className={extractClassName('link', mergedClassnames)}
        href={href}
        noBasePath={noBasePath}
      >
        <Image
          className={extractClassName('logo', mergedClassnames)}
          width={width ?? undefined}
          height={height ?? undefined}
          fill={!width && !height}
          src={
            !basepage ? `${basePath}/icons/ohsu_white.svg` : `${basePath}${src}`
          }
          alt={description ?? title ?? 'link back to homepage'}
        />
      </HoverLink>
      {divider && (
        <div className={extractClassName('divider', mergedClassnames)} />
      )}
      {title && (
        <div
          className={extractClassName('title', mergedClassnames)}
          role="navigation"
        >
          <HoverLink
            className={extractClassName('titleLink', mergedClassnames)}
            href={href}
          >
            {title}
          </HoverLink>
        </div>
      )}
    </div>
  );
};

export default NavigationLogo;
