import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SettingsIcon from "@mui/icons-material/Settings";
import "./navbar.css";

export default function Navbar() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const storedName = sessionStorage.getItem("userName");
    if (storedName) setUserName(storedName.toUpperCase());
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="nav-section left">
        <button onClick={() => navigate("/dashboard")} className="nav-btn">
          Home
        </button>
      </div>

      <div className="nav-section center">
        <div className="user-name">{userName || "USER"}</div>
      </div>

      <div className="nav-section right">
        <button onClick={handleLogout} className="nav-btn">
          Logout
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="nav-btn settings-btn"
          title="Settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </nav>
  );
}
