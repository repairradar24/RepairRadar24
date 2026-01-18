import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import HomeIcon from "@mui/icons-material/Home";
import LogoutIcon from "@mui/icons-material/Logout"; // Import Logout Icon
import "./navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const storedName = sessionStorage.getItem("userName");
    if (storedName) setUserName(storedName.toUpperCase());
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.clear();
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
          {/* Add Icon and wrap text in a span for responsive hiding */}
          <HomeIcon className="btn-icon" />
          <span className="btn-text">Home</span>
        </button>
      </div>

      <div className="nav-section center">
        <div className="navbar-brand" onClick={() => navigate("/dashboard")}>
          RepairRadar24
        </div>
      </div>

      <div className="nav-section right">
        {/* Hide username on very small mobile screens */}
        <div className="user-name">{userName || "USER"}</div>

        <span className="nav-separator">|</span>

        <button onClick={handleLogout} className="nav-btn" title="Logout">
          <LogoutIcon className="btn-icon" />
          <span className="btn-text">Logout</span>
        </button>

        <button
          onClick={() => navigate("/settings")}
          className="nav-btn"
          title="Settings"
        >
          <SettingsIcon />
          {/* Settings usually doesn't need text if it has a gear icon */}
        </button>
      </div>
    </nav>
  );
}