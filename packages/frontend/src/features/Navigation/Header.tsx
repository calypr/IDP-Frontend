import React from 'react';
import TopBar from './TopBar/TopBar';
import { Banner } from './Banner';
import { HeaderToggleProps, HeaderMetadata } from './types';
import HorizontalNavigationBar from './HorizontalClean/HorizontalNavigationBar';

const Header = ({
  topBar,
  navigation,
  banners,
  type = 'original',
  title,
  onToggle = () => undefined,
  basePage,
}: HeaderToggleProps & Pick<HeaderMetadata, 'title'>) => {
  return (
    <div>
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
            actions={topBar}
            onToggle={onToggle}
          />
        </div>
      ) : type === 'vertical' ? (
        <div className={`w-full h-full`}>
          {banners?.map((banner) => (
            <Banner {...banner} key={banner.id * 100} />
          ))}
          <TopBar
            items={topBar?.items || []}
            loginButtonVisibility={topBar?.loginButtonVisibility}
            externalLoginUrl={topBar?.externalLoginUrl}
            classNames={{ ...topBar?.classNames }}
            itemClassnames={{ ...topBar?.itemClassnames }}
            logo={navigation.logo}
            title={title}
            onToggle={onToggle}
          />
        </div>
      ) : (
        <div className="w-full h-full">
          <TopBar
            items={topBar?.items || []}
            loginButtonVisibility={topBar?.loginButtonVisibility}
            externalLoginUrl={topBar?.externalLoginUrl}
            classNames={{ ...topBar?.classNames }}
            itemClassnames={{ ...topBar?.itemClassnames }}
            logo={navigation.logo}
            title={title}
            onToggle={onToggle}
          />
          {banners?.map((banner) => (
            <Banner {...banner} key={banner.id * 100} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Header;
