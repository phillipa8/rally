// client.js — the single axios instance every API call goes through.
// Sends the session cookie (withCredentials) and surfaces 401s app-wide.
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

// On any 401, broadcast so AuthContext can clear the user (session expired/invalid).
// We do NOT hard-redirect here — ProtectedRoute decides routing — to avoid loops on public pages.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    // A 401 from a login/register attempt means "bad credentials", not "session expired".
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthAttempt) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Normalize an axios error to a human-readable message (used by the hooks).
export function errorMessage(error) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.issues?.[0]?.message ||
    error?.message ||
    'Something went wrong'
  );
}

export default apiClient;
