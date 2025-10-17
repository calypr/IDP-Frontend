import { TextContentProps } from '../Content/TextContent';
import { Gen3AppConfigData } from '../../lib/content/types';
import { StylingOverrideWithMergeControl } from '../../types';

export interface Gen3LoginPanelConfig {
  title: string; // Main title for Login page
  subtitle: string; // a sub title
  text: string; // text string below the login buttons
  contact: string; // contact message
  email: string;
  image: string;
  className: string;
}

export interface LoginConfig
  extends Partial<Gen3LoginPanelConfig>,
    Gen3AppConfigData {
  topContent?: ReadonlyArray<TextImageContentProps>;
  bottomContent?: ReadonlyArray<TextImageContentProps>;
  showCredentialsLogin?: boolean;
}

interface TextImageContentProps extends TextContentProps {
  readonly image?: {
    readonly src: string;
    readonly alt: string;
  };
  readonly className: string;
}

export interface LoginSelectedProps {
  readonly handleLoginSelected: (_url: string) => void;
  classNames?: StylingOverrideWithMergeControl;
}

export enum LoginButtonVisibility {
  Hidden = 'hide',
  Visible = 'visible',
  LogoutOnly = 'logoutOnly',
}
