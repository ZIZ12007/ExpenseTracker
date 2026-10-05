import React from 'react';
import CARD_1 from '@/assets/images/card1.png';
import { LuTrendingUpDown } from 'react-icons/lu';

const AuthLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen w-full">
      
      {/* 🔥 FIXED BACKGROUND (RIGHT SIDE ONLY) */}
      <div className="hidden md:block fixed right-0 top-0 w-[40vw] h-screen -z-10 
                      bg-auth-bg-img bg-cover bg-center bg-no-repeat" />

      {/* LEFT */}
      <div className="w-full md:w-[60vw] px-12 pt-8 pb-12 flex flex-col justify-center">
        <h2 className="text-lg font-medium text-black">
          Expense Tracker
        </h2>
        {children}
      </div>

      {/* RIGHT CONTENT (on top of fixed bg) */}
      <div className="hidden md:flex w-[40vw] min-h-screen p-8 relative flex-col justify-between">

        {/* Decorative Shapes */}
        <div className="w-48 h-48 rounded-[40px] bg-purple-600 absolute -top-7 -left-5" />
        <div className="w-48 h-56 rounded-[40px] border-[20px] border-fuchsia-600 absolute top-[30%] right-[100px]" />
        <div className="w-48 h-48 rounded-[40px] bg-violet-500 absolute -bottom-7 -left-5" />

        {/* Card */}
        <div className="z-20 mt-10">
          <StatsInfoCard
            icon={<LuTrendingUpDown />}
            label="Track Your Income & Expenses"
            value="430,000"
            color="bg-purple-600"
          />
        </div>

        {/* Image */}
        <img
          src={CARD_1}
          alt="Card 1"
          className="w-64 lg:w-[90%] mx-auto shadow-lg shadow-blue-400/15 z-10"
        />
      </div>
    </div>
  );
};

export default AuthLayout;

const StatsInfoCard = ({ icon, label, value, color }) => {
  return (
    <div className="flex gap-6 bg-white p-4 rounded-xl shadow-md shadow-purple-400/10 border border-gray-200/50 z-10">
      <div className={`w-12 h-12 flex items-center justify-center text-xl text-white ${color} rounded-full drop-shadow-xl`}>
        {icon}
      </div>
      <div>
        <h6 className="text-xs text-gray-500 mb-1">{label}</h6>
        <span className="text-[20px]">${value}</span>
      </div>
    </div>
  );
};