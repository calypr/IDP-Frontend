import tw from 'tailwind-styled-components';

interface Gen3ButtonProps {
  colors: string;
}

export const Gen3Button = tw.div<Gen3ButtonProps>`
inline-block
text-center
text-primary-contrast
leading-[1.5]
font-semibold
border-4
px-2
py-1
border-solid
border-transparent
rounded-[7px]
bg-primary
${(p) => `hover:bg-${p.colors}-max`}
`;

export const Gen3ButtonReverse = tw.div<Gen3ButtonProps>`
bg-base-max
text-primary-contrast
border-accent-lighter
inline-block
text-center
px-2
py-2
text-base
leading-[1.5]
font-semibold
uppercase
border-4
border-solid
rounded-[7px]
`;
