import React, { useState, useContext } from 'react';
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

  const { updateUser } = useContext(UserContext)

  const navigate = useNavigate();

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
      const { token, user } = response.data;

      if (token) {
        localStorage.setItem("token", token);
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