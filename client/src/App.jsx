// File: src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Representatives from "./pages/Representatives";
import RepresentativeDetails from "./pages/RepresentativeDetails";
import VerifyEmail from "./pages/VerifyEmail";
import About from "./pages/About"; // Import About
import Navbar from "./components/Navbar";
import { NetworkProvider, useNetwork } from './contexts/NetworkContext';
import Offline from './pages/Offline';
import MyVotes from './pages/MyVotes'; // Import the MyVotes component

console.log("Access Token in App:", localStorage.getItem("accessToken"));

function App() {
  const { isOnline } = useNetwork();
  
  // Show offline page when not online
  if (!isOnline) {
    return <Offline />;
  }
  
  return (
    <NetworkProvider>
      <Router basename="/">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="verify/:token" element={<VerifyEmail />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password/:token" element={<ResetPassword />} />
            <Route path="profile" element={<Profile />} />
            <Route path="/representatives" element={<Representatives />} />
            <Route path="representatives/:id" element={<RepresentativeDetails />} />
            <Route path="about" element={<About />} /> {/* Add About route */}
            <Route path="votes" element={<MyVotes />} /> {/* Add this route */}
            <Route element={<ProtectedRoute />}>
              <Route path="dashboard" element={<Dashboard />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </NetworkProvider>
  );
}

export default App;