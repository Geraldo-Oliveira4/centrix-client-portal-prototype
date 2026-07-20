"use client";

// src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) return "-";
  let cleaned = phoneNumber.replace(/[^\d+]/g, "");
  const hasCountryCode = cleaned.startsWith("+");
  if (cleaned.startsWith("+55")) {
    cleaned = cleaned.substring(3);
  } else if (hasCountryCode) {
    return phoneNumber;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
  }
  return phoneNumber;
}
function normalizePhoneForBackend(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }
  return digits;
}

// src/lib/session.ts
var SESSION_DURATION_MS = 60 * 60 * 1e3;
var REFRESH_THRESHOLD_MS = 5 * 60 * 1e3;
function createSessionManager(sessionKey) {
  function persistSession(session) {
    const serialized = JSON.stringify(session);
    localStorage.setItem(sessionKey, serialized);
    document.cookie = `${sessionKey}=${encodeURIComponent(serialized)}; path=/; max-age=${SESSION_DURATION_MS / 1e3}; SameSite=Lax; Secure`;
  }
  function clearSession() {
    localStorage.removeItem(sessionKey);
    document.cookie = `${sessionKey}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  function readSession() {
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return {
    SESSION_KEY: sessionKey,
    SESSION_DURATION_MS,
    REFRESH_THRESHOLD_MS,
    persistSession,
    clearSession,
    readSession
  };
}

// src/lib/axios.ts
import axios from "axios";
import { toast } from "react-toastify";
function createApiClient(baseURL, session) {
  const api = axios.create({ baseURL });
  let isRefreshing = false;
  let refreshSubscribers = [];
  const subscribeToRefresh = (callback) => {
    refreshSubscribers.push(callback);
  };
  const onRefreshed = (token) => {
    refreshSubscribers.forEach((cb) => cb(token));
    refreshSubscribers = [];
  };
  api.interceptors.request.use(
    (config) => {
      const stored = session.readSession();
      if (stored == null ? void 0 : stored.accessToken) {
        config.headers.Authorization = `Bearer ${stored.accessToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      var _a;
      const originalRequest = error.config;
      if (((_a = error.response) == null ? void 0 : _a.status) === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve) => {
            subscribeToRefresh((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            });
          });
        }
        originalRequest._retry = true;
        isRefreshing = true;
        try {
          const stored = session.readSession();
          if (!stored) throw new Error("No session found");
          const response = await axios.post(`${baseURL}/refresh-token`, {
            refresh_token: stored.refreshToken
          });
          const { access_token } = response.data;
          const newSession = {
            ...stored,
            accessToken: access_token,
            accessTokenExpires: Date.now() + session.SESSION_DURATION_MS
          };
          session.persistSession(newSession);
          api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
          onRefreshed(access_token);
          isRefreshing = false;
          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          refreshSubscribers = [];
          session.clearSession();
          if (typeof window !== "undefined" && window.location.pathname !== "/login") {
            toast.error("Sua sess\xE3o expirou. Por favor, fa\xE7a login novamente.");
            window.location.href = "/login";
          }
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
  return api;
}

// src/context/auth/auth-context.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { jsx } from "react/jsx-runtime";
var AuthContext = createContext(void 0);
var base64UrlDecode = (str) => {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) throw new Error("Invalid base64url string");
    base64 += new Array(5 - pad).join("=");
  }
  return base64;
};
var decodeJWT = (token) => {
  if (!token || typeof token !== "string") {
    throw new Error("Token is required and must be a string");
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = base64UrlDecode(parts[1]);
  return JSON.parse(atob(payload));
};
var AuthProvider = ({
  children,
  sessionManager,
  apiClient,
  publicRoutes = [],
  postLoginRedirect = "/home",
  rolesClaimKey = "cognito:groups"
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimeout = useRef();
  const defaultPublicRoutes = ["/login", "/register", "/reset-password"];
  const allPublicRoutes = [...defaultPublicRoutes, ...publicRoutes];
  const scheduleTokenRefresh = (expiresIn) => {
    if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    const refreshTime = expiresIn - sessionManager.REFRESH_THRESHOLD_MS;
    if (refreshTime > 0) {
      refreshTimeout.current = setTimeout(refreshSession, refreshTime);
    }
  };
  const refreshSession = async () => {
    const current = sessionManager.readSession();
    if (!(current == null ? void 0 : current.refreshToken)) {
      await logout();
      return;
    }
    try {
      const response = await apiClient.post("/refresh-token", {
        refresh_token: current.refreshToken
      });
      const { access_token, id_token } = response.data;
      const payload = decodeJWT(id_token);
      const newSession = {
        ...current,
        accessToken: access_token,
        accessTokenExpires: Date.now() + sessionManager.SESSION_DURATION_MS,
        user: {
          ...current.user,
          roles: payload[rolesClaimKey] || []
        }
      };
      sessionManager.persistSession(newSession);
      setSession(newSession);
      setRoles(newSession.user.roles);
      scheduleTokenRefresh(sessionManager.SESSION_DURATION_MS);
    } catch (err) {
      console.error("Token refresh failed:", err);
      await logout();
    }
  };
  useEffect(() => {
    const loadSession = () => {
      const storedSession = sessionManager.readSession();
      if (storedSession) {
        const timeUntilExpiry = storedSession.accessTokenExpires - Date.now();
        if (timeUntilExpiry > sessionManager.REFRESH_THRESHOLD_MS) {
          setSession(storedSession);
          setIsAuthenticated(true);
          setRoles(storedSession.user.roles);
          scheduleTokenRefresh(timeUntilExpiry);
        } else if (timeUntilExpiry > 0) {
          refreshSession();
        } else {
          logout();
        }
      }
      setIsLoading(false);
    };
    loadSession();
    return () => {
      if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    };
  }, []);
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !allPublicRoutes.some((r) => pathname.startsWith(r))) {
      router.push("/login");
    }
  }, [isAuthenticated, pathname, router, isLoading]);
  const login = async (email, password) => {
    const response = await apiClient.post("/login", { email, password });
    if (!response.data || typeof response.data !== "object") {
      throw new Error("Invalid API response format");
    }
    const { access_token, refresh_token, id_token } = response.data;
    if (!access_token || !refresh_token || !id_token) {
      throw new Error("Missing authentication tokens in API response");
    }
    const payload = decodeJWT(id_token);
    const newSession = {
      accessToken: access_token,
      refreshToken: refresh_token,
      accessTokenExpires: Date.now() + sessionManager.SESSION_DURATION_MS,
      user: {
        email,
        name: payload.name || "",
        roles: payload[rolesClaimKey] || []
      }
    };
    sessionManager.persistSession(newSession);
    setSession(newSession);
    setIsAuthenticated(true);
    setRoles(newSession.user.roles);
    scheduleTokenRefresh(sessionManager.SESSION_DURATION_MS);
    router.push(postLoginRedirect);
  };
  const logout = async () => {
    if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    sessionManager.clearSession();
    setSession(null);
    setIsAuthenticated(false);
    setRoles([]);
    if (!allPublicRoutes.some((r) => pathname.startsWith(r))) {
      router.push("/login");
    }
  };
  return /* @__PURE__ */ jsx(
    AuthContext.Provider,
    {
      value: { session, isAuthenticated, roles, login, logout, refreshSession },
      children
    }
  );
};
var useAuth = () => {
  const context = useContext(AuthContext);
  if (context === void 0) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// src/context/auth/use-authorization.ts
var useAuthorization = (requiredRoles) => {
  const { roles } = useAuth();
  return requiredRoles.some((role) => roles.includes(role));
};

// src/context/auth/roles.ts
var Roles = /* @__PURE__ */ ((Roles2) => {
  Roles2["Admin"] = "admin";
  Roles2["Manager"] = "manager";
  Roles2["User"] = "user";
  return Roles2;
})(Roles || {});

// src/context/auth/protected-component.tsx
import { Fragment, jsx as jsx2 } from "react/jsx-runtime";
var ProtectedComponent = ({
  requiredRoles,
  children
}) => {
  const isAuthorized = useAuthorization(requiredRoles);
  if (!isAuthorized) return null;
  return /* @__PURE__ */ jsx2(Fragment, { children });
};
var protected_component_default = ProtectedComponent;

// src/components/ui/label.tsx
import * as React2 from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva } from "class-variance-authority";
import { jsx as jsx3 } from "react/jsx-runtime";
var labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);
var Label = React2.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx3(
  LabelPrimitive.Root,
  {
    ref,
    className: cn(labelVariants(), className),
    ...props
  }
));
Label.displayName = LabelPrimitive.Root.displayName;

