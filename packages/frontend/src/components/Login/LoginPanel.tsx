import React, { useCallback } from 'react';
import { useRouter } from 'next/router';
import { Center, Stack } from '@mantine/core';
import TexturedSidePanel from '../Layout/TexturedSidePanel';
import LoginProvidersPanel from './LoginProvidersPanel';
import CredentialsLogin from './CredentialsLogin';
import TextContent from '../Content/TextContent';
import { LoginConfig } from './types';
import ContactWithEmailContent from '../Content/ContactWithEmailContent';
import { appendParameterToUrl } from './utils';
import { safeRedirect } from './safeRedirect';

const LoginPanel = (loginConfig: LoginConfig) => {
  const { image, topContent, bottomContent } = loginConfig;

  const router = useRouter();
  const {
    query: { referer },
  } = router;

  const handleFenceLoginSelected = useCallback(
    (loginURL: string) => {
      window.location.assign(
        appendParameterToUrl(loginURL, 'redirect', safeRedirect(referer)),
      );
    },
    [referer],
  );

  const handleCredentialsLogin = useCallback(async () => {
    const redirect = safeRedirect(referer);
    window.location.assign(redirect);
  }, [referer]);

  return (
    <div className="grid grid-cols-6 w-full">
      <TexturedSidePanel url={image} />
      <div className="relative col-span-4 mt-24 flex-col justify-center sm:prose-base lg:prose-lg xl:prose-xl 2xl:prose-xl w-full first:captialize first:font-bold">
        {topContent?.map((content, index) => {
          if (content.image) {
            return (
              <div key={index}>
                <img
                  src={`${router.basePath}${content.image.src}`}
                  alt={content.image.alt}
                  className="w-1/2 mx-auto"
                ></img>
              </div>
            );
          } else {
            return <TextContent {...content} key={index} />;
          }
        })}

        <LoginProvidersPanel handleLoginSelected={handleFenceLoginSelected} />

        {loginConfig?.showCredentialsLogin &&
          process.env.NODE_ENV === 'development' && (
            <CredentialsLogin handleLogin={handleCredentialsLogin} />
          )}
        <Center>
          <Stack>
            {bottomContent?.map((content, index) =>
              content?.email ? (
                <ContactWithEmailContent {...content} key={index} />
              ) : (
                <TextContent {...content} key={index} />
              ),
            )}
          </Stack>
        </Center>
      </div>
      <TexturedSidePanel url={image} />
    </div>
  );
};

export default LoginPanel;
