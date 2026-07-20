import { ClassValue } from 'clsx';
import { AxiosInstance } from 'axios';
import * as React from 'react';
import React__default, { ReactNode } from 'react';
import * as class_variance_authority_types from 'class-variance-authority/types';
import * as LabelPrimitive from '@radix-ui/react-label';
import { VariantProps } from 'class-variance-authority';
import * as react_jsx_runtime from 'react/jsx-runtime';
import { DayPicker } from 'react-day-picker';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as _radix_ui_react_slot from '@radix-ui/react-slot';
import * as react_hook_form from 'react-hook-form';
import { FieldValues, FieldPath, ControllerProps, Control, Path } from 'react-hook-form';

interface UserSession {
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    user: {
        email: string;
        name: string;
        roles: string[];
    };
}

declare function cn(...inputs: ClassValue[]): string;
declare function formatPhoneNumber(phoneNumber?: string): string;
declare function normalizePhoneForBackend(phone: string): string;

declare const SESSION_DURATION_MS: number;
declare const REFRESH_THRESHOLD_MS: number;
interface SessionManager {
    SESSION_KEY: string;
    SESSION_DURATION_MS: number;
    REFRESH_THRESHOLD_MS: number;
    persistSession: (session: UserSession) => void;
    clearSession: () => void;
    readSession: () => UserSession | null;
}
declare function createSessionManager(sessionKey: string): SessionManager;

declare function createApiClient(baseURL: string, session: SessionManager): AxiosInstance;

declare enum Roles {
    Admin = "admin",
    Manager = "manager",
    User = "user"
}

interface AuthContextType {
    session: UserSession | null;
    isAuthenticated: boolean;
    roles: Roles[];
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}
interface AuthProviderProps {
    children: React__default.ReactNode;
    sessionManager: SessionManager;
    apiClient: AxiosInstance;
    publicRoutes?: string[];
    postLoginRedirect?: string;
    rolesClaimKey?: string;
}
declare const AuthProvider: React__default.FC<AuthProviderProps>;
declare const useAuth: () => AuthContextType;

declare const useAuthorization: (requiredRoles: Roles[]) => boolean;

interface ProtectedComponentProps {
    requiredRoles: Roles[];
    children: React__default.ReactNode;
}
declare const ProtectedComponent: React__default.FC<ProtectedComponentProps>;

declare const Label: React.ForwardRefExoticComponent<Omit<LabelPrimitive.LabelProps & React.RefAttributes<HTMLLabelElement>, "ref"> & VariantProps<(props?: class_variance_authority_types.ClassProp | undefined) => string> & React.RefAttributes<HTMLLabelElement>>;

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
}
declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
}
declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;

declare const buttonVariants: (props?: ({
    variant?: "link" | "default" | "destructive" | "outline" | "secondary" | "ghost" | null | undefined;
    size?: "default" | "sm" | "lg" | "icon" | null | undefined;
} & class_variance_authority_types.ClassProp) | undefined) => string;
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}
declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;

type CalendarProps = React.ComponentProps<typeof DayPicker>;
declare function Calendar({ className, classNames, showOutsideDays, ...props }: CalendarProps): react_jsx_runtime.JSX.Element;
declare namespace Calendar {
    var displayName: string;
}

declare const Popover: React.FC<PopoverPrimitive.PopoverProps>;
declare const PopoverTrigger: React.ForwardRefExoticComponent<PopoverPrimitive.PopoverTriggerProps & React.RefAttributes<HTMLButtonElement>>;
declare const PopoverContent: React.ForwardRefExoticComponent<Omit<PopoverPrimitive.PopoverContentProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;

