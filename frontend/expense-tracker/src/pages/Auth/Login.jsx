import React, { useState, useContext, useEffect } from 'react';
import AuthLayout from '../../components/Layout/AuthLayout';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/Inputs/input';
import { Link } from 'react-router-dom';
import { validateEmail } from '../../utils/helper';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import { UserContext } from '../../context/UserContextDefinition';

const Login = () => {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const { updateUser } = useContext(UserContext)

  const navigate = useNavigate();

  // Only offer Google sign in when the server has it configured.
  useEffect(() => {
    axiosInstance.get(API_PATHS.AUTH.GOOGLE_STATUS)
      .then((response) => setGoogleEnabled(Boolean(response.data?.enabled)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  const signInWithGoogle = () => {
    window.location.href = `${API_PATHS.AUTH.GOOGLE}?redirectTo=${encodeURIComponent('/dashboard')}`;
  };

  // Handle Login Form Submit
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }

    setError("");

    // Login API Call
    try {
      setIsSubmitting(true)
      const response = await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email: email.trim(),
        password,
      });
      const { token, refreshToken, user } = response.data;

      if (token) {
        localStorage.setItem("token", token);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
        updateUser(user)
        navigate("/dashboard")
      }
    } catch (error) {
      if (error.response && error.response.data.message) {
        setError(error.response.data.message);
      }
      else if (error.code === "ECONNABORTED") {
        setError("The server took too long to respond. Check that MongoDB is connected, then try again.")
      }
      else {
        setError("Something went wrong. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="lg:w-[70%] h-3/4 md:h-full flex flex-col justify-center">
        <h3 className='text-xl font-semibold text-black'>Welcome Back!</h3>
        <p className='text-xs text-slate-700 mt-[5px] mb-6'>
          Please enter your details to log in to your account. If you don't have an account, you can sign up for free.
        </p>

        <form onSubmit={handleLogin}>
          <Input
            value={email}
            onChange={({ target }) => setEmail(target.value)}
            label="Email Address"
            placeholder="Enter your email"
            type="email"
          />

          <Input
            value={password}
            onChange={({ target }) => setPassword(target.value)}
            label="Password"
            placeholder="Minimum 8 characters"
            type="password"
          />

          {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-primary disabled:cursor-wait disabled:opacity-60">
            {isSubmitting ? "LOGGING IN…" : "LOGIN"}
          </button>

          <p className="text-[13px] text-slate-800 mt-3">
            <Link className="font-medium text-purple-600 underline" to="/forgot-password">
              Forgot your password?
            </Link>
          </p>

          {googleEnabled && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs uppercase tracking-wider text-slate-400">or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
                  <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.4 14.3a7.1 7.1 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
                </svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="text-[13px] text-slate-800 mt-3">
            Don't Have An Account?{" "}
            <Link className="font-medium text-purple-600 underline" to="/signup">
              Sign Up
            </Link>
          </p>
        </form>

      </div>
    </AuthLayout>
  )
}

export default Login;