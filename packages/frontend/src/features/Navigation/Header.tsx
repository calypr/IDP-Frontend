import React from 'react';
import TopBar from './TopBar/TopBar';
import NavigationBar from './NavigationBar';
import { Banner } from './Banner';
import { HeaderProps, HeaderMetadata } from './types';
import HorizontalNavigationBar from './HorizontalClean/HorizontalNavigationBar';

const Header = ({
  top,
  navigation,
  banners,
  type = 'original',
  title,
}: HeaderProps & Pick<HeaderMetadata, 'title'>) => {
  console.log('PATHNAME: ', title);

  return type === 'horizontal' ? (
    <div className="w-full">
      {banners?.map((banner) => (
        <Banner {...banner} key={banner.id} />
      ))}
      <HorizontalNavigationBar
        logo={navigation.logo}
        title={navigation.title}
        items={navigation.items}
        classNames={{ ...navigation.classNames }}
        actions={top}
      />
    </div>
  ) : type === 'vertical' ? (
    <div>
      {banners?.map((banner) => (
        <Banner {...banner} key={banner.id} />
      ))}
      <HorizontalNavigationBar
        logo={navigation.logo}
        title={navigation.title}
        classNames={{ ...navigation.classNames }}
        actions={top}
      />
    </div>
  ) : (
    <div className="w-full">
      <TopBar
        items={top.items}
        loginButtonVisibility={top?.loginButtonVisibility}
        externalLoginUrl={top?.externalLoginUrl}
        classNames={{ ...top.classNames }}
        itemClassnames={{ ...top.itemClassnames }}
        logo={navigation.logo}
        title={title}
      />
      {banners?.map((banner) => (
        <Banner {...banner} key={banner.id} />
      ))}
    </div>
  );
};

export default Header;
