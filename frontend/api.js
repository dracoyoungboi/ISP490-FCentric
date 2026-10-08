import axios from "axios";
import { API_BASE_URL } from "./src/config/apiBase";

const api = axios.create({
  baseURL: API_BASE_URL, // localhost khi dev, cùng tên miền khi deploy
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor (gắn token)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (handle error chung)
api.interceptors.response.use(
  (response) => response.data, // chỉ trả data cho gọn
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      "Có lỗi xảy ra";

    return Promise.reject(message);
  }
);

export default api;
