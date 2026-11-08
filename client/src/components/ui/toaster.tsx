import * as React from "react"

import { TOAST_OPEN_DURATION_MS, useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastProvider,
  ToastTitle,
  ToastDescription,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import "./toaster.css"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, variant, action, className, duration, ...props }) {
        const actionElement =
          action && React.isValidElement(action)
            ? React.cloneElement(action as React.ReactElement<{ className?: string }>, {
                className: cn(
                  (action.props as { className?: string }).className,
                  "border-white/30 bg-white/10 text-white hover:bg-white/20"
                ),
              })
            : action

        return (
          <Toast
            key={id}
            variant="default"
            data-original-variant={variant ?? "default"}
            duration={
              typeof duration === "number" && Number.isFinite(duration)
                ? Math.max(0, Math.min(duration, TOAST_OPEN_DURATION_MS))
                : TOAST_OPEN_DURATION_MS
            }
            className={cn(
              "min-w-[170px] w-[min(220px,calc(100vw-2rem))] min-h-0 max-h-[190px] flex-col items-center justify-center gap-1 rounded-[4px] border-0 bg-[rgba(28,28,28,0.72)] px-5 py-4 text-center text-white shadow-[0_6px_18px_rgba(0,0,0,0.2)] backdrop-blur-[1px]",
              "app-toast-motion",
              className
            )}
            {...props}
          >
            <div className="flex w-full min-w-0 flex-col items-center gap-1 text-center">
              {title && (
                <ToastTitle className="line-clamp-1 whitespace-normal text-[15px] font-normal leading-[1.4] text-white">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="line-clamp-3 whitespace-normal break-words text-[14px] font-normal leading-[1.4] text-white opacity-100">
                  {description}
                </ToastDescription>
              )}
              {actionElement && (
                <div className="mt-3 flex justify-end">
                  {actionElement}
                </div>
              )}
            </div>
          </Toast>
        )
      })}
      <ToastViewport
        className="top-1/2 left-1/2 w-[min(26rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 gap-2"
      />
    </ToastProvider>
  )
}
