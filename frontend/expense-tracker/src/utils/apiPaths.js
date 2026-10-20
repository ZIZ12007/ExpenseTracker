export const BASE_URL = import.meta.env.VITE_API_URL || "";

//utils/apiPaths.js
export const API_PATHS = {
    AUTH: {
        LOGIN: "/api/v1/auth/login",
        REGISTER: "/api/v1/auth/register",
        REFRESH: "/api/v1/auth/refresh",
        GET_USER_INFO: "/api/v1/auth/me",
        VERIFY_EMAIL: "/api/v1/auth/verify-email",
        RESEND_VERIFICATION: "/api/v1/auth/resend-verification",
        FORGOT_PASSWORD: "/api/v1/auth/forgot-password",
        RESET_PASSWORD: "/api/v1/auth/reset-password",
        GOOGLE: "/api/v1/auth/google",
        GOOGLE_STATUS: "/api/v1/auth/google/status",
    },
    USER: {
        PROFILE: "/api/v1/user/profile",
        PASSWORD: "/api/v1/user/password",
    },
    BUDGET: {
        SUMMARY: "/api/v1/budget",
        RECOMMENDATIONS: "/api/v1/budget/recommendations",
        RECURRING: "/api/v1/budget/recurring",
        DELETE_RECURRING: (id) => `/api/v1/budget/recurring/${id}`,
        TIMETABLE: "/api/v1/budget/timetable",
        DELETE_TIMETABLE: (id) => `/api/v1/budget/timetable/${id}`,
    },
    DASHBOARD: {
        GET_DATA: "/api/v1/dashboard",
    },
    INCOME: {
        ADD_INCOME: "/api/v1/income/add",
        GET_ALL_INCOME: "/api/v1/income/get",
        DELETE_INCOME: (incomeId) => `/api/v1/income/${incomeId}`,
        DOWNLOAD_INCOME: `/api/v1/income/downloadExcel`,
    },
    EXPENSE: {
        ADD_EXPENSE: "/api/v1/expense/add",
        GET_ALL_EXPENSE: "/api/v1/expense/get",
        DELETE_EXPENSE: (expenseId) => `/api/v1/expense/${expenseId}`,
        DOWNLOAD_EXPENSE: `/api/v1/expense/downloadExcel`,
    },
    IMAGE: {
        UPLOAD_IMAGE: "/api/v1/auth/upload-image",
    },
}
