"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // Màu bo-* (token shadcn bg-primary / bg-input chưa khai báo nên công tắc trong suốt); lớp truyền vào vẫn đè được
        "peer data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary-strong inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}>
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-white shadow-sm pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )} />
    </SwitchPrimitive.Root>
  );
}

export { Switch }
