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
import ClaimVerify from "./pages/ClaimVerify";
import Ballot from "./pages/Ballot";
import VerifyEmail from "./pages/VerifyEmail";
import About from "./pages/About"; // Import About
import Navbar from "./components/Navbar";
import { NetworkProvider, useNetwork } from './contexts/NetworkContext';
import Offline from './pages/Offline';
import MyVotes from './pages/MyVotes'; // Import the MyVotes component

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
            {/* Supabase puts the recovery / verification token in the URL hash, not a path param. */}
            <Route path="verify" element={<VerifyEmail />} />
            <Route path="verify/:legacyToken" element={<VerifyEmail />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="profile" element={<Profile />} />
            <Route path="ballot" element={<Ballot />} />
            <Route path="/representatives" element={<Representatives />} />
            <Route path="representatives/:id" element={<RepresentativeDetails />} />
            <Route path="claim/verify" element={<ClaimVerify />} />
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