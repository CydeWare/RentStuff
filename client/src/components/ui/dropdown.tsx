import * as React from 'react';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/utils/cn';

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({ className, align = 'end', ...props }: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={8}
        className={cn('z-50 min-w-56 rounded-2xl border border-line bg-white p-1.5 shadow-lift data-[state=open]:animate-fade-in', className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export const DropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium outline-none data-[highlighted]:bg-stone-100 [&_svg]:size-4 [&_svg]:text-muted',
      className,
    )}
    {...props}
  />
));
DropdownItem.displayName = 'DropdownItem';

export function DropdownSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <DropdownPrimitive.Label className="px-3 py-2">{children}</DropdownPrimitive.Label>;
}
