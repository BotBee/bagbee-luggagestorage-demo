import React from 'react'

interface IIconType {
  fill?: string
}
const Calendar = ({ fill = '#F3AD3C' }: IIconType) => {
  return (
    <svg
      width='64'
      height='64'
      viewBox='0 0 64 64'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle cx='32' cy='32' r='32' fill={fill} fillOpacity='0.2' />
      <path
        d='M43.25 29.5H20.75M43.25 32.625V28C43.25 25.8998 43.25 24.8497 42.8413 24.0475C42.4817 23.3419 41.9081 22.7683 41.2025 22.4087C40.4003 22 39.3502 22 37.25 22H26.75C24.6498 22 23.5997 22 22.7975 22.4087C22.0919 22.7683 21.5183 23.3419 21.1587 24.0475C20.75 24.8497 20.75 25.8998 20.75 28V38.5C20.75 40.6002 20.75 41.6503 21.1587 42.4525C21.5183 43.1581 22.0919 43.7318 22.7975 44.0913C23.5997 44.5 24.6498 44.5 26.75 44.5H32M37 19.5V24.5M27 19.5V24.5M35.125 40.75L37.625 43.25L43.25 37.625'
        stroke={fill}
        strokeWidth='2.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

export default Calendar
