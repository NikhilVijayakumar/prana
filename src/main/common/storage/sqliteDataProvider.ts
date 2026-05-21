import { registryRuntimeStoreService } from '../../features/registry/registryRuntimeStoreService';
import { runtimeModelAccessService } from '../../features/intelligence/runtimeModelAccessService';
import { sqliteConfigStoreService } from './sqliteConfigStoreService';

export const sqliteDataProvider = {

  async getLocalRuntimeConfig() {
    return sqliteConfigStoreService.getRuntimeConfigSnapshot();
  },

  async getApprovedRuntimeState() {
    return registryRuntimeStoreService.getApprovedRuntimeState();
  },

  async getRuntimeChannelDetails() {
    return registryRuntimeStoreService.getRuntimeChannelDetails();
  },

  async getRuntimeModelAccess() {
    return registryRuntimeStoreService.getRuntimeModelAccess();
  },

  async getResolvedRuntimeModelAccess() {
    return runtimeModelAccessService.getApprovedRuntimeModelAccess();
  },
};
