import { cn } from '@/lib/utils';
import { typography } from '@/design-system/tokens/typography';

const elements = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  body: 'p',
  caption: 'p',
  label: 'span',
};

export function Typography({ variant = 'body', className, as, children, ...props }) {
  const Comp = as || elements[variant] || 'p';
  return (
    <Comp className={cn(typography[variant], className)} {...props}>
      {children}
    </Comp>
  );
}

export function H1(props) {
  return <Typography variant="h1" {...props} />;
}

export function H2(props) {
  return <Typography variant="h2" {...props} />;
}

export function H3(props) {
  return <Typography variant="h3" {...props} />;
}

export function Body(props) {
  return <Typography variant="body" {...props} />;
}

export function Caption(props) {
  return <Typography variant="caption" {...props} />;
}

export function Label(props) {
  return <Typography variant="label" {...props} />;
}
