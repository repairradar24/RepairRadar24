import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import HomeIcon from "@mui/icons-material/Home"; // Added for the home button
import "./navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const storedName = sessionStorage.getItem("userName");
    if (storedName) setUserName(storedName.toUpperCase());
  }, []);

  const handleLogout = () => {
    sessionStorage.clear(); // Use clear() for a full logout
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="nav-section left">
        <button
          onClick={() => navigate("/dashboard")}
          className="nav-btn"
          title="Home"
        >
          Home
        </button>
      </div>

      <div className="nav-section center">
        <div className="navbar-brand" onClick={() => navigate("/dashboard")}>
          RepairRadar24
        </div>
      </div>

      <div className="nav-section right">
        <div className="user-name">{userName || "USER"}</div>
        <span className="nav-separator">|</span>
        <button onClick={handleLogout} className="nav-btn">
          Logout
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="nav-btn"
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </nav>
  );
}