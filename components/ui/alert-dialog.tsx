import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { getShadowContainer } from "@/components/ui/dialog"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="alert-dialog" modal={false} {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return (
    <DialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  // Detect if we're in the Dashboard (options.html)
  const isDashboard = window.location.pathname.endsWith('options.html')

  // DASHBOARD: Normal rendering, no Shadow DOM needed
  if (isDashboard) {
    return <DialogPrimitive.Portal {...props} />
  }

  // CONTENT SCRIPT: Render into Shadow DOM container for isolated styling
  const container = getShadowContainer()
  return <DialogPrimitive.Portal container={container} {...props} />
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-overlay"
      className={cn(
        // Positioning and Z-index
        "fixed inset-0 z-50",
        // Background and Blur
        "bg-black/40",
        "backdrop-blur-sm",
        "[backdrop-filter:blur(4px)]",
        "[-webkit-backdrop-filter:blur(4px)]",
        // Behavior
        "pointer-events-auto",
        // Animations
        "animate-in fade-in-0 duration-200",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <DialogPrimitive.Content
        role="alertdialog"
        data-slot="alert-dialog-content"
        className={cn(
          // Positioning
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          // Sizing
          "grid w-full max-w-lg gap-4",
          // Appearance - using card colors for dark mode compatibility
          "rounded-lg border border-border bg-card text-card-foreground p-6",
          "shadow-2xl",
          // Behavior
          "pointer-events-auto",
          // Animation
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-200",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold text-card-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}


