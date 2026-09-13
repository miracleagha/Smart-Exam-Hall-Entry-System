import axios from 'axios';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = 'https://smart-exam-hall-entry-system.onrender.com/api';

/**
 * Base URL of the backend (without /api) — used to build absolute URLs for
 * server-hosted media like passport photos or QR PNGs.
 */
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/**
 * Turn a stored path or absolute URL into a fully qualified URL the browser
 * can load. Returns null when input is falsy.
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
    const session = JSON.parse(localStorage.getItem('institution_session') || 'null');
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const session = JSON.parse(localStorage.getItem('institution_session') || 'null');
        if (session?.refreshToken) {
          const refreshRes = await axios.post(`${API_URL}/auth/refresh-token`, {
            refreshToken: session.refreshToken,
          });

          if (refreshRes.data?.success && refreshRes.data?.data?.accessToken) {
            session.accessToken = refreshRes.data.data.accessToken;
            localStorage.setItem('institution_session', JSON.stringify(session));
            originalRequest.headers.Authorization = `Bearer ${session.accessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        localStorage.removeItem('institution_session');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

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

/**
 * Convert a plain object into FormData. Fields whose values are File or Blob
 * are appended as-is; everything else is stringified only if it isn't
 * already a string. Nulls / undefineds are skipped.
 */
const toFormData = (obj) => {
  const fd = new FormData();
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File || value instanceof Blob) {
      fd.append(key, value);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      fd.append(key, String(value));
    } else if (value instanceof Date) {
      fd.append(key, value.toISOString());
    } else {
      fd.append(key, value);
    }
  });
  return fd;
};

export const api = {
  auth: {
    signup: async (data) => {
      const res = await apiClient.post('/auth/register', {
        institutionName: data.institutionName || data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phone: data.phone || '',
        address: data.address || '',
      });
      const payload = res.data;
      if (!payload.success) throw new Error(payload.message || 'Registration failed');

      const session = {
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
        user: payload.data.user,
        institution: payload.data.institution,
      };
      localStorage.setItem('institution_session', JSON.stringify(session));
      return session;
    },

    login: async (email, password) => {
      const res = await apiClient.post('/auth/login', { email, password });
      const payload = res.data;
      if (!payload.success) throw new Error(payload.message || 'Login failed');

      const session = {
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
        user: payload.data.user,
        institution: payload.data.institution,
      };
      localStorage.setItem('institution_session', JSON.stringify(session));
      return session;
    },

    forgotPassword: async (email) => {
      const res = await apiClient.post('/auth/forgot-password', {
        email,
        userType: 'user',
      });
      return unwrap(res);
    },

    resetPassword: async (token, password) => {
      const res = await apiClient.post('/auth/reset-password', {
        token,
        password,
        userType: 'user',
      });
      return unwrap(res);
    },

    logout: async () => {
      try {
        await apiClient.post('/auth/logout');
      } catch (e) {
        // Ignore — token may have expired
      }
      localStorage.removeItem('institution_session');
    },
  },

  institution: {
    getProfile: async () => {
      const res = await apiClient.get('/institutions/profile');
      return unwrap(res);
    },
    updateProfile: async (data) => {
      // Backend expects multipart (logo optional) but happily takes JSON too.
      const res = await apiClient.put('/institutions/profile', data);
      return unwrap(res);
    },
  },

  students: {
    list: async (params = {}) => {
      const res = await apiClient.get('/students', { params });
      return unwrap(res);
    },
    /**
     * Create a student. If `data.passportPhoto` is a File, we submit
     * multipart/form-data so the backend can persist the image.
     */
    create: async (data) => {
      const hasFile = data && data.passportPhoto instanceof File;
      if (hasFile) {
        const res = await apiClient.post('/students', toFormData(data), {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return unwrap(res);
      }
      // Strip empty/File-less passportPhoto so backend doesn't try to
      // interpret undefined as a value.
      const { passportPhoto: _drop, ...rest } = data || {};
      const res = await apiClient.post('/students', rest);
      return unwrap(res);
    },
    get: async (id) => {
      const res = await apiClient.get(`/students/${id}`);
      return unwrap(res);
    },
    update: async (id, data) => {
      const hasFile = data && data.passportPhoto instanceof File;
      if (hasFile) {
        const res = await apiClient.put(`/students/${id}`, toFormData(data), {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return unwrap(res);
      }
      const { passportPhoto: _drop, ...rest } = data || {};
      const res = await apiClient.put(`/students/${id}`, rest);
      return unwrap(res);
    },
    updatePhoto: async (id, file) => {
      const fd = new FormData();
      fd.append('passportPhoto', file);
      const res = await apiClient.put(`/students/${id}/passport`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return unwrap(res);
    },
    updateStatus: async (id, status) => {
      const res = await apiClient.patch(`/students/${id}/status`, { status });
      return unwrap(res);
    },
    getFilterOptions: async () => {
      const res = await apiClient.get('/students/filter-options');
      return unwrap(res);
    },
    bulkImport: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/students/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return unwrap(res);
    },
    export: async (format = 'csv') => {
      const res = await apiClient.get(`/students/export?format=${format}`, {
        responseType: 'blob',
      });
      return res.data;
    },
  },

  exams: {
    list: async (params = {}) => {
      const res = await apiClient.get('/exams', { params });
      return unwrap(res);
    },
    create: async (data) => {
      const res = await apiClient.post('/exams', data);
      return unwrap(res);
    },
    get: async (id) => {
      const res = await apiClient.get(`/exams/${id}`);
      return unwrap(res);
    },
    update: async (id, data) => {
      const res = await apiClient.put(`/exams/${id}`, data);
      return unwrap(res);
    },
    updateStatus: async (id, status) => {
      const res = await apiClient.patch(`/exams/${id}/status`, { status });
      return unwrap(res);
    },
    delete: async (id) => {
      const res = await apiClient.delete(`/exams/${id}`);
      return unwrap(res);
    },
  },

  qrCodes: {
    /**
     * Scan a student's identity QR. Optionally include an examId to also
     * record attendance for that exam.
     */
    scanStudent: async (encryptedPayload, examId = null) => {
      const body = { encryptedPayload };
      if (examId) body.examId = examId;
      const res = await apiClient.post('/qrcodes/scan-student', body);
      return unwrap(res);
    },
    listIdentityQRs: async () => {
      const res = await apiClient.get('/qrcodes/institution/identity');
      return unwrap(res);
    },
    get: async (id) => {
      const res = await apiClient.get(`/qrcodes/${id}`);
      return unwrap(res);
    },
  },

  attendance: {
    list: async (params = {}) => {
      const res = await apiClient.get('/attendance', { params });
      return unwrap(res);
    },
    byExam: async (examId) => {
      const res = await apiClient.get(`/attendance/exam/${examId}`);
      return unwrap(res);
    },
    examStats: async (examId) => {
      const res = await apiClient.get(`/attendance/exam/${examId}/stats`);
      return unwrap(res);
    },
    export: async (examId, format = 'csv') => {
      const res = await apiClient.get(`/attendance/export/${examId}?format=${format}`, {
        responseType: 'blob',
      });
      return res.data;
    },
  },

  dashboard: {
    get: async () => {
      const res = await apiClient.get('/dashboard/institution');
      return unwrap(res);
    },
    trends: async (params = {}) => {
      const res = await apiClient.get('/dashboard/trends', { params });
      return unwrap(res);
    },
  },

  auditLogs: {
    list: async (params = {}) => {
      const res = await apiClient.get('/audit-logs', { params });
      return unwrap(res);
    },
  },
};

export default api;
