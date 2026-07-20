"use client";
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuthProvider: () => AuthProvider,
  Button: () => Button,
  Calendar: () => Calendar,
  CardSection: () => CardSection,
  DateInput: () => date_input_default,
  DatePicker: () => DatePicker,
  EmptyState: () => EmptyState,
  ErrorComponent: () => error_component_default,
  FileListItem: () => FileListItem,
  Form: () => Form,
  FormControl: () => FormControl,
  FormDescription: () => FormDescription,
  FormField: () => FormField,
  FormGrid: () => FormGrid,
  FormItem: () => FormItem,
  FormLabel: () => FormLabel,
  FormMessage: () => FormMessage,
  FormSection: () => FormSection,
  Input: () => Input,
  Label: () => Label,
  LineItemsTable: () => LineItemsTable,
  LineItemsTableRow: () => LineItemsTableRow,
  LoaderComponent: () => loader_component_default,
  LoadingState: () => LoadingState,
  MoneyInput: () => money_input_default,
  PageTitle: () => PageTitle,
  Popover: () => Popover,
  PopoverContent: () => PopoverContent,
  PopoverTrigger: () => PopoverTrigger,
  ProtectedComponent: () => protected_component_default,
  REFRESH_THRESHOLD_MS: () => REFRESH_THRESHOLD_MS,
  Roles: () => Roles,
  SESSION_DURATION_MS: () => SESSION_DURATION_MS,
  SectionHeader: () => SectionHeader,
  Select: () => Select,
  SelectContent: () => SelectContent,
  SelectGroup: () => SelectGroup,
  SelectInput: () => select_input_default,
  SelectItem: () => SelectItem,
  SelectLabel: () => SelectLabel,
  SelectSeparator: () => SelectSeparator,
  SelectTrigger: () => SelectTrigger,
  SelectValue: () => SelectValue,
  TextAreaInput: () => text_area_input_default,
  TextInput: () => text_input_default,
  Textarea: () => Textarea,
  buttonVariants: () => buttonVariants,
  cn: () => cn,
  createApiClient: () => createApiClient,
  createSessionManager: () => createSessionManager,
  formatPhoneNumber: () => formatPhoneNumber,
  normalizePhoneForBackend: () => normalizePhoneForBackend,
  useAuth: () => useAuth,
  useAuthorization: () => useAuthorization,
  useFormField: () => useFormField
});
module.exports = __toCommonJS(index_exports);

