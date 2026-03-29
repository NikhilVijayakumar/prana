import { createElement, type FC } from 'react';
import { PranaFullPageError } from './PranaFullPageError';

export type PranaErrorRenderer = FC<{
  title?: string;
  errors: string[];
  onRetry?: () => void;
}>;

let activeRenderer: PranaErrorRenderer = (props) => createElement(PranaFullPageError, props);

export const setPranaErrorRenderer = (renderer: PranaErrorRenderer): void => {
  activeRenderer = renderer;
};

export const getPranaErrorRenderer = (): PranaErrorRenderer => {
  return activeRenderer;
};
