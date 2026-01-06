import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  // Track checked state for styling - support both controlled and uncontrolled
  const [isChecked, setIsChecked] = React.useState(defaultChecked ?? false)
  
  // Use controlled value if provided
  const actualChecked = checked !== undefined ? checked : isChecked

  const handleChange = (value: boolean) => {
    if (checked === undefined) {
      setIsChecked(value)
    }
    onCheckedChange?.(value)
  }

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={handleChange}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{
        backgroundColor: actualChecked ? '#22c55e' : '#374151',
        position: 'relative',
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-all"
        )}
        style={{
          backgroundColor: '#ffffff',
          position: 'absolute',
          left: actualChecked ? '18px' : '1px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