// src/components/ui/input.tsx
import * as React3 from "react";
import { jsx as jsx4 } from "react/jsx-runtime";
var Input = React3.forwardRef(
  ({ className, type, ...props }, ref) => {
    return /* @__PURE__ */ jsx4(
      "input",
      {
        type,
        className: cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        ),
        ref,
        ...props
      }
    );
  }
);
Input.displayName = "Input";

// src/components/ui/textarea.tsx
import * as React4 from "react";
import { jsx as jsx5 } from "react/jsx-runtime";
var Textarea = React4.forwardRef(
  ({ className, ...props }, ref) => {
    return /* @__PURE__ */ jsx5(
      "textarea",
      {
        className: cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        ),
        ref,
        ...props
      }
    );
  }
);
Textarea.displayName = "Textarea";

// src/components/ui/button.tsx
import * as React5 from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva as cva2 } from "class-variance-authority";
import { jsx as jsx6 } from "react/jsx-runtime";
var buttonVariants = cva2(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
var Button = React5.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return /* @__PURE__ */ jsx6(
      Comp,
      {
        className: cn(buttonVariants({ variant, size, className })),
        ref,
        ...props
      }
    );
  }
);
Button.displayName = "Button";

// src/components/ui/calendar.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { jsx as jsx7 } from "react/jsx-runtime";
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return /* @__PURE__ */ jsx7(
    DayPicker,
    {
      showOutsideDays,
      className: cn("p-3", className),
      classNames: {
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames
      },
      components: {
        IconLeft: () => /* @__PURE__ */ jsx7(ChevronLeft, { className: "h-4 w-4" }),
        IconRight: () => /* @__PURE__ */ jsx7(ChevronRight, { className: "h-4 w-4" })
      },
      ...props
    }
  );
}
Calendar.displayName = "Calendar";

