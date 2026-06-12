interface IIconType {
  width?: number
  height?: number
  color?: string
}

const HamburgerMenu = ({ width = 32, height = 32, color = 'currentColor' }: IIconType) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Open menu"
    >
      <title>hamburger menu</title>
      <path
        d="M3 12H21M3 6H21M3 18H21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default HamburgerMenu
