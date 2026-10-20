import axios from "axios";
import { BASE_URL } from "./apiPaths";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    // The food plan asks the AI for a suggestion, which can take a while on a
    // busy free tier, so this is generous. Individual calls can override it.
    timeout: 45000,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
})

// Request Interceptor
axiosInstance.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem("token");
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
)

// A single refresh attempt is shared by every request that gets a 401.
let refreshPromise = null;

const refreshSession = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;

    if (!refreshPromise) {
        refreshPromise = axios
            .post(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken }, {
                headers: { "Content-Type": "application/json" },
            })
            .then((response) => {
                const { token, refreshToken: nextRefreshToken } = response.data || {};
                if (token) {
                    localStorage.setItem("token", token);
                    if (nextRefreshToken) localStorage.setItem("refreshToken", nextRefreshToken);
                }
                return token || null;
            })
            .catch(() => {
                localStorage.removeItem("token");
                localStorage.removeItem("refreshToken");
                return null;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
};

// Response Interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        // Handle common errors globally
        if (error.response) {
            const { status, config } = error.response;

            if (status === 401) {
                // Try to exchange the refresh token before giving up, so an
                // expired access token does not interrupt the user.
                const isAuthCall = (config?.url || "").includes("/api/v1/auth/");
                if (!isAuthCall && !config?._retried) {
                    const token = await refreshSession();
                    if (token) {
                        config._retried = true;
                        config.headers = config.headers || {};
                        config.headers.Authorization = `Bearer ${token}`;
                        return axiosInstance(config);
                    }
                }
                // Redirect to login Page
                window.location.href = "/login";
            } else if (status === 429) {
                console.error("Too many requests. Please slow down.");
            } else if (status === 500) {
                console.error("Server error. Please try again later.");
            }
        } else if (error.code === "ECONNABORTED") {
            console.error("Request Timeout. Please try again.");
        }
        return Promise.reject(error);
    }
)

export default axiosInstance;
