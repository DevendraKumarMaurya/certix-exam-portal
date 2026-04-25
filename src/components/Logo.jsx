import CertiXLogo from "/logo.png";

const Logo = ({ className = "", width = "150px", height = "auto" }) => {
  return (
    <img
      src={CertiXLogo}
      alt="Certix Logo"
      className={className}
      style={{ width, height }}
    />
  );
};

export default Logo;
