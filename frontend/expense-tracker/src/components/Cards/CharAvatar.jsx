import React from 'react'

const getInitials = (fullName) => {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

const CharAvatar = ({ fullName, width, height, style }) => {
  return (
    <div
      className={`${width || 'w-12'} ${height || 'h-12'} ${style || ''} flex items-center justify-center rounded-full text-gray-900 font-medium bg-gray-100`}
    >
      {getInitials(fullName || '')}
    </div>
  )
}

export default CharAvatar