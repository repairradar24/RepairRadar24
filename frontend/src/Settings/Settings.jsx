import React, { useEffect, useState } from "react";
import "./settings.css";
import api from "../axiosConfig";
import { useNavigate } from "react-router-dom";
import { FaPen } from "react-icons/fa";

const Settings = () => {
    const [name, setName] = useState("");
    const [originalName, setOriginalName] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        const token = sessionStorage.getItem("token");
        if (!token) {
            alert("Please log in first.");
            navigate("/");
            return;
        }

        const storedName = sessionStorage.getItem("userName");
        if (storedName) {
            setName(storedName);
            setOriginalName(storedName);
        }
    }, [navigate]);

    const handleNameChange = async (e) => {
        e.preventDefault();
        try {
            const token = sessionStorage.getItem("token");
            if (!token) {
                navigate("/");
            }

            const resp = await api.put(
                "/api/update-name",
                { name },
                {
                    headers: { authorization: `Bearer ${token}` },
                }
            );

            if (resp.status === 200) {
                alert("Name updated successfully to " + resp.data.name);
                sessionStorage.setItem("userName", resp.data.name);
                setName(resp.data.name);
                setOriginalName(resp.data.name);
                setIsEditingName(false);
            }
        } catch (err) {
            console.error("Error updating business name:", err);
        }
    };

    const handleVerifyPassword = async (e) => {
        e.preventDefault();
        try {
            const token = sessionStorage.getItem("token");
            if (!token) {
                navigate("/");
            }

            const resp = await api.post(
                "/api/verify-password",
                { currentPassword },
                {
                    headers: { authorization: `Bearer ${token}` },
                }
            );

            if (resp.status === 200 && resp.data.verified) {
                alert("Password verified successfully.");
                setIsVerified(true);
            } else {
                alert("Incorrect password. Please try again.");
            }
        } catch (err) {
            console.error("Error verifying password:", err);
            alert(err.response?.data?.message || "Verification failed.");
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {
            const token = sessionStorage.getItem("token");
            if (!token) {
                navigate("/");
            }

            const resp = await api.put(
                "/api/update-password",
                { password },
                {
                    headers: { authorization: `Bearer ${token}` },
                }
            );

            if (resp.status === 200) {
                alert("Password updated successfully.");
                setCurrentPassword("");
                setPassword("");
                setConfirmPassword("");
                setIsVerified(false); // reset flow
            }
        } catch (err) {
            console.error("Error updating password:", err);
            alert(err.response?.data?.message || "Password update failed.");
        }
    };

    return (
        <div className="settings-container">
            <div className="settings-content">
                {/* Section: Personal Information */}
                <div className="settings-section">
                    <h2>Personal Information</h2>
                    <hr />

                    {/* Change Name */}
                    <form onSubmit={handleNameChange} className="settings-form">
                        <label>Change Name</label>
                        <div className="input-with-icon">
                            <input
                                type="text"
                                placeholder="Enter new name"
                                value={name}
                                disabled={!isEditingName}
                                onChange={(e) => setName(e.target.value)}
                                className="light-input"
                            />
                            <button
                                type="button"
                                className="edit-btn"
                                onClick={() => setIsEditingName(true)}
                            >
                                <FaPen />
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={name === originalName}
                            className="update-btn"
                        >
                            Update Name
                        </button>
                    </form>

                    {/* Change Password */}
                    <div className="settings-form">
                        <label>Change Password</label>

                        {/* Step 1: Verify current password */}
                        <form onSubmit={handleVerifyPassword} className="settings-form">
                            <input
                                type="password"
                                placeholder="Enter current password"
                                value={currentPassword}
                                disabled={isVerified}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="light-input"
                            />
                            {!isVerified && (
                                <button type="submit" className="update-btn">
                                    Verify
                                </button>
                            )}
                        </form>

                        {/* Step 2: Enter new password only if verified */}
                        {isVerified && (
                            <form onSubmit={handlePasswordChange} className="settings-form">
                                <input
                                    type="password"
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="light-input"
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="light-input"
                                />
                                <button type="submit" className="update-btn">
                                    Update Password
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
