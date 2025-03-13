import PropTypes from 'prop-types';

export default function TouchButton({ children, onClick, variant = 'primary', disabled = false }) {
  const baseClasses = "py-3 px-6 rounded-lg text-lg font-medium focus:outline-none transition-colors duration-200 touch-manipulation";
  
  const variantClasses = {
    primary: "bg-primary text-black hover:bg-primary-hover disabled:bg-gray-500",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
    danger: "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300"
  };
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
}

TouchButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  disabled: PropTypes.bool
}; 