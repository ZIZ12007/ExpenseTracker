import React from 'react'

const InfoCard = ({ icon, label, value, color }) => {
  return (
    <div className={`rounded-3xl p-6 text-white ${color || 'bg-primary'}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="text-2xl">{icon}</div>
      </div>
      <p className="text-xs uppercase tracking-[0.28em] opacity-80">{label}</p>
      <h3 className="mt-4 text-3xl font-semibold">{value}</h3>
    </div>
  )
}

export default InfoCard