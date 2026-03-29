import { getPranaBranding } from './pranaConfig';

export const getAppBrandName = (): string => getPranaBranding().appBrandName ?? '';

export const getAppTitlebarTagline = (): string => getPranaBranding().appTitlebarTagline ?? '';

export const getAppSplashSubtitle = (): string => getPranaBranding().appSplashSubtitle ?? '';

export const getDirectorSenderEmail = (): string => getPranaBranding().directorSenderEmail ?? '';

export const getDirectorSenderName = (): string => getPranaBranding().directorSenderName ?? '';
