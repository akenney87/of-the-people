export default function Navigation() {
  // ... existing state and functions ...

  return (
    <nav className="bg-black text-white">
      {/* ... existing navigation code ... */}
      
      {/* Hamburger menu button */}
      <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden">
        {/* Hamburger icon */}
      </button>
      
      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden">
          <ul className="flex flex-col space-y-4 p-4">
            <li>
              <Link to="/" className="hover:text-blue-400">Home</Link>
            </li>
            <li>
              <Link to="/dashboard" className="hover:text-blue-400">Issue Feed</Link>
            </li>
            {/* Add the new "Issue Feed" link */}
            <li>
              <Link to="/my-votes" className="hover:text-blue-400">My Votes</Link>
            </li>
            <li>
              <Link to="/representatives" className="hover:text-blue-400">Representatives</Link>
            </li>
            {/* ... other menu items ... */}
          </ul>
        </div>
      )}
      
      {/* Desktop menu */}
      <div className="hidden md:block">
        <ul className="flex space-x-6">
          <li>
            <Link to="/" className="hover:text-blue-400">Home</Link>
          </li>
          <li>
            <Link to="/dashboard" className="hover:text-blue-400">Issue Feed</Link>
          </li>
          {/* Add the new "Issue Feed" link */}
          <li>
            <Link to="/my-votes" className="hover:text-blue-400">My Votes</Link>
          </li>
          <li>
            <Link to="/representatives" className="hover:text-blue-400">Representatives</Link>
          </li>
          {/* ... other menu items ... */}
        </ul>
      </div>
    </nav>
  );
} 