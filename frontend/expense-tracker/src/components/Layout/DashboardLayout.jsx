import React from 'react'
import Navbar from './Navbar'
import SideMenu from './SideMenu'

const DashboardLayout = ({ children, activeMenu }) => {
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
    </div>
  )
}

export default DashboardLayout