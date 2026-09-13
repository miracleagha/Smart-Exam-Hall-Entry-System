import axios from 'axios';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = 'https://smart-exam-hall-entry-system.onrender.com/api';

/**
 * Base URL of the backend server (without the /api suffix) — used for
 * turning stored file paths like `/uploads/passports/foo.png` into absolute
 * URLs that the browser can load directly.
 */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/**
 * Resolve a stored server path or an already-absolute URL into a fully
 * qualified URL. Returns null if `pathOrUrl` is falsy.
 */
export const resolveMediaUrl = (pathOrUrl) => {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('data:')) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${API_ORIGIN}${pathOrUrl}`;
  return `${API_ORIGIN}/${pathOrUrl}`;
};

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — inject JWT access token
apiClient.interceptors.request.use(
  (config) => {
    const session = JSON.parse(localStorage.getItem('student_session') || 'null');
    if (session && session.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 + auto refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet, try refreshing
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const session = JSON.parse(localStorage.getItem('student_session') || 'null');
        if (session?.refreshToken) {
          const refreshRes = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken: session.refreshToken,
          });

          if (refreshRes.data?.success && refreshRes.data?.data?.accessToken) {
            const newToken = refreshRes.data.data.accessToken;
            session.accessToken = newToken;
            localStorage.setItem('student_session', JSON.stringify(session));

            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed — clear session and redirect to login
        localStorage.removeItem('student_session');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Extract error message from API response
    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0]?.message ||
      error.response?.data?.errors?.[0]?.msg ||
      error.message ||
      'An error occurred';

    return Promise.reject(new Error(message));
  }
);

/**
 * Helper to unwrap the standard API response: { success, message, data }
 */
const unwrap = (res) => res.data?.data ?? res.data;

export const api = {
  auth: {
    login: async (username, password) => {
      const res = await apiClient.post('/auth/student/login', { username, password });
      const payload = res.data;

      if (!payload.success) {
        throw new Error(payload.message || 'Login failed');
      }

      // Store session
      const session = {
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
        student: payload.data.student,
        institution: payload.data.institution,
      };
      localStorage.setItem('student_session', JSON.stringify(session));

      return session;
    },

    forgotPassword: async (email) => {
      const res = await apiClient.post('/auth/forgot-password', {
        email,
        userType: 'student',
      });
      return unwrap(res);
    },

    resetPassword: async (token, password) => {
      const res = await apiClient.post('/auth/reset-password', {
        token,
        password,
        userType: 'student',
      });
      return unwrap(res);
    },

    logout: async () => {
      try {
        await apiClient.post('/auth/student/logout');
      } catch (e) {
        // Logout may fail if token expired, that's fine
      }
      localStorage.removeItem('student_session');
    },
  },

  dashboard: {
    get: async () => {
      const res = await apiClient.get('/dashboard/student');
      return unwrap(res);
    },
  },

  exams: {
    active: async () => {
      const res = await apiClient.get('/exams/student/active');
      return unwrap(res);
    },
    upcoming: async () => {
      const res = await apiClient.get('/exams/student/upcoming');
      return unwrap(res);
    },
    history: async () => {
      const res = await apiClient.get('/exams/student/history');
      return unwrap(res);
    },
    available: async () => {
      const res = await apiClient.get('/exams/student/available');
      return unwrap(res);
    },
    register: async (examId) => {
      const res = await apiClient.post(`/exams/student/${examId}/register`);
      return unwrap(res);
    },
    unregister: async (examId) => {
      const res = await apiClient.delete(`/exams/student/${examId}/register`);
      return unwrap(res);
    },
  },

  qrCodes: {
    /**
     * Fetch the student's identity QR — the backend auto-generates one on
     * first call and returns the existing active one on subsequent calls.
     */
    getMyQR: async () => {
      const res = await apiClient.get('/qrcodes/student/my-qr');
      return unwrap(res);
    },
    /**
     * Force a fresh QR (revokes the current active one).
     */
    regenerate: async () => {
      const res = await apiClient.post('/qrcodes/student/regenerate');
      return unwrap(res);
    },
  },

  attendance: {
    history: async (page = 1, limit = 20) => {
      const res = await apiClient.get(`/attendance/student/history?page=${page}&limit=${limit}`);
      return unwrap(res);
    },
  },

  profile: {
    get: async () => {
      const res = await apiClient.get('/students/me/profile');
      return unwrap(res);
    },
    update: async (data) => {
      const res = await apiClient.put('/students/me/profile', data);
      return unwrap(res);
    },
  },
};

export default api;
