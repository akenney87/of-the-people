// File: src/components/Navbar.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/login");
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isMenuOpen && 
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-white text-xl font-bold">
              Of the People
            </Link>
          </div>
          
          {/* Hamburger menu button */}
          <div className="flex items-center">
            <button 
              ref={buttonRef}
              onClick={toggleMenu}
              className="p-2 rounded-md focus:outline-none"
              aria-expanded={isMenuOpen}
              aria-label="Toggle menu"
            >
              <svg 
                className="h-6 w-6 text-white" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Dropdown menu */}
      {isMenuOpen && (
        <div 
          ref={menuRef}
          className="absolute right-0 mt-0 w-48 bg-black border border-gray-700 rounded-b-md shadow-lg py-1 z-50"
          style={{ top: '64px' }}
        >
          <Link 
            to="/profile" 
            className="block px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => setIsMenuOpen(false)}
          >
            Profile
          </Link>
          <Link 
            to="/dashboard" 
            className="block px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => setIsMenuOpen(false)}
          >
            Issue Feed
          </Link>
          <Link 
            to="/representatives" 
            className="block px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => setIsMenuOpen(false)}
          >
            Representatives
          </Link>
          <Link 
            to="/votes" 
            className="block px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => setIsMenuOpen(false)}
          >
            My Votes
          </Link>
          <Link 
            to="/about" 
            className="block px-4 py-2 text-white hover:bg-gray-800"
            onClick={() => setIsMenuOpen(false)}
          >
            About
          </Link>
          <div className="border-t border-gray-700 my-1"></div>
          <button
            onClick={() => {
              handleLogout();
              setIsMenuOpen(false);
            }}
            className="block w-full text-left px-4 py-2 text-white hover:bg-gray-800"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}