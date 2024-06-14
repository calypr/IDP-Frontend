import ProtectedContent from '../../components/Protected/ProtectedContent';
import Credentials from '../../components/Profile/Credentials';
import { Accordion } from '@mantine/core';
import { ResourcesPanel } from '../../components/Profile/ResourcesPanel';
import { ProfileProvider } from '../../components/Profile';
import { ProfileConfig } from '../../components/Profile';
import ExternalProvidersPanel from '../../components/Profile/ExternalProvidersPanel';
import { PiCaretCircleDownFill as Caret } from 'react-icons/pi';

export interface ProfileProps {
  profileConfig: ProfileConfig;
}

const Profile = ({ profileConfig }: ProfileProps) => {
  return (
    <ProtectedContent>
      <ProfileProvider profileConfig={profileConfig}>
        <div className="flex flex-col w-full">
          <Accordion
            multiple
            variant="separated"
            chevronPosition="left"
            chevron={<Caret className="text-primary-contrast" size="1.75rem" />}
            defaultValue={['apiKeys']}
          >
            {/* <Accordion.Item value="externalLogins">
              <div className="bg-secondary-lighter">
                <Accordion.Control className='text-secondary-contrast'>Link Account from External Data Resources</Accordion.Control>
              </div>
              <Accordion.Panel>
                <ExternalProvidersPanel />
              </Accordion.Panel>
            </Accordion.Item> */}
            <Accordion.Item value="apiKeys">
              <div className="bg-primary rounded">
                <Accordion.Control>
                <div className="text-primary-contrast font-heading font-bold">
                  Current API Keys
                </div>
                </Accordion.Control>
              </div>
              <Accordion.Panel>
                <Credentials />
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="resources">
              <div className="bg-primary rounded">
                <Accordion.Control>
                  <div className="text-primary-contrast font-heading font-bold">
                    Resources
                  </div>
                </Accordion.Control>
              </div>
              <Accordion.Panel>
                <ResourcesPanel />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </div>
      </ProfileProvider>
    </ProtectedContent>
  );
};

export default Profile;