declare const Select: React.FC<SelectPrimitive.SelectProps>;
declare const SelectGroup: React.ForwardRefExoticComponent<SelectPrimitive.SelectGroupProps & React.RefAttributes<HTMLDivElement>>;
declare const SelectValue: React.ForwardRefExoticComponent<SelectPrimitive.SelectValueProps & React.RefAttributes<HTMLSpanElement>>;
declare const SelectTrigger: React.ForwardRefExoticComponent<Omit<SelectPrimitive.SelectTriggerProps & React.RefAttributes<HTMLButtonElement>, "ref"> & React.RefAttributes<HTMLButtonElement>>;
declare const SelectContent: React.ForwardRefExoticComponent<Omit<SelectPrimitive.SelectContentProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;
declare const SelectLabel: React.ForwardRefExoticComponent<Omit<SelectPrimitive.SelectLabelProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;
declare const SelectItem: React.ForwardRefExoticComponent<Omit<SelectPrimitive.SelectItemProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;
declare const SelectSeparator: React.ForwardRefExoticComponent<Omit<SelectPrimitive.SelectSeparatorProps & React.RefAttributes<HTMLDivElement>, "ref"> & React.RefAttributes<HTMLDivElement>>;

declare const Form: <TFieldValues extends FieldValues, TContext = any, TTransformedValues = TFieldValues>(props: react_hook_form.FormProviderProps<TFieldValues, TContext, TTransformedValues>) => React.JSX.Element;
declare const FormField: <TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({ ...props }: ControllerProps<TFieldValues, TName>) => react_jsx_runtime.JSX.Element;
declare const useFormField: () => {
    invalid: boolean;
    isDirty: boolean;
    isTouched: boolean;
    isValidating: boolean;
    error?: react_hook_form.FieldError;
    id: string;
    name: string;
    formItemId: string;
    formDescriptionId: string;
    formMessageId: string;
};
declare const FormItem: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
declare const FormLabel: React.ForwardRefExoticComponent<Omit<LabelPrimitive.LabelProps & React.RefAttributes<HTMLLabelElement>, "ref"> & React.RefAttributes<HTMLLabelElement>>;
declare const FormControl: React.ForwardRefExoticComponent<Omit<_radix_ui_react_slot.SlotProps & React.RefAttributes<HTMLElement>, "ref"> & React.RefAttributes<HTMLElement>>;
declare const FormDescription: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>>;
declare const FormMessage: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>>;

interface DatePickerProps {
    selected: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    className?: string;
    placeholder?: string;
}
declare function DatePicker({ selected, onSelect, className, placeholder }: DatePickerProps): react_jsx_runtime.JSX.Element;

interface LoaderComponentProps {
    color?: string;
    size?: number;
}
declare const LoaderComponent: ({ color, size }: LoaderComponentProps) => react_jsx_runtime.JSX.Element;

interface ErrorComponentProps {
    message?: string;
}
declare const ErrorComponent: ({ message }: ErrorComponentProps) => react_jsx_runtime.JSX.Element;

interface PageTitleProps {
    title: string;
    className?: string;
}
declare function PageTitle({ title, className }: PageTitleProps): react_jsx_runtime.JSX.Element;

interface EmptyStateProps {
    message: string;
    className?: string;
}
declare function EmptyState({ message, className }: EmptyStateProps): react_jsx_runtime.JSX.Element;

interface LoadingStateProps {
    message?: string;
    spinner?: boolean;
    className?: string;
}
declare function LoadingState({ message, spinner, className, }: LoadingStateProps): react_jsx_runtime.JSX.Element;

interface SectionHeaderProps {
    children: ReactNode;
    className?: string;
}
declare function SectionHeader({ children, className }: SectionHeaderProps): react_jsx_runtime.JSX.Element;

interface FormSectionProps {
    title: string;
    children: ReactNode;
    gap?: 3 | 4;
    className?: string;
}
declare function FormSection({ title, children, gap, className }: FormSectionProps): react_jsx_runtime.JSX.Element;

interface FormGridProps {
    cols?: 2 | 3;
    gap?: 3 | 4;
    className?: string;
    children: ReactNode;
}
declare function FormGrid({ cols, gap, className, children }: FormGridProps): react_jsx_runtime.JSX.Element;

