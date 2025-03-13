// File: src/components/Layout.jsx
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar"; // Import your Navbar component

const Layout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Navbar />
      <div className="flex-1 overflow-auto h-[calc(100vh-64px)]"> {/* 64px is navbar height, adjust if different */}
        <div className="container mx-auto px-4 py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
