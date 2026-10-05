import React, { useState, useContext } from 'react';
import AuthLayout from '../../components/Layout/AuthLayout';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/Inputs/input';
import ProfilePhotoSelector from '../../components/Inputs/ProfilePhotoSelector';
import { validateEmail } from '../../utils/helper';
import axiosInstance from '../../utils/axiosInstance';
import { API_PATHS } from '../../utils/apiPaths';
import uploadImage from '../../utils/uploadImage';
import { UserContext } from '../../context/UserContextDefinition';

const SignUp = () => {

  const [profilePicture, setProfilePicture] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {updateUser} = useContext(UserContext)

  const navigate = useNavigate();

  // Handle Sign Up Form Submit
  const handleSignUp = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must be at least 8 characters.");
      return;
    }

    setError("");

    // SignUp API Call
    try {
      setIsSubmitting(true)
      let profileImageUrl = "";

      // Upload image if present
      if (profilePicture) {
        const imgUploadRes = await uploadImage(profilePicture)
        profileImageUrl = imgUploadRes.imageUrl || ""
      }

      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER, {
        fullName,
        email: email.trim(),
        password,
        profileImageUrl,
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
      } else if (error.code === "ECONNABORTED") {
        setError("The server took too long to respond. Check that MongoDB is connected, then try again.")
      } else {
        setError("Something went wrong. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="lg:w-[100%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
        <h3 className='text-xl font-semibold text-black'>Create An Account</h3>
        <p className="text-xs text-slate-700 mt-[5px] mb-6">
          Join Us Today! Create an account to start tracking your expenses and managing your finances effectively.
        </p>

        <form onSubmit={handleSignUp}>

          <ProfilePhotoSelector image={profilePicture} setImage={setProfilePicture}/>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              value={fullName}
              onChange={({ target }) => setFullName(target.value)}
              label="Full Name"
              placeholder="Enter your full name"
              type="text"
            />

            <Input
              value={email}
              onChange={({ target }) => setEmail(target.value)}
              label="Email Address"
              placeholder="Enter your email"
              type="email"
            />
            <div className="col-span-2">
              <Input
                value={password}
                onChange={({ target }) => setPassword(target.value)}
                label="Password"
                placeholder="Minimum 8 characters"
                type="password"
              />  
            </div>
          
          </div>
          
          {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-primary disabled:cursor-wait disabled:opacity-60">
            {isSubmitting ? "CREATING ACCOUNT…" : "SIGN UP"}
          </button>

          <p className="text-[13px] text-slate-800 mt-3">
            Already Have An Account?{" "}
            <Link className="font-medium text-purple-600 underline" to="/login">
              Login
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  )
}

export default SignUp;