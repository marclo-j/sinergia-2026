import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  // Para inputs de contraseña con botón de "mostrar": type pasa a "text" al
  // revelarla, así que el type solo no alcanza para excluir la mayúscula.
  preserveCase?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, preserveCase, ...props }, ref) => {
    // Correo y contraseña quedan fuera: no deben verse distintos a lo que se escribió.
    const skipUppercase = preserveCase || type === "password" || type === "email";
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          !skipUppercase && "uppercase",
          className,
        )}
        onWheel={(e) => {
          // Evita que la rueda del mouse cambie el valor al hacer scroll de la
          // página con el cursor encima (afecta type="number" y type="date").
          e.currentTarget.blur();
          onWheel?.(e);
        }}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
