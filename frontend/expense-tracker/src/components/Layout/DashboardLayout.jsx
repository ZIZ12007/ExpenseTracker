import React, { useContext, useEffect, useState } from 'react'
import Navbar from './Navbar'
import SideMenu from './SideMenu'
import Onboarding from '../Onboarding'
import { UserContext } from '../../context/UserContextDefinition'
import axiosInstance from '../../utils/axiosInstance'
import { API_PATHS } from '../../utils/apiPaths'

const DashboardLayout = ({ children, activeMenu }) => {
  const { user, updateUser } = useContext(UserContext);
  const [showTour, setShowTour] = useState(false);

  // The tour is shown once, to people who have not been through it.
  useEffect(() => {
    if (!user) return;
    if (user.onboarded) return;
    if (sessionStorage.getItem('expensetracker:tour-seen')) return;
    const timer = setTimeout(() => setShowTour(true), 700);
    return () => clearTimeout(timer);
  }, [user]);

  const finishTour = () => {
    sessionStorage.setItem('expensetracker:tour-seen', '1');
    setShowTour(false);
    if (user && !user.onboarded) {
      axiosInstance.patch(API_PATHS.USER.PROFILE, { onboarded: true })
        .then((response) => updateUser(response.data.user))
        .catch(() => { /* the tour is still remembered for this session */ });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar activeMenu={activeMenu} />
      <div className='flex'>
        <div className="max-[1080px]:hidden">
          <SideMenu activeMenu={activeMenu} />
        </div>

        <div className='grow mx-5 py-5'>
          {children}
        </div>
      </div>

      {showTour && <Onboarding onComplete={finishTour} onSkip={finishTour} />}
    </div>
  )
}

export default DashboardLayout