// src/lib/utils.ts
var import_clsx = require("clsx");
var import_tailwind_merge = require("tailwind-merge");
function cn(...inputs) {
  return (0, import_tailwind_merge.twMerge)((0, import_clsx.clsx)(inputs));
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
var import_axios = __toESM(require("axios"));
var import_react_toastify = require("react-toastify");
function createApiClient(baseURL, session) {
  const api = import_axios.default.create({ baseURL });
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
          const response = await import_axios.default.post(`${baseURL}/refresh-token`, {
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
            import_react_toastify.toast.error("Sua sess\xE3o expirou. Por favor, fa\xE7a login novamente.");
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
var import_react = require("react");
var import_navigation = require("next/navigation");
var import_jsx_runtime = require("react/jsx-runtime");
var AuthContext = (0, import_react.createContext)(void 0);
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
  const router = (0, import_navigation.useRouter)();
  const pathname = (0, import_navigation.usePathname)();
  const [session, setSession] = (0, import_react.useState)(null);
  const [isAuthenticated, setIsAuthenticated] = (0, import_react.useState)(false);
  const [roles, setRoles] = (0, import_react.useState)([]);
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  const refreshTimeout = (0, import_react.useRef)();
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
  (0, import_react.useEffect)(() => {
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
  (0, import_react.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    AuthContext.Provider,
    {
      value: { session, isAuthenticated, roles, login, logout, refreshSession },
      children
    }
  );
};
var useAuth = () => {
  const context = (0, import_react.useContext)(AuthContext);
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
var import_jsx_runtime2 = require("react/jsx-runtime");
var ProtectedComponent = ({
  requiredRoles,
  children
}) => {
  const isAuthorized = useAuthorization(requiredRoles);
  if (!isAuthorized) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children });
};
var protected_component_default = ProtectedComponent;

// src/components/ui/label.tsx
var React2 = __toESM(require("react"));
var LabelPrimitive = __toESM(require("@radix-ui/react-label"));
var import_class_variance_authority = require("class-variance-authority");
var import_jsx_runtime3 = require("react/jsx-runtime");
var labelVariants = (0, import_class_variance_authority.cva)(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);
var Label = React2.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
  LabelPrimitive.Root,
  {
    ref,
    className: cn(labelVariants(), className),
    ...props
  }
));
Label.displayName = LabelPrimitive.Root.displayName;

// src/components/ui/input.tsx
var React3 = __toESM(require("react"));
var import_jsx_runtime4 = require("react/jsx-runtime");
var Input = React3.forwardRef(
  ({ className, type, ...props }, ref) => {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
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
var React4 = __toESM(require("react"));
var import_jsx_runtime5 = require("react/jsx-runtime");
var Textarea = React4.forwardRef(
  ({ className, ...props }, ref) => {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
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
var React5 = __toESM(require("react"));
var import_react_slot = require("@radix-ui/react-slot");
var import_class_variance_authority2 = require("class-variance-authority");
var import_jsx_runtime6 = require("react/jsx-runtime");
var buttonVariants = (0, import_class_variance_authority2.cva)(
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
    const Comp = asChild ? import_react_slot.Slot : "button";
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
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
var import_lucide_react = require("lucide-react");
var import_react_day_picker = require("react-day-picker");
var import_jsx_runtime7 = require("react/jsx-runtime");
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    import_react_day_picker.DayPicker,
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
        IconLeft: () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.ChevronLeft, { className: "h-4 w-4" }),
        IconRight: () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_lucide_react.ChevronRight, { className: "h-4 w-4" })
      },
      ...props
    }
  );
}
Calendar.displayName = "Calendar";

// src/components/ui/popover.tsx
var React6 = __toESM(require("react"));
var PopoverPrimitive = __toESM(require("@radix-ui/react-popover"));
var import_jsx_runtime8 = require("react/jsx-runtime");
var Popover = PopoverPrimitive.Root;
var PopoverTrigger = PopoverPrimitive.Trigger;
var PopoverContent = React6.forwardRef(({ className, align = "center", sideOffset = 4, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(PopoverPrimitive.Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
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
var React7 = __toESM(require("react"));
var SelectPrimitive = __toESM(require("@radix-ui/react-select"));
var import_lucide_react2 = require("lucide-react");
var import_jsx_runtime9 = require("react/jsx-runtime");
var Select = SelectPrimitive.Root;
var SelectGroup = SelectPrimitive.Group;
var SelectValue = SelectPrimitive.Value;
var SelectTrigger = React7.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
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
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SelectPrimitive.Icon, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react2.ChevronDown, { className: "h-4 w-4 opacity-50" }) })
    ]
  }
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;
var SelectScrollUpButton = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
  SelectPrimitive.ScrollUpButton,
  {
    ref,
    className: cn("flex cursor-default items-center justify-center py-1", className),
    ...props,
    children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react2.ChevronUp, { className: "h-4 w-4" })
  }
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;
var SelectScrollDownButton = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
  SelectPrimitive.ScrollDownButton,
  {
    ref,
    className: cn("flex cursor-default items-center justify-center py-1", className),
    ...props,
    children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react2.ChevronDown, { className: "h-4 w-4" })
  }
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;
var SelectContent = React7.forwardRef(({ className, children, position = "popper", ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SelectPrimitive.Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
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
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SelectScrollUpButton, {}),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        SelectPrimitive.Viewport,
        {
          className: cn(
            "p-1",
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]"
          ),
          children
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SelectScrollDownButton, {})
    ]
  }
) }));
SelectContent.displayName = SelectPrimitive.Content.displayName;
var SelectLabel = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
  SelectPrimitive.Label,
  {
    ref,
    className: cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className),
    ...props
  }
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;
var SelectItem = React7.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
  SelectPrimitive.Item,
  {
    ref,
    className: cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    ),
    ...props,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SelectPrimitive.ItemIndicator, { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_lucide_react2.Check, { className: "h-4 w-4" }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(SelectPrimitive.ItemText, { children })
    ]
  }
));
SelectItem.displayName = SelectPrimitive.Item.displayName;
var SelectSeparator = React7.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
  SelectPrimitive.Separator,
  {
    ref,
    className: cn("-mx-1 my-1 h-px bg-muted", className),
    ...props
  }
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

