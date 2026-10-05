import { useContext, useEffect } from "react";
import { UserContext } from '../context/UserContextDefinition';
import { useNavigate } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPaths";

export const useUserAuth = () => {
    const { user, updateUser, clearUser } = useContext(UserContext);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token || user) return;

        let isMounted = true; // Flag to track if the component is still mounted

        const fetchUserInfo = async () => {
            try {
                const response = await axiosInstance.get(API_PATHS.AUTH.GET_USER_INFO);

                if (isMounted && response.data) {
                    updateUser(response.data);
                }
            } catch (error) {
                console.error('Error fetching user info:', error);
                if (isMounted) {
                    clearUser();
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            }
        };

        fetchUserInfo();

        return () => {
            isMounted = false;
        };
    }, [token, user, updateUser, clearUser, navigate]);
};