/**
 * PreAuthLayoutAdapter.tsx
 * Prana-specific adapter for Astra EntryLayoutFrame.
 *
 * This adapter injects Prana's branding and applies Prana-specific styling.
 * The underlying frame is now sourced from Astra.
 */

import { FC, ReactNode } from 'react';
import { EntryLayoutFrame } from 'astra/components';

interface PreAuthLayoutProps {
  children: ReactNode;
}

/**
 * PreAuthLayout (Prana): Pre-authentication layout with DHI branding.
 * Uses Astra EntryLayoutFrame with Prana's app title.
 */
export const PreAuthLayout: FC<PreAuthLayoutProps> = ({ children }) => {
  return (
    <EntryLayoutFrame titleText="DHI — COGNITIVE MANAGEMENT SYSTEM">
      {children}
    </EntryLayoutFrame>
  );
};
