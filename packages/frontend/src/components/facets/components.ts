import tw from 'tailwind-styled-components';

export const FacetIconButton = tw.button`
text-base-max
font-bold
py-2
px-1
rounded
inline-flex
items-center
hover:text-primary-lightest
`;

export const controlsIconStyle = 'text-white hover:bg-primary';

export const FacetText = tw.div`
text-secondary-contrast-darkest font-heading font-semibold text-sm break-words
`;

export const FacetHeader = tw.div`
flex items-start justify-between items-center flex-nowrap bg-primary px-1.5 rounded-t-sm
`;
