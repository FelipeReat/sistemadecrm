import * as React from "react"
import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  mask?: string;
}

// Custom mask implementation without findDOMNode
const applyMask = (value: string, mask: string): string => {
  if (!mask || !value) return value;
  
  let maskedValue = '';
  let valueIndex = 0;
  
  for (let i = 0; i < mask.length && valueIndex < value.length; i++) {
    const maskChar = mask[i];
    const valueChar = value[valueIndex];
    
    if (maskChar === '9') {
      // Only allow digits
      if (/\d/.test(valueChar)) {
        maskedValue += valueChar;
        valueIndex++;
      } else {
        // Skip non-digit characters in input
        valueIndex++;
        i--; // Don't advance mask position
      }
    } else if (maskChar === 'a') {
      // Only allow letters
      if (/[a-zA-Z]/.test(valueChar)) {
        maskedValue += valueChar;
        valueIndex++;
      } else {
        valueIndex++;
        i--; // Don't advance mask position
      }
    } else if (maskChar === '*') {
      // Allow any character
      maskedValue += valueChar;
      valueIndex++;
    } else {
      // Fixed character in mask
      maskedValue += maskChar;
      // If input matches the fixed character, consume it
      if (valueChar === maskChar) {
        valueIndex++;
      }
    }
  }
  
  return maskedValue;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, mask, onChange, value, ...props }, ref) => {
    const baseClassName = cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      className
    );

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      if (mask) {
        const rawValue = e.target.value.replace(/\D/g, ''); // Remove non-digits for most masks
        const maskedValue = applyMask(rawValue, mask);
        
        // Update the input value
        e.target.value = maskedValue;
        
        // Call the original onChange with the modified event
        if (onChange) {
          onChange(e);
        }
      } else {
        if (onChange) {
          onChange(e);
        }
      }
    }, [mask, onChange]);

    return (
      <input
        type={type}
        className={baseClassName}
        ref={ref}
        value={value}
        onChange={handleChange}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
