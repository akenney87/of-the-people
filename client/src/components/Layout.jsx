// File: src/components/Layout.jsx
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

const Layout = () => {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="pt-20 md:pt-28 px-6 md:px-12 pb-24">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