// src/components/ui/popover.tsx
import * as React6 from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { jsx as jsx8 } from "react/jsx-runtime";
var Popover = PopoverPrimitive.Root;
var PopoverTrigger = PopoverPrimitive.Trigger;
var PopoverContent = React6.forwardRef(({ className, align = "center", sideOffset = 4, ...props }, ref) => /* @__PURE__ */ jsx8(PopoverPrimitive.Portal, { children: /* @__PURE__ */ jsx8(
  PopoverPrimitive.Content,
  {
    ref,
    align,
    sideOffset,
    className: cn(
      "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    ),
    ...props
  }
) }));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

// src/components/ui/select.tsx
import * as React7 from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { jsx as jsx9, jsxs } from "react/jsx-runtime";
var Select = SelectPrimitive.Root;
var SelectGroup = SelectPrimitive.Group;
var SelectValue = SelectPrimitive.Value;
var SelectTrigger = React7.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
  SelectPrimitive.Trigger,
  {
    ref,
    className: cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    ),
    ...props,
    children: [
      children,
      /* @__PURE__ */ jsx9(SelectPrimitive.Icon, { asChild: true, children: /* @__PURE__ */ jsx9(ChevronDown, { className: "h-4 w-4 opacity-50" }) })
    ]
  }
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
var SelectScrollUpButton = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx9(
  SelectPrimitive.ScrollUpButton,
  {
    ref,
    className: cn("flex cursor-default items-center justify-center py-1", className),
    ...props,
    children: /* @__PURE__ */ jsx9(ChevronUp, { className: "h-4 w-4" })
  }
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;
var SelectScrollDownButton = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx9(
  SelectPrimitive.ScrollDownButton,
  {
    ref,
    className: cn("flex cursor-default items-center justify-center py-1", className),
    ...props,
    children: /* @__PURE__ */ jsx9(ChevronDown, { className: "h-4 w-4" })
  }
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;
var SelectContent = React7.forwardRef(({ className, children, position = "popper", ...props }, ref) => /* @__PURE__ */ jsx9(SelectPrimitive.Portal, { children: /* @__PURE__ */ jsxs(
  SelectPrimitive.Content,
  {
    ref,
    className: cn(
      "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
      className
    ),
    position,
    ...props,
    children: [
      /* @__PURE__ */ jsx9(SelectScrollUpButton, {}),
      /* @__PURE__ */ jsx9(
        SelectPrimitive.Viewport,
        {
          className: cn(
            "p-1",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
          ),
          children
        }
      ),
      /* @__PURE__ */ jsx9(SelectScrollDownButton, {})
    ]
  }
) }));
SelectContent.displayName = SelectPrimitive.Content.displayName;
var SelectLabel = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx9(
  SelectPrimitive.Label,
  {
    ref,
    className: cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className),
    ...props
  }
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;
var SelectItem = React7.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(
  SelectPrimitive.Item,
  {
    ref,
    className: cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    ),
    ...props,
    children: [
      /* @__PURE__ */ jsx9("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsx9(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ jsx9(Check, { className: "h-4 w-4" }) }) }),
      /* @__PURE__ */ jsx9(SelectPrimitive.ItemText, { children })
    ]
  }
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
var SelectSeparator = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx9(
  SelectPrimitive.Separator,
  {
    ref,
    className: cn("-mx-1 my-1 h-px bg-muted", className),
    ...props
  }
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

// src/components/ui/form.tsx
import * as React8 from "react";
import { Slot as Slot2 } from "@radix-ui/react-slot";
import {
  Controller,
  FormProvider,
  useFormContext
} from "react-hook-form";
import { jsx as jsx10 } from "react/jsx-runtime";
var Form = FormProvider;
var FormFieldContext = React8.createContext(
  {}
);
var FormField = ({
  ...props
}) => {
  return /* @__PURE__ */ jsx10(FormFieldContext.Provider, { value: { name: props.name }, children: /* @__PURE__ */ jsx10(Controller, { ...props }) });
};
var useFormField = () => {
  const fieldContext = React8.useContext(FormFieldContext);
  const itemContext = React8.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(fieldContext.name, formState);
  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }
  const { id } = itemContext;
  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  };
};
var FormItemContext = React8.createContext(
  {}
);
var FormItem = React8.forwardRef(({ className, ...props }, ref) => {
  const id = React8.useId();
  return /* @__PURE__ */ jsx10(FormItemContext.Provider, { value: { id }, children: /* @__PURE__ */ jsx10("div", { ref, className: cn("space-y-2", className), ...props }) });
});
FormItem.displayName = "FormItem";
var FormLabel = React8.forwardRef(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();
  return /* @__PURE__ */ jsx10(
    Label,
    {
      ref,
      className: cn(error && "text-destructive", className),
      htmlFor: formItemId,
      ...props
    }
  );
});
FormLabel.displayName = "FormLabel";
var FormControl = React8.forwardRef(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return /* @__PURE__ */ jsx10(
    Slot2,
    {
      ref,
      id: formItemId,
      "aria-describedby": !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`,
      "aria-invalid": !!error,
      ...props
    }
  );
});
FormControl.displayName = "FormControl";
var FormDescription = React8.forwardRef(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  return /* @__PURE__ */ jsx10(
    "p",
    {
      ref,
      id: formDescriptionId,
      className: cn("text-sm text-muted-foreground", className),
      ...props
    }
  );
});
FormDescription.displayName = "FormDescription";
var FormMessage = React8.forwardRef(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error == null ? void 0 : error.message) : children;
  if (!body) return null;
  return /* @__PURE__ */ jsx10(
    "p",
    {
      ref,
      id: formMessageId,
      className: cn("text-sm font-medium text-destructive", className),
      ...props,
      children: body
    }
  );
});
FormMessage.displayName = "FormMessage";

// src/components/date-picker.tsx
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { jsx as jsx11, jsxs as jsxs2 } from "react/jsx-runtime";
function DatePicker({ selected, onSelect, className, placeholder = "Escolha uma data" }) {
  const handleSelect = (date) => {
    if (date) {
      const dateWithTime = new Date(date);
      dateWithTime.setUTCHours(6, 0, 0, 0);
      onSelect(dateWithTime);
    } else {
      onSelect(void 0);
    }
  };
  return /* @__PURE__ */ jsxs2(Popover, { children: [
    /* @__PURE__ */ jsx11(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs2(
      Button,
      {
        variant: "outline",
        className: cn(
          "w-[280px] justify-start text-left font-normal",
          !selected && "text-muted-foreground",
          className
        ),
        children: [
          /* @__PURE__ */ jsx11(CalendarIcon, { className: "mr-2 h-4 w-4" }),
          selected ? format(selected, "dd/MM/yy", { locale: ptBR }) : /* @__PURE__ */ jsx11("span", { children: placeholder })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx11(PopoverContent, { className: "w-auto p-0", children: /* @__PURE__ */ jsx11(
      Calendar,
      {
        mode: "single",
        selected,
        onSelect: handleSelect,
        initialFocus: true
      }
    ) })
  ] });
}

// src/components/loader-component.tsx
import { ClipLoader } from "react-spinners";
import { jsx as jsx12 } from "react/jsx-runtime";
var LoaderComponent = ({ color = "#164bf9", size = 50 }) => {
  return /* @__PURE__ */ jsx12("div", { className: "flex justify-center items-center h-full", children: /* @__PURE__ */ jsx12(ClipLoader, { color, size }) });
};
var loader_component_default = LoaderComponent;

// src/components/error-component.tsx
import { jsx as jsx13, jsxs as jsxs3 } from "react/jsx-runtime";
var ErrorComponent = ({ message }) => {
  return /* @__PURE__ */ jsxs3("div", { className: "flex flex-col items-center justify-center h-full text-center p-4", children: [
    /* @__PURE__ */ jsx13("h1", { className: "text-3xl font-semibold", style: { color: "#F97316" }, children: message ? "Erro" : "Aguarde o servidor inicializar" }),
    /* @__PURE__ */ jsx13("p", { className: "text-lg text-gray-700 mb-4", children: message || "Inicializando o servidor, recarregue em 30 segundos." }),
    /* @__PURE__ */ jsx13("p", { className: "text-sm text-gray-500 mt-2", children: "Caso o problema persista, saia e entre novamente em sua conta." })
  ] });
};
var error_component_default = ErrorComponent;

// src/components/page-title.tsx
import { jsx as jsx14 } from "react/jsx-runtime";
function PageTitle({ title, className }) {
  return /* @__PURE__ */ jsx14("h1", { className: cn("text-2xl font-semibold", className), children: title });
}

// src/components/empty-state.tsx
import { jsx as jsx15 } from "react/jsx-runtime";
function EmptyState({ message, className }) {
  return /* @__PURE__ */ jsx15(
    "p",
    {
      className: cn(
        "text-sm text-muted-foreground py-6 text-center border rounded-lg",
        className
      ),
      children: message
    }
  );
}

// src/components/loading-state.tsx
import { Loader2 } from "lucide-react";
import { jsx as jsx16, jsxs as jsxs4 } from "react/jsx-runtime";
function LoadingState({
  message = "Carregando...",
  spinner = false,
  className
}) {
  if (spinner) {
    return /* @__PURE__ */ jsxs4("div", { className: cn("flex items-center gap-2 text-sm text-muted-foreground py-3", className), children: [
      /* @__PURE__ */ jsx16(Loader2, { className: "w-4 h-4 animate-spin" }),
      message
    ] });
  }
  return /* @__PURE__ */ jsx16("div", { className: cn("text-sm text-muted-foreground py-6 text-center", className), children: message });
}

// src/components/section-header.tsx
import { jsx as jsx17 } from "react/jsx-runtime";
function SectionHeader({ children, className }) {
  return /* @__PURE__ */ jsx17(
    "p",
    {
      className: cn(
        "text-xs font-semibold text-muted-foreground uppercase tracking-wide",
        className
      ),
      children
    }
  );
}

// src/components/form-section.tsx
import { jsx as jsx18, jsxs as jsxs5 } from "react/jsx-runtime";
function FormSection({ title, children, gap = 4, className }) {
  return /* @__PURE__ */ jsxs5("fieldset", { className: cn("flex flex-col", gap === 3 ? "gap-3" : "gap-4", className), children: [
    /* @__PURE__ */ jsx18("legend", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1", children: title }),
    children
  ] });
}

// src/components/form-grid.tsx
import { jsx as jsx19 } from "react/jsx-runtime";
function FormGrid({ cols = 2, gap = 4, className, children }) {
  return /* @__PURE__ */ jsx19(
    "div",
    {
      className: cn(
        "grid grid-cols-1",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-3",
        gap === 3 && "gap-3",
        gap === 4 && "gap-4",
        className
      ),
      children
    }
  );
}

// src/components/card-section.tsx
import { jsx as jsx20, jsxs as jsxs6 } from "react/jsx-runtime";
function CardSection({
  number,
  title,
  subtitle,
  children,
  innerClassName
}) {
  return /* @__PURE__ */ jsxs6("div", { className: "rounded-xl border bg-card", children: [
    /* @__PURE__ */ jsxs6("div", { className: "flex items-start gap-3 px-4 py-3 border-b bg-muted/40 rounded-t-xl", children: [
      /* @__PURE__ */ jsx20("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground mt-0.5", children: number }),
      /* @__PURE__ */ jsxs6("div", { children: [
        /* @__PURE__ */ jsx20("p", { className: "text-sm font-semibold", children: title }),
        /* @__PURE__ */ jsx20("p", { className: "text-xs text-muted-foreground leading-tight", children: subtitle })
      ] })
    ] }),
    /* @__PURE__ */ jsx20("div", { className: cn("p-4", innerClassName), children })
  ] });
}

// src/components/file-list-item.tsx
import { jsx as jsx21, jsxs as jsxs7 } from "react/jsx-runtime";
function FileListItem({
  iconElement,
  name,
  meta,
  actions,
  className
}) {
  return /* @__PURE__ */ jsxs7(
    "div",
    {
      className: cn(
        "flex items-center justify-between rounded-md border px-3 py-2.5 gap-3",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs7("div", { className: "flex items-center gap-2 min-w-0", children: [
          iconElement,
          /* @__PURE__ */ jsx21("span", { className: "text-sm font-medium truncate", children: name }),
          meta
        ] }),
        actions && /* @__PURE__ */ jsx21("div", { className: "flex items-center gap-1 shrink-0", children: actions })
      ]
    }
  );
}

// src/components/line-items-table.tsx
import { jsx as jsx22, jsxs as jsxs8 } from "react/jsx-runtime";
function LineItemsTable({
  title,
  headers,
  colTemplate,
  footer,
  children,
  action
}) {
  return /* @__PURE__ */ jsxs8("div", { className: "border rounded-md overflow-hidden", children: [
    (title || action) && /* @__PURE__ */ jsxs8("div", { className: "px-3 py-2 flex items-center justify-between bg-muted/40", children: [
      title && /* @__PURE__ */ jsx22("span", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: title }),
      action && /* @__PURE__ */ jsx22("span", { children: action })
    ] }),
    /* @__PURE__ */ jsxs8("div", { className: "divide-y text-sm", children: [
      /* @__PURE__ */ jsx22("div", { className: cn("grid px-3 py-2 text-xs font-medium text-muted-foreground", colTemplate), children: headers.map((h, i) => /* @__PURE__ */ jsx22("span", { children: h }, i)) }),
      children,
      footer
    ] })
  ] });
}
function LineItemsTableRow({ colTemplate, children, className }) {
  return /* @__PURE__ */ jsx22("div", { className: cn("grid px-3 py-2 text-xs", colTemplate, className), children });
}

// src/components/forms/text-input.tsx
import {
  useController
} from "react-hook-form";
import { jsx as jsx23, jsxs as jsxs9 } from "react/jsx-runtime";
var TextInput = ({
  control,
  name,
  label,
  placeholder,
  rules,
  readOnly = false
}) => {
  const {
    field,
    fieldState: { error }
  } = useController({
    control,
    name,
    rules,
    defaultValue: ""
  });
  return /* @__PURE__ */ jsxs9(FormItem, { children: [
    /* @__PURE__ */ jsx23(FormLabel, { children: label }),
    /* @__PURE__ */ jsx23(FormControl, { children: /* @__PURE__ */ jsx23(Input, { ...field, placeholder, readOnly }) }),
    error && /* @__PURE__ */ jsx23(FormMessage, { children: error.message })
  ] });
};
var text_input_default = TextInput;

// src/components/forms/date-input.tsx
import { useController as useController2 } from "react-hook-form";
import { format as format2 } from "date-fns";
import { jsx as jsx24, jsxs as jsxs10 } from "react/jsx-runtime";
var DateInput = ({
  control,
  name,
  label
}) => {
  const {
    field,
    fieldState: { error }
  } = useController2({ name, control });
  const handleDateChange = (date) => {
    const formattedDate = date ? format2(date, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") : null;
    field.onChange(formattedDate);
  };
  return /* @__PURE__ */ jsxs10(FormItem, { children: [
    /* @__PURE__ */ jsx24(FormLabel, { children: label }),
    /* @__PURE__ */ jsx24(FormControl, { children: /* @__PURE__ */ jsx24(
      DatePicker,
      {
        selected: field.value ? new Date(field.value) : void 0,
        onSelect: handleDateChange
      }
    ) }),
    error && /* @__PURE__ */ jsx24(FormMessage, { children: error.message })
  ] });
};
var date_input_default = DateInput;

// src/components/forms/money-input.tsx
import { useEffect as useEffect2, useState as useState2 } from "react";
import { useController as useController3 } from "react-hook-form";
import { jsx as jsx25, jsxs as jsxs11 } from "react/jsx-runtime";
var formatCurrency = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
var unformatCurrency = (value) => {
  if (typeof value === "number") {
    return value.toString().replace(/[^\d,-]/g, "").replace(",", ".");
  }
  if (typeof value === "string") {
    return value.replace(/[^\d,-]/g, "").replace(",", ".");
  }
  return "";
};
var MoneyInput = ({
  control,
  name,
  label
}) => {
  const {
    field,
    fieldState: { error }
  } = useController3({
    name,
    control,
    rules: {
      validate: (value) => parseFloat(value) > 0 || "O valor deve ser maior que zero"
    }
  });
  const [displayValue, setDisplayValue] = useState2("");
  const [isFocused, setIsFocused] = useState2(false);
  useEffect2(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrency(parseFloat(field.value) || 0));
    }
  }, [field.value, isFocused]);
  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(field.value);
  };
  const handleBlur = () => {
    setIsFocused(false);
    field.onChange(parseFloat(unformatCurrency(displayValue)));
  };
  const handleChange = (e) => {
    setDisplayValue(e.target.value);
  };
  return /* @__PURE__ */ jsxs11(FormItem, { children: [
    /* @__PURE__ */ jsx25(FormLabel, { children: label }),
    /* @__PURE__ */ jsx25(FormControl, { children: /* @__PURE__ */ jsx25(
      Input,
      {
        type: "text",
        ...field,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onChange: handleChange,
        value: displayValue || ""
      }
    ) }),
    error && /* @__PURE__ */ jsx25(FormMessage, { children: error.message })
  ] });
};
var money_input_default = MoneyInput;

// src/components/forms/select-input.tsx
import { useController as useController4 } from "react-hook-form";
import { jsx as jsx26, jsxs as jsxs12 } from "react/jsx-runtime";
var SelectInput = ({
  control,
  name,
  label,
  options
}) => {
  const {
    field,
    fieldState: { error }
  } = useController4({ name, control });
  return /* @__PURE__ */ jsxs12(FormItem, { children: [
    /* @__PURE__ */ jsx26(FormLabel, { children: label }),
    /* @__PURE__ */ jsx26(FormControl, { children: /* @__PURE__ */ jsxs12(Select, { onValueChange: field.onChange, value: field.value, children: [
      /* @__PURE__ */ jsx26(SelectTrigger, { children: /* @__PURE__ */ jsx26(SelectValue, { placeholder: "Selecione uma op\xE7\xE3o" }) }),
      /* @__PURE__ */ jsx26(SelectContent, { children: options.map((option) => /* @__PURE__ */ jsx26(SelectItem, { value: option.value, children: option.label }, option.value)) })
    ] }) }),
    error && /* @__PURE__ */ jsx26(FormMessage, { children: error.message })
  ] });
};
var select_input_default = SelectInput;

// src/components/forms/text-area-input.tsx
import {
  useController as useController5
} from "react-hook-form";
import { jsx as jsx27, jsxs as jsxs13 } from "react/jsx-runtime";
var TextAreaInput = ({
  control,
  name,
  label,
  placeholder,
  rules
}) => {
  const {
    field,
    fieldState: { error }
  } = useController5({
    control,
    name,
    rules,
    defaultValue: ""
  });
  return /* @__PURE__ */ jsxs13(FormItem, { children: [
    /* @__PURE__ */ jsx27(FormLabel, { children: label }),
    /* @__PURE__ */ jsx27(FormControl, { children: /* @__PURE__ */ jsx27(Textarea, { ...field, placeholder }) }),
    error && /* @__PURE__ */ jsx27(FormMessage, { children: error.message })
  ] });
};
var text_area_input_default = TextAreaInput;
export {
  AuthProvider,
  Button,
  Calendar,
  CardSection,
  date_input_default as DateInput,
  DatePicker,
  EmptyState,
  error_component_default as ErrorComponent,
  FileListItem,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormGrid,
  FormItem,
  FormLabel,
  FormMessage,
  FormSection,
  Input,
  Label,
  LineItemsTable,
  LineItemsTableRow,
  loader_component_default as LoaderComponent,
  LoadingState,
  money_input_default as MoneyInput,
  PageTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  protected_component_default as ProtectedComponent,
  REFRESH_THRESHOLD_MS,
  Roles,
  SESSION_DURATION_MS,
  SectionHeader,
  Select,
  SelectContent,
  SelectGroup,
  select_input_default as SelectInput,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  text_area_input_default as TextAreaInput,
  text_input_default as TextInput,
  Textarea,
  buttonVariants,
  cn,
  createApiClient,
  createSessionManager,
  formatPhoneNumber,
  normalizePhoneForBackend,
  useAuth,
  useAuthorization,
  useFormField
};
//# sourceMappingURL=index.mjs.map