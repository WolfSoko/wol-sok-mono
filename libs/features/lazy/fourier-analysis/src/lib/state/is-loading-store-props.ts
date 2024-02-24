import { propsFactory } from '@ngneat/elf';

export const {
  withLoading,
  updateLoading,
  selectLoading,
  resetLoading,
  getLoading,
  setLoading,
  setLoadingInitialValue,
} = propsFactory('loading', {
  initialValue: false,
});
