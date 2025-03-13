import PropTypes from 'prop-types';

export default function ResponsiveContainer({ children }) {
  return (
    <div className="w-full px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
      {children}
    </div>
  );
}

ResponsiveContainer.propTypes = {
  children: PropTypes.node.isRequired
}; 