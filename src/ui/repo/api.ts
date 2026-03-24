import { ApiService } from 'astra';

// You would typically get this from your env vars
const API_BASE_URL = 'http://localhost:8080';

// Initialize with localization keys that match our i18n map
export const api = new ApiService(API_BASE_URL, {
  success_message: 'status.success',
  created_message: 'status.success',
  bad_request_message: 'error.network',
  unauthorized_message: 'error.401',
  not_found_message: 'error.404',
  internal_server_error: 'error.500',
  internet_error: 'error.network',
  idle_message: 'status.idle',
  unknown_message: 'error.500',
});