interface CardSectionProps {
    number: number;
    title: string;
    subtitle: string;
    children: ReactNode;
    innerClassName?: string;
}
declare function CardSection({ number, title, subtitle, children, innerClassName, }: CardSectionProps): react_jsx_runtime.JSX.Element;

interface FileListItemProps {
    iconElement: ReactNode;
    name: string;
    meta?: ReactNode;
    actions?: ReactNode;
    className?: string;
}
declare function FileListItem({ iconElement, name, meta, actions, className, }: FileListItemProps): react_jsx_runtime.JSX.Element;

interface LineItemsTableProps {
    title?: string;
    headers: string[];
    colTemplate: string;
    footer?: ReactNode;
    children: ReactNode;
    /** Optional action rendered inline with the title (e.g. an "Add" button) */
    action?: ReactNode;
}
declare function LineItemsTable({ title, headers, colTemplate, footer, children, action, }: LineItemsTableProps): react_jsx_runtime.JSX.Element;
interface LineItemsTableRowProps {
    colTemplate: string;
    children: ReactNode;
    className?: string;
}
declare function LineItemsTableRow({ colTemplate, children, className }: LineItemsTableRowProps): react_jsx_runtime.JSX.Element;

interface TextInputProps<TFieldValues extends FieldValues> {
    control: Control<TFieldValues>;
    name: Path<TFieldValues>;
    label: string;
    placeholder: string;
    rules?: any;
    readOnly?: boolean;
}
declare const TextInput: <TFieldValues extends FieldValues>({ control, name, label, placeholder, rules, readOnly, }: TextInputProps<TFieldValues>) => react_jsx_runtime.JSX.Element;

interface DateInputProps<TFieldValues extends FieldValues> {
    control: Control<TFieldValues>;
    name: Path<TFieldValues>;
    label: string;
}
declare const DateInput: <TFieldValues extends FieldValues>({ control, name, label, }: DateInputProps<TFieldValues>) => react_jsx_runtime.JSX.Element;

interface MoneyInputProps<TFieldValues extends FieldValues> {
    control: Control<TFieldValues>;
    name: Path<TFieldValues>;
    label: string;
}
declare const MoneyInput: <TFieldValues extends FieldValues>({ control, name, label, }: MoneyInputProps<TFieldValues>) => react_jsx_runtime.JSX.Element;

interface SelectInputProps<TFieldValues extends FieldValues> {
    control: Control<TFieldValues>;
    name: Path<TFieldValues>;
    label: string;
    options: {
        label: string;
        value: string;
    }[];
}
declare const SelectInput: <TFieldValues extends FieldValues>({ control, name, label, options, }: SelectInputProps<TFieldValues>) => react_jsx_runtime.JSX.Element;

interface TextAreaInputProps<TFieldValues extends FieldValues> {
    control: Control<TFieldValues>;
    name: Path<TFieldValues>;
    label: string;
    placeholder: string;
    rules?: any;
}
declare const TextAreaInput: <TFieldValues extends FieldValues>({ control, name, label, placeholder, rules, }: TextAreaInputProps<TFieldValues>) => react_jsx_runtime.JSX.Element;

export { AuthProvider, Button, Calendar, CardSection, DateInput, DatePicker, EmptyState, ErrorComponent, FileListItem, Form, FormControl, FormDescription, FormField, FormGrid, FormItem, FormLabel, FormMessage, FormSection, Input, Label, LineItemsTable, LineItemsTableRow, LoaderComponent, LoadingState, MoneyInput, PageTitle, Popover, PopoverContent, PopoverTrigger, ProtectedComponent, REFRESH_THRESHOLD_MS, Roles, SESSION_DURATION_MS, SectionHeader, Select, SelectContent, SelectGroup, SelectInput, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue, type SessionManager, TextAreaInput, TextInput, Textarea, type UserSession, buttonVariants, cn, createApiClient, createSessionManager, formatPhoneNumber, normalizePhoneForBackend, useAuth, useAuthorization, useFormField };
