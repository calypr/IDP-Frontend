import React from 'react';
import TopBar from './TopBar/TopBar';
import { Banner } from './Banner';
import { HeaderToggleProps, HeaderMetadata } from './types';
import HorizontalNavigationBar from './HorizontalClean/HorizontalNavigationBar';

const Header = ({
  top,
  navigation,
  banners,
  type = 'original',
  title,
  onToggle,
  basePage,
}: HeaderToggleProps & Pick<HeaderMetadata, 'title'>) => {
  const accentColor = basePage ? 'bg-white' : 'bg-accent';

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 h-16 z-50 shadow-md ${accentColor}
      `}
    >
      {type === 'horizontal' ? (
        <div className="w-full h-full">
          {banners?.map((banner) => (
            <Banner {...banner} key={banner.id * 100} />
          ))}
          <HorizontalNavigationBar
            logo={navigation.logo}
            title={navigation.title}
            items={navigation.items}
            classNames={{ ...navigation.classNames }}
            actions={top}
            onToggle={onToggle}
          />
        </div>
      ) : type === 'vertical' ? (
        <div className="w-full h-full">
          {banners?.map((banner) => (
            <Banner {...banner} key={banner.id * 100} />
          ))}
          <TopBar
            items={top.items}
            loginButtonVisibility={top?.loginButtonVisibility}
            externalLoginUrl={top?.externalLoginUrl}
            classNames={{ ...top.classNames }}
            itemClassnames={{ ...top.itemClassnames }}
            logo={navigation.logo}
            title={title}
            onToggle={onToggle}
          />
        </div>
      ) : (
        <div className="w-full h-full">
          <TopBar
            items={top.items}
            loginButtonVisibility={top?.loginButtonVisibility}
            externalLoginUrl={top?.externalLoginUrl}
            classNames={{ ...top.classNames }}
            itemClassnames={{ ...top.itemClassnames }}
            logo={navigation.logo}
            title={title}
            onToggle={onToggle}
          />
          {banners?.map((banner) => (
            <Banner {...banner} key={banner.id * 100} />
          ))}
        </div>
      )}
    </header>
  );
};

export default Header;