// src/components/ui/form.tsx
var React8 = __toESM(require("react"));
var import_react_slot2 = require("@radix-ui/react-slot");
var import_react_hook_form = require("react-hook-form");
var import_jsx_runtime10 = require("react/jsx-runtime");
var Form = import_react_hook_form.FormProvider;
var FormFieldContext = React8.createContext(
  {}
);
var FormField = ({
  ...props
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FormFieldContext.Provider, { value: { name: props.name }, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_hook_form.Controller, { ...props }) });
};
var useFormField = () => {
  const fieldContext = React8.useContext(FormFieldContext);
  const itemContext = React8.useContext(FormItemContext);
  const { getFieldState, formState } = (0, import_react_hook_form.useFormContext)();
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(FormItemContext.Provider, { value: { id }, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { ref, className: cn("space-y-2", className), ...props }) });
});
FormItem.displayName = "FormItem";
var FormLabel = React8.forwardRef(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    import_react_slot2.Slot,
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
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
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
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
var import_date_fns = require("date-fns");
var import_lucide_react3 = require("lucide-react");
var import_locale = require("date-fns/locale");
var import_jsx_runtime11 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(Popover, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
      Button,
      {
        variant: "outline",
        className: cn(
          "w-[280px] justify-start text-left font-normal",
          !selected && "text-muted-foreground",
          className
        ),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_lucide_react3.Calendar, { className: "mr-2 h-4 w-4" }),
          selected ? (0, import_date_fns.format)(selected, "dd/MM/yy", { locale: import_locale.ptBR }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: placeholder })
        ]
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(PopoverContent, { className: "w-auto p-0", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
var import_react_spinners = require("react-spinners");
var import_jsx_runtime12 = require("react/jsx-runtime");
var LoaderComponent = ({ color = "#164bf9", size = 50 }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "flex justify-center items-center h-full", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_react_spinners.ClipLoader, { color, size }) });
};
var loader_component_default = LoaderComponent;

// src/components/error-component.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
var ErrorComponent = ({ message }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "flex flex-col items-center justify-center h-full text-center p-4", children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("h1", { className: "text-3xl font-semibold", style: { color: "#F97316" }, children: message ? "Erro" : "Aguarde o servidor inicializar" }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { className: "text-lg text-gray-700 mb-4", children: message || "Inicializando o servidor, recarregue em 30 segundos." }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("p", { className: "text-sm text-gray-500 mt-2", children: "Caso o problema persista, saia e entre novamente em sua conta." })
  ] });
};
var error_component_default = ErrorComponent;

// src/components/page-title.tsx
var import_jsx_runtime14 = require("react/jsx-runtime");
function PageTitle({ title, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("h1", { className: cn("text-2xl font-semibold", className), children: title });
}

// src/components/empty-state.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
function EmptyState({ message, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
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
var import_lucide_react4 = require("lucide-react");
var import_jsx_runtime16 = require("react/jsx-runtime");
function LoadingState({
  message = "Carregando...",
  spinner = false,
  className
}) {
  if (spinner) {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: cn("flex items-center gap-2 text-sm text-muted-foreground py-3", className), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react4.Loader2, { className: "w-4 h-4 animate-spin" }),
      message
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: cn("text-sm text-muted-foreground py-6 text-center", className), children: message });
}

// src/components/section-header.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
function SectionHeader({ children, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
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
var import_jsx_runtime18 = require("react/jsx-runtime");
function FormSection({ title, children, gap = 4, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("fieldset", { className: cn("flex flex-col", gap === 3 ? "gap-3" : "gap-4", className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("legend", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1", children: title }),
    children
  ] });
}

// src/components/form-grid.tsx
var import_jsx_runtime19 = require("react/jsx-runtime");
function FormGrid({ cols = 2, gap = 4, className, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
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
var import_jsx_runtime20 = require("react/jsx-runtime");
function CardSection({
  number,
  title,
  subtitle,
  children,
  innerClassName
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "rounded-xl border bg-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: "flex items-start gap-3 px-4 py-3 border-b bg-muted/40 rounded-t-xl", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground mt-0.5", children: number }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "text-sm font-semibold", children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: "text-xs text-muted-foreground leading-tight", children: subtitle })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: cn("p-4", innerClassName), children })
  ] });
}

// src/components/file-list-item.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
function FileListItem({
  iconElement,
  name,
  meta,
  actions,
  className
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
    "div",
    {
      className: cn(
        "flex items-center justify-between rounded-md border px-3 py-2.5 gap-3",
        className
      ),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "flex items-center gap-2 min-w-0", children: [
          iconElement,
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "text-sm font-medium truncate", children: name }),
          meta
        ] }),
        actions && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "flex items-center gap-1 shrink-0", children: actions })
      ]
    }
  );
}

// src/components/line-items-table.tsx
var import_jsx_runtime22 = require("react/jsx-runtime");
function LineItemsTable({
  title,
  headers,
  colTemplate,
  footer,
  children,
  action
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "border rounded-md overflow-hidden", children: [
    (title || action) && /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "px-3 py-2 flex items-center justify-between bg-muted/40", children: [
      title && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: title }),
      action && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { children: action })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: "divide-y text-sm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: cn("grid px-3 py-2 text-xs font-medium text-muted-foreground", colTemplate), children: headers.map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { children: h }, i)) }),
      children,
      footer
    ] })
  ] });
}
function LineItemsTableRow({ colTemplate, children, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: cn("grid px-3 py-2 text-xs", colTemplate, className), children });
}

// src/components/forms/text-input.tsx
var import_react_hook_form2 = require("react-hook-form");
var import_jsx_runtime23 = require("react/jsx-runtime");
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
  } = (0, import_react_hook_form2.useController)({
    control,
    name,
    rules,
    defaultValue: ""
  });
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(FormItem, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(FormLabel, { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(Input, { ...field, placeholder, readOnly }) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(FormMessage, { children: error.message })
  ] });
};
var text_input_default = TextInput;

// src/components/forms/date-input.tsx
var import_react_hook_form3 = require("react-hook-form");
var import_date_fns2 = require("date-fns");
var import_jsx_runtime24 = require("react/jsx-runtime");
var DateInput = ({
  control,
  name,
  label
}) => {
  const {
    field,
    fieldState: { error }
  } = (0, import_react_hook_form3.useController)({ name, control });
  const handleDateChange = (date) => {
    const formattedDate = date ? (0, import_date_fns2.format)(date, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'") : null;
    field.onChange(formattedDate);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(FormItem, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(FormLabel, { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      DatePicker,
      {
        selected: field.value ? new Date(field.value) : void 0,
        onSelect: handleDateChange
      }
    ) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(FormMessage, { children: error.message })
  ] });
};
var date_input_default = DateInput;

// src/components/forms/money-input.tsx
var import_react2 = require("react");
var import_react_hook_form4 = require("react-hook-form");
var import_jsx_runtime25 = require("react/jsx-runtime");
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
  } = (0, import_react_hook_form4.useController)({
    name,
    control,
    rules: {
      validate: (value) => parseFloat(value) > 0 || "O valor deve ser maior que zero"
    }
  });
  const [displayValue, setDisplayValue] = (0, import_react2.useState)("");
  const [isFocused, setIsFocused] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(FormItem, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(FormLabel, { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
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
    error && /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(FormMessage, { children: error.message })
  ] });
};
var money_input_default = MoneyInput;

// src/components/forms/select-input.tsx
var import_react_hook_form5 = require("react-hook-form");
var import_jsx_runtime26 = require("react/jsx-runtime");
var SelectInput = ({
  control,
  name,
  label,
  options
}) => {
  const {
    field,
    fieldState: { error }
  } = (0, import_react_hook_form5.useController)({ name, control });
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(FormItem, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(FormLabel, { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(Select, { onValueChange: field.onChange, value: field.value, children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(SelectTrigger, { children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(SelectValue, { placeholder: "Selecione uma op\xE7\xE3o" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(SelectContent, { children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(SelectItem, { value: option.value, children: option.label }, option.value)) })
    ] }) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(FormMessage, { children: error.message })
  ] });
};
var select_input_default = SelectInput;

// src/components/forms/text-area-input.tsx
var import_react_hook_form6 = require("react-hook-form");
var import_jsx_runtime27 = require("react/jsx-runtime");
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
  } = (0, import_react_hook_form6.useController)({
    control,
    name,
    rules,
    defaultValue: ""
  });
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(FormItem, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(FormLabel, { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(FormControl, { children: /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(Textarea, { ...field, placeholder }) }),
    error && /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(FormMessage, { children: error.message })
  ] });
};
var text_area_input_default = TextAreaInput;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuthProvider,
  Button,
  Calendar,
  CardSection,
  DateInput,
  DatePicker,
  EmptyState,
  ErrorComponent,
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
  LoaderComponent,
  LoadingState,
  MoneyInput,
  PageTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProtectedComponent,
  REFRESH_THRESHOLD_MS,
  Roles,
  SESSION_DURATION_MS,
  SectionHeader,
  Select,
  SelectContent,
  SelectGroup,
  SelectInput,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  TextAreaInput,
  TextInput,
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
});
//# sourceMappingURL=index.js.map