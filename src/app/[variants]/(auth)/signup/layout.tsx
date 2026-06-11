import { BRANDING_NAME } from '@lobechat/business-const';
import { type PropsWithChildren } from 'react';

import { metadataModule } from '@/server/metadata';
import { translation } from '@/server/translation';
import { type DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

export const generateMetadata = async (props: DynamicLayoutProps) => {
  const locale = await RouteVariants.getLocale(props);
  const { t } = await translation('auth', locale);

  return metadataModule.generate({
    description: t('signup.subtitle', { appName: BRANDING_NAME }),
    title: t('signup.title'),
    url: '/signup',
  });
};

const Layout = ({ children }: PropsWithChildren) => children;

export default Layout;
