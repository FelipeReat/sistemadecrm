import * as React from "react"
import InputMask from "react-input-mask"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  mask?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, mask, ...props }, ref) => {
    const baseClassName = cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    );

    if (mask) {
      return (
        <InputMask
          mask={mask}
          type={type}
          className={baseClassName}
          ref={ref}
          {...props}
        />
      );
    }

    return (
      <input
        type={type}
        className={baseClassName}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
