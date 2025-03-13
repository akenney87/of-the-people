import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="md:hidden"> {/* Only show on mobile */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-white p-2"
      >
        {isOpen ? 'Close' : 'Menu'}
      </button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-white"
          >
            Close
          </button>
          
          <nav className="flex flex-col items-center space-y-6">
            <Link 
              to="/" 
              className="text-white text-xl"
              onClick={() => setIsOpen(false)}
            >
              Home
            </Link>
            <Link 
              to="/about" 
              className="text-white text-xl"
              onClick={() => setIsOpen(false)}
            >
              About
            </Link>
            <Link 
              to="/representatives" 
              className="text-white text-xl"
              onClick={() => setIsOpen(false)}
            >
              Representatives
            </Link>
            <Link 
              to="/profile" 
              className="text-white text-xl"
              onClick={() => setIsOpen(false)}
            >
              Profile
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
} 