import React, { useEffect, useState, useRef } from "react";
import "./settings.css";
import api from "../axiosConfig";
import { useNavigate } from "react-router-dom";
import { FaPen, FaPlus, FaTrash, FaEdit } from "react-icons/fa";

const Settings = () => {
    const [name, setName] = useState("");
    const [originalName, setOriginalName] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // WhatsApp Messages
    const [messages, setMessages] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [messageName, setMessageName] = useState("");
    const [customText, setCustomText] = useState("");
    const [editingMessageId, setEditingMessageId] = useState(null);
    const customTextRef = useRef(null);

    // Jobcard Schema
    const [jobCardSchema, setJobCardSchema] = useState(null);

    const navigate = useNavigate();

    // Load name, messages, and schema
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

        fetchMessages();
        fetchSchema();
    }, [navigate]);

    const fetchMessages = async () => {
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.get("/user/whatsapp/get-messages", {
                headers: { authorization: `Bearer ${token}` },
            });
            setMessages(res.data || []);
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    const fetchSchema = async () => {
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.get("/user/get-config", {
                headers: { authorization: `Bearer ${token}` },
            });
            setJobCardSchema(res.data);
        } catch (err) {
            if (err.status === 401) {
                alert("Session expired. Please log in again.");
                navigate("/");
            }
            console.error("Error fetching schema:", err);
        }
    };

    // Extract only relevant fields for WhatsApp message placeholders
    const getRelevantFields = (schema) => {
        if (!schema?.schema) return [];
        const usefulKeys = [
            "job_no",
            "customer_name",
            "customer_phone",
            "item_name",
            "item_qty",
            "item_serial",
        ];

        const fields = [];

        schema.schema.forEach((field) => {
            if (usefulKeys.includes(field.key)) {
                fields.push({ name: field.name, key: field.key });
            }

            if (field.key === "items" && Array.isArray(field.fields)) {
                field.fields.forEach((subField) => {
                    if (usefulKeys.includes(subField.key)) {
                        fields.push({ name: subField.name, key: subField.key });
                    }
                });
            }
        });

        return fields;
    };

    const handleSaveMessage = async () => {
        if (!messageName.trim()) {
            alert("Please enter a message name.");
            return;
        }

        const token = sessionStorage.getItem("token");
        if (!token) return navigate("/");

        try {
            const payload = {
                name: messageName.trim(),
                text: customText.trim(),
            };

            let res;
            if (editingMessageId) {
                res = await api.put(
                    `/user/whatsapp/update-message/${editingMessageId}`,
                    payload,
                    { headers: { authorization: `Bearer ${token}` } }
                );
            } else {
                res = await api.post("/user/whatsapp/create-message/", payload, {
                    headers: { authorization: `Bearer ${token}` },
                });
            }

            if (res.status === 200 || res.status === 201) {
                alert(`Message ${editingMessageId ? "updated" : "created"} successfully`);
                setShowModal(false);
                setEditingMessageId(null);
                setMessageName("");
                setCustomText("");
                fetchMessages();
            }
        } catch (err) {
            console.error("Error saving message:", err);
            alert("Failed to save message.");
        }
    };


    const handleDeleteMessage = async (id) => {
        if (!window.confirm("Are you sure you want to delete this message?")) return;
        try {
            const token = sessionStorage.getItem("token");
            await api.delete(`/user/whatsapp/delete-message/${id}`, {
                headers: { authorization: `Bearer ${token}` },
            });
            setMessages(messages.filter((m) => m._id !== id));
        } catch (err) {
            console.error("Error deleting message:", err);
            alert("Failed to delete message.");
        }
    };

    const openEditModal = (msg) => {
        setEditingMessageId(msg._id);
        setMessageName(msg.name);
        setCustomText(msg.text);
        setShowModal(true);
    };

    // Existing settings functions
    const handleNameChange = async (e) => {
        e.preventDefault();
        try {
            const token = sessionStorage.getItem("token");
            if (!token) navigate("/");

            const resp = await api.put(
                "/api/update-name",
                { name },
                { headers: { authorization: `Bearer ${token}` } }
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
            if (!token) navigate("/");

            const resp = await api.post(
                "/api/verify-password",
                { currentPassword },
                { headers: { authorization: `Bearer ${token}` } }
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
            if (!token) navigate("/");

            const resp = await api.put(
                "/api/update-password",
                { password },
                { headers: { authorization: `Bearer ${token}` } }
            );

            if (resp.status === 200) {
                alert("Password updated successfully.");
                setCurrentPassword("");
                setPassword("");
                setConfirmPassword("");
                setIsVerified(false);
            }
        } catch (err) {
            console.error("Error updating password:", err);
            alert(err.response?.data?.message || "Password update failed.");
        }
    };

    const getSelectableFields = (schema) => {
        if (!schema) return [];

        const usefulKeys = [
            "job_no",
            "customer_name",
            "customer_phone",
            "item_name",
            "item_qty",
            "item_serial",
        ];

        const fields = [];

        schema.forEach((field) => {
            if (usefulKeys.includes(field.key)) {
                fields.push({ name: field.name, key: field.key });
            }

            if (field.key === "items" && Array.isArray(field.fields)) {
                field.fields.forEach((sub) => {
                    if (usefulKeys.includes(sub.key)) {
                        fields.push({ name: sub.name, key: sub.key });
                    }
                });
            }
        });

        return fields;
    };

    const insertField = (key) => {
        if (!customTextRef.current) return;
        const textarea = customTextRef.current;
        const cursorPos = textarea.selectionStart;
        const textBefore = customText.slice(0, cursorPos);
        const textAfter = customText.slice(cursorPos);

        const newText = `${textBefore}{${key}}${textAfter}`;
        setCustomText(newText);

        // Move cursor after inserted text
        setTimeout(() => {
            const newCursorPos = cursorPos + key.length + 2;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div className="settings-container">
            <div className="settings-content">
                {/* Personal Info Section */}
                <div className="settings-section">
                    <h2>Personal Information</h2>
                    <hr />
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

                    {/* Change Password Section */}
                    <div className="settings-form">
                        <label>Change Password</label>

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

                {/* WhatsApp Messages Section */}
                <div className="settings-section">
                    <h2>WhatsApp Messages</h2>
                    <hr />
                    <div className="whatsapp-scroll">
                        {messages.map((msg) => (
                            <div key={msg._id} className="message-card">
                                <h4>{msg.name}</h4>
                                <p className="msg-preview">{msg.text.slice(0, 80)}...</p>
                                <div className="msg-actions">
                                    <button className="icon-btn" onClick={() => openEditModal(msg)}>
                                        <FaEdit />
                                    </button>
                                    <button
                                        className="icon-btn delete-btn"
                                        onClick={() => handleDeleteMessage(msg._id)}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <div
                            className="message-card create-card"
                            onClick={() => setShowModal(true)}
                        >
                            <FaPlus size={24} />
                            <span>Create</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal for create/edit */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content modal-grid">
                        {/* Left half - Message Editor */}
                        <div className="modal-left">
                            <h3>{editingMessageId ? "Edit Message" : "Create New Message"}</h3>

                            <label>Message Name</label>
                            <input
                                type="text"
                                value={messageName}
                                onChange={(e) => setMessageName(e.target.value)}
                                className="light-input"
                            />

                            <label>Message Content</label>
                            <textarea
                                ref={customTextRef} // 👈 add ref
                                rows="7"
                                value={customText}
                                onChange={(e) => setCustomText(e.target.value)}
                                className="light-input"
                                placeholder="Type your message or insert fields..."
                            />

                            {/* Live Preview */}
                            <div className="preview-section">
                                <h4>Message Preview</h4>
                                <div className="preview-box">
                                    <pre>{customText}</pre>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button className="update-btn" onClick={handleSaveMessage}>
                                    Save
                                </button>
                                <button className="cancel-btn" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>

                        {/* Right half - Schema Fields */}
                        <div className="modal-right">
                            <h4>Available Fields</h4>
                            {jobCardSchema ? (
                                <div className="field-list">
                                    {getRelevantFields(jobCardSchema).map((f) => (
                                        <button
                                            key={f.key}
                                            className="field-btn"
                                            onClick={() => insertField(f.key)}
                                        >
                                            {f.name}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p>Loading schema...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
