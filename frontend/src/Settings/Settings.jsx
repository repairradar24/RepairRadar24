import React, { useEffect, useState, useRef, useMemo } from "react";
import "./settings.css";
import api from "../axiosConfig";
import { useNavigate } from "react-router-dom";
import { FaPen, FaPlus, FaTrash, FaEdit, FaSave } from "react-icons/fa";
import Navbar from "../Navbar/Navbar";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// --- HELPER COMPONENTS ---

const generateKey = (name) => {
    return name.trim().toLowerCase().replace(/\s+/g, "_");
};

const FieldConfig = ({ fields, setFields, level = 0 }) => {
    const addField = () => {
        const newField = {
            name: "",
            key: "",
            type: "text",
            options: [],
            fields: [],
            mandatory: false,
        };
        setFields([...fields, newField]);
    };

    const updateField = (index, key, value) => {
        const updated = [...fields];
        updated[index][key] = value;
        if (key === "name") {
            updated[index].key = generateKey(value);
        }
        setFields(updated);
    };

    const addOption = (index) => {
        const updated = [...fields];
        updated[index].options.push({ value: "", color: "#ffffff" });
        setFields(updated);
    };

    const updateOption = (fieldIndex, optIndex, key, value) => {
        const updated = [...fields];
        updated[fieldIndex].options[optIndex][key] = value;
        setFields(updated);
    };

    const removeOption = (fieldIndex, optIndex) => {
        const updated = [...fields];
        updated[fieldIndex].options.splice(optIndex, 1);
        setFields(updated);
    };

    const removeField = (index) => {
        const field = fields[index];
        if (field.mandatory) {
            toast.warn(`The field "${field.name}" is mandatory and cannot be removed.`);
            return;
        }
        setFields(fields.filter((_, i) => i !== index));
    };

    const moveField = (index, direction) => {
        const updated = [...fields];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= fields.length) return;
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        setFields(updated);
    };

    return (
        <div className={`field-group level-${level}`}>
            {fields.map((field, index) => (
                <div key={index} className="field-item">
                    <div className="field-row">
                        <input
                            type="text"
                            className="field-input"
                            placeholder="Field Name"
                            value={field.name}
                            onChange={(e) => updateField(index, "name", e.target.value)}
                            disabled={field.mandatory}
                        />
                        <span className="field-key">({field.key})</span>
                        <button
                            type="button"
                            className="move-btn"
                            onClick={() => moveField(index, -1)}
                            disabled={index === 0}
                        >
                            ↑
                        </button>
                        <button
                            type="button"
                            className="move-btn"
                            onClick={() => moveField(index, 1)}
                            disabled={index === fields.length - 1}
                        >
                            ↓
                        </button>
                        {!field.mandatory && (
                            <button
                                type="button"
                                className="remove-btn"
                                onClick={() => removeField(index)}
                            >
                                Remove
                            </button>
                        )}
                    </div>
                    {field.type === "dropdown" && (
                        <div className="options-section">
                            <button
                                type="button"
                                className="add-option-btn"
                                onClick={() => addOption(index)}
                            >
                                + Add Option
                            </button>
                            {field.options.map((opt, optIndex) => (
                                <div key={optIndex} className="option-row">
                                    <input
                                        type="text"
                                        className="option-input"
                                        placeholder={`Option ${optIndex + 1}`}
                                        value={opt.value}
                                        onChange={(e) =>
                                            updateOption(index, optIndex, "value", e.target.value)
                                        }
                                    />
                                    <label className="color-picker-label">
                                        🎨 Color:
                                        <input
                                            type="color"
                                            className="color-input"
                                            value={opt.color || "#cccccc"}
                                            onChange={(e) =>
                                                updateOption(index, optIndex, "color", e.target.value)
                                            }
                                            title="Click to select a color for this status"
                                        />
                                    </label>
                                    {field.key === "jobcard_status" && (
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={opt.displayByDefault || false}
                                                onChange={(e) =>
                                                    updateOption(
                                                        index,
                                                        optIndex,
                                                        "displayByDefault",
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                            Display by Default
                                        </label>
                                    )}
                                    <button
                                        type="button"
                                        className="remove-option-btn"
                                        onClick={() => removeOption(index, optIndex)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {field.type === "list" && (
                        <div className="subfields-section">
                            <h5 className="subfields-title">Subfields for "{field.name}"</h5>
                            <FieldConfig
                                fields={field.fields}
                                setFields={(newSubfields) => {
                                    const updated = [...fields];
                                    updated[index].fields = newSubfields;
                                    setFields(updated);
                                }}
                                level={level + 1}
                            />
                        </div>
                    )}
                    {field.key === "jobcard_status" && (
                        <p className="status-hint">
                            ⚠️ This field decides which jobcards are shown on the dashboard.
                            Jobs with statuses marked as <b>Display by Default</b> will appear on load.
                        </p>
                    )}
                </div>
            ))}
            <button type="button" className="add-field-btn" onClick={addField}>
                + Add Field
            </button>
        </div>
    );
};

// --- CONSTANTS ---

const defaultConfig = [
    { name: "Job Number", key: "job_no", type: "number", mandatory: true, options: [], fields: [] },
    { name: "Customer Phone", key: "customer_phone", type: "text", mandatory: true, options: [], fields: [] },
    { name: "Customer Name", key: "customer_name", type: "text", mandatory: true, options: [], fields: [] },
    {
        name: "Jobcard Status",
        key: "jobcard_status",
        type: "dropdown",
        mandatory: true,
        options: [
            { value: "Pending", displayByDefault: true, color: "#ffcc00" },
            { value: "In Progress", displayByDefault: false, color: "#00bfff" },
            { value: "Completed", displayByDefault: false, color: "#4caf50" },
        ],
        fields: [],
    },
    {
        name: "Items",
        key: "items",
        type: "list",
        mandatory: true,
        options: [],
        fields: [
            { name: "Item Name", key: "item_name", type: "text", mandatory: true, options: [], fields: [] },
            { name: "Item Qty", key: "item_qty", type: "number", mandatory: true, options: [], fields: [] },
            {
                name: "Item Status",
                key: "item_status",
                type: "dropdown",
                mandatory: true,
                options: [
                    { value: "Pending", color: "#ffcc00" },
                    { value: "In Progress", color: "#00bfff" },
                    { value: "Completed", color: "#4caf50" },
                ],
                fields: [],
            },
            {
                name: "Parts",
                key: "parts",
                type: "list",
                mandatory: true,
                options: [],
                fields: [
                    { name: "Part Name", key: "part_name", type: "text", mandatory: true, options: [], fields: [] },
                    { name: "Part Price", key: "part_price", type: "number", mandatory: true, options: [], fields: [] },
                    { name: "Part Qty", key: "part_qty", type: "number", mandatory: true, options: [], fields: [] },
                ],
            },
        ],
    },
];

const plans = [
    { id: "monthly", title: "Monthly Plan", price: "₹100", duration: "per month" },
    { id: "yearly", title: "Yearly Plan", price: "₹1000", duration: "per year" },
];

// --- MAIN SETTINGS COMPONENT ---

const Settings = () => {
    const [activeTab, setActiveTab] = useState("personal");

    const [name, setName] = useState("");
    const [originalName, setOriginalName] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [messages, setMessages] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [messageName, setMessageName] = useState("");
    const [customText, setCustomText] = useState("");
    const [editingMessageId, setEditingMessageId] = useState(null);
    const customTextRef = useRef(null);

    const [jobCardSchema, setJobCardSchema] = useState(null);

    const [customers, setCustomers] = useState([]);

    const [itemName, setItemName] = useState("");
    const [savedItems, setSavedItems] = useState([]);

    const [partName, setPartName] = useState("");
    const [partPrice, setPartPrice] = useState("");
    const [savedParts, setSavedParts] = useState([]);
    const [editingPartId, setEditingPartId] = useState(null);

    const [fields, setFields] = useState([]);

    const [showConfigWarning, setShowConfigWarning] = useState(false);
    const [planValidity, setPlanValidity] = useState("");

    const navigate = useNavigate();

    useEffect(() => {
        const token = sessionStorage.getItem("token");
        if (!token) {
            toast.error("Please log in first.");
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
        fetchCustomers();
        fetchSavedItems();
        fetchSavedParts();
        fetchJobCardConfig();

        const planValidityDate = sessionStorage.getItem("planValidity");
        setPlanValidity(planValidityDate);
    }, [navigate]);

    const { isPlanExpired, formattedValidityDate } = useMemo(() => {
        if (!planValidity) {
            return { isPlanExpired: true, formattedValidityDate: null };
        }

        const validityDate = new Date(planValidity);

        const formattedDate = validityDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        validityDate.setHours(23, 59, 59, 999);

        const expired = new Date() > validityDate;

        return { isPlanExpired: expired, formattedValidityDate: formattedDate };

    }, [planValidity]);

    const fetchMessages = async () => {
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.get("/user/whatsapp/get-messages", {
                headers: { authorization: `Bearer ${token}` },
            });
            setMessages(res.data || []);
        } catch (err) {
            console.error("Error fetching messages:", err);
            toast.error("Failed to fetch messages.");
        }
    };

    const fetchCustomers = async () => {
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.get("/user/customerdetails", {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setCustomers(res.data.customers || []);
            } else {
                console.error("Failed to fetch customers:", res.data.message);
                toast.error(res.data.message || "Failed to fetch customers.");
            }
        } catch (err) {
            console.error("Error fetching customers:", err);
            if (err.response?.status === 401) {
                toast.error("Session expired. Please log in again.");
                navigate("/");
            } else {
                toast.error("Failed to fetch customers.");
            }
        }
    };

    const fetchSavedItems = async () => {
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.get("/user/items", {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setSavedItems(res.data.items || []);
            } else {
                console.error("Failed to fetch items:", res.data.message);
                toast.error(res.data.message || "Failed to fetch items.");
            }
        } catch (err) {
            console.error("Error fetching items:", err);
            toast.error("Failed to fetch items.");
        }
    };

    const fetchSavedParts = async () => {
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.get("/user/parts", {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                setSavedParts(res.data.parts || []);
            } else {
                console.error("Failed to fetch parts:", res.data.message);
                toast.error(res.data.message || "Failed to fetch parts.");
            }
        } catch (err) {
            console.error("Error fetching parts:", err);
            toast.error("Failed to fetch parts.");
        }
    };

    const fetchJobCardConfig = async () => {
        const token = sessionStorage.getItem("token");
        try {
            const res = await api.get("/user/get-config", {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.status === 200) {
                let schema = res.data.schema || [];
                setFields(schema.length ? schema : defaultConfig);
            } else if (res.status === 204) {
                setFields(defaultConfig);
            }
        } catch (err) {
            if (err.response && err.response.status === 401) {
                toast.error("Unauthorized. Please log in again.");
                navigate("/");
            } else {
                console.error("Error fetching configuration:", err);
                toast.error("Sorry we could not fetch your past configuration. Loading default schema.");
                setFields(defaultConfig);
            }
        }
    };

    const saveConfig = async () => {
        const token = sessionStorage.getItem("token");
        await api
            .post(
                "/user/save-config",
                { schema: fields },
                { headers: { authorization: `Bearer ${token}` } }
            )
            .then((resp) => {
                if (resp.status === 200) {
                    toast.success(resp.data.message || "Configuration saved successfully.");
                }
            })
            .catch((err) => {
                if (err.status === 401) {
                    toast.error("Unauthorized. Please log in again.");
                    navigate("/");
                } else {
                    console.error("Error saving configuration:", err);
                    toast.error("Failed to save configuration. Please try again.");
                }
            });
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        const trimmedItemName = itemName.trim();
        if (!trimmedItemName) {
            toast.warn("Please enter an item name.");
            return;
        }
        try {
            const token = sessionStorage.getItem("token");
            const payload = { item_name: trimmedItemName };
            const res = await api.post("/user/items", payload, {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.data.success) {
                toast.success("Item added successfully.");
                setSavedItems([...savedItems, res.data.item]);
                setItemName("");
            } else {
                toast.error(res.data.message || "Failed to add item.");
            }
        } catch (err) {
            console.error("Error adding item:", err);
            toast.error(err.response?.data?.message || "Failed to add item.");
        }
    };

    const handleDeleteItem = async (id) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.delete(`/user/items/${id}`, {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.status === 200) {
                toast.success("Item deleted successfully.");
                setSavedItems((prevItems) =>
                    prevItems.filter((item) => item._id !== id)
                );
            } else {
                toast.error(res.data.message || "Failed to delete item.");
            }
        } catch (err) {
            console.error("Error deleting item:", err);
            toast.error(err.response?.data?.message || "Failed to delete item.");
        }
    };

    const clearPartForm = () => {
        setPartName("");
        setPartPrice("");
        setEditingPartId(null);
    };

    const handleSavePart = async (e) => {
        e.preventDefault();
        const trimmedPartName = partName.trim();
        const price = parseFloat(partPrice);
        if (!trimmedPartName) {
            toast.warn("Please enter a part name.");
            return;
        }
        if (isNaN(price) || price < 0) {
            toast.warn("Please enter a valid price.");
            return;
        }
        const payload = { part_name: trimmedPartName, part_price: price };
        const token = sessionStorage.getItem("token");
        try {
            let res;
            if (editingPartId) {
                res = await api.put(`/user/parts/${editingPartId}`, payload, {
                    headers: { authorization: `Bearer ${token}` },
                });
                if (res.data.success) {
                    toast.success("Part updated successfully.");
                    setSavedParts(
                        savedParts.map((p) =>
                            p._id === editingPartId ? res.data.part : p
                        )
                    );
                }
            } else {
                res = await api.post("/user/parts", payload, {
                    headers: { authorization: `Bearer ${token}` },
                });
                if (res.data.success) {
                    toast.success("Part added successfully.");
                    setSavedParts([...savedParts, res.data.part]);
                }
            }
            if (res.data.success) {
                clearPartForm();
            } else {
                toast.error(res.data.message || "Failed to save part.");
            }
        } catch (err) {
            console.error("Error saving part:", err);
            if (err.response?.status === 401) {
                toast.error("Session expired. Please log in again.");
                navigate("/");
                return;
            }
            toast.error(err.response?.data?.message || "Failed to save part.");
        }
    };

    const handleEditPart = (part) => {
        setEditingPartId(part._id);
        setPartName(part.part_name);
        setPartPrice(part.part_price);
        window.scrollTo(0, 0);
    };

    const handleDeletePart = async (id) => {
        if (!window.confirm("Are you sure you want to delete this part?")) return;
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.delete(`/user/parts/${id}`, {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.status === 200) {
                toast.success("Part deleted successfully.");
                setSavedParts((prevParts) =>
                    prevParts.filter((part) => part._id !== id)
                );
            } else {
                toast.error(res.data.message || "Failed to delete part.");
            }
        } catch (err) {
            console.error("Error deleting part:", err);
            toast.error(err.response?.data?.message || "Failed to delete part.");
        }
    };

    const handleDeleteCustomer = async (id) => {
        if (!window.confirm("Are you sure you want to delete this customer?")) return;
        try {
            const token = sessionStorage.getItem("token");
            const res = await api.delete(`/user/customerdetails/${id}`, {
                headers: { authorization: `Bearer ${token}` },
            });
            if (res.status === 200) {
                toast.success("Customer deleted successfully.");
                setCustomers((prevCustomers) =>
                    prevCustomers.filter((customer) => customer._id !== id)
                );
            } else {
                toast.error(res.data.message || "Failed to delete customer.");
            }
        } catch (err) {
            console.error("Error deleting customer:", err);
            toast.error(err.response?.data?.message || "Failed to delete customer.");
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
            if (err.response?.status === 401) {
                toast.error("Session expired. Please log in again.");
                navigate("/");
            }
            console.error("Error fetching schema:", err);
            toast.error("Failed to fetch schema.");
        }
    };

    const getRelevantFields = (schema) => {
        if (!schema?.schema) return [];
        const usefulKeys = ["job_no", "customer_name", "customer_phone", "item_name", "item_qty", "item_serial"];
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
            toast.warn("Please enter a message name.");
            return;
        }
        const token = sessionStorage.getItem("token");
        if (!token) return navigate("/");
        try {
            const payload = {
                name: messageName.trim(),
                text: customText.replace(/\n/g, "\\n").trim(),
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
                toast.success(`Message ${editingMessageId ? "updated" : "created"} successfully`);
                setShowModal(false);
                setEditingMessageId(null);
                setMessageName("");
                setCustomText("");
                fetchMessages();
            }
        } catch (err) {
            console.error("Error saving message:", err);
            toast.error("Failed to save message.");
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
            toast.success("Message deleted successfully.");
        } catch (err) {
            console.error("Error deleting message:", err);
            toast.error("Failed to delete message.");
        }
    };

    const openEditModal = (msg) => {
        setEditingMessageId(msg._id);
        setMessageName(msg.name);
        setCustomText(msg.text);
        setShowModal(true);
    };

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
                toast.success("Name updated successfully to " + resp.data.name);
                sessionStorage.setItem("userName", resp.data.name);
                setName(resp.data.name);
                setOriginalName(resp.data.name);
                setIsEditingName(false);
            }
        } catch (err) {
            console.error("Error updating business name:", err);
            toast.error("Failed to update name.");
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
                toast.success("Password verified successfully.");
                setIsVerified(true);
            } else {
                toast.error("Incorrect password. Please try again.");
            }
        } catch (err) {
            console.error("Error verifying password:", err);
            toast.error(err.response?.data?.message || "Verification failed.");
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.warn("Passwords do not match!");
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
                toast.success("Password updated successfully.");
                setCurrentPassword("");
                setPassword("");
                setConfirmPassword("");
                setIsVerified(false);
            }
        } catch (err) {
            console.error("Error updating password:", err);
            toast.error(err.response?.data?.message || "Password update failed.");
        }
    };

    const insertField = (key) => {
        if (!customTextRef.current) return;
        const textarea = customTextRef.current;
        const cursorPos = textarea.selectionStart;
        const textBefore = customText.slice(0, cursorPos);
        const textAfter = customText.slice(cursorPos);
        const newText = `${textBefore}{${key}}${textAfter}`;
        setCustomText(newText);
        setTimeout(() => {
            const newCursorPos = cursorPos + key.length + 2;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    };

    return (
        <div style={{ margin: "0px" }}>
            <ToastContainer position="top-right" autoClose={5000} />
            <Navbar />
            <div className="settings-layout">
                <div className="settings-sidebar">
                    <button
                        className={`tab-btn ${activeTab === "personal" ? "active" : ""}`}
                        onClick={() => setActiveTab("personal")}
                    >
                        Personal Information
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "whatsapp" ? "active" : ""}`}
                        onClick={() => setActiveTab("whatsapp")}
                    >
                        WhatsApp Messages
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "customerdetails" ? "active" : ""
                            }`}
                        onClick={() => setActiveTab("customerdetails")}
                    >
                        Customer Details
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "saveditems" ? "active" : ""}`}
                        onClick={() => setActiveTab("saveditems")}
                    >
                        Saved Items
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "savedparts" ? "active" : ""}`}
                        onClick={() => setActiveTab("savedparts")}
                    >
                        Saved Parts
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "jobcard" ? "active" : ""}`}
                        onClick={() => {
                            setActiveTab("jobcard");
                            setShowConfigWarning(true);
                        }}
                    >
                        Customise Jobcard fields
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "subscription" ? "active" : ""
                            }`}
                        onClick={() => setActiveTab("subscription")}
                    >
                        Subscription Plans
                    </button>
                </div>

                <div className="settings-right">
                    {activeTab === "personal" && (
                        <>
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
                            <div className="settings-form">
                                <label>Change Password</label>
                                <form
                                    onSubmit={handleVerifyPassword}
                                    className="settings-form"
                                >
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
                                    <form
                                        onSubmit={handlePasswordChange}
                                        className="settings-form"
                                    >
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
                        </>
                    )}

                    {activeTab === "whatsapp" && (
                        <>
                            <h2>WhatsApp Messages</h2>
                            <hr />
                            <div className="whatsapp-scroll">
                                {messages.map((msg) => (
                                    <div key={msg._id} className="message-card">
                                        <h4>{msg.name}</h4>
                                        <p className="msg-preview">{msg.text.slice(0, 80)}...</p>
                                        <div className="msg-actions">
                                            <button
                                                className="icon-btn"
                                                onClick={() => openEditModal(msg)}
                                            >
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
                        </>
                    )}

                    {activeTab === "customerdetails" && (
                        <>
                            <h2>Customer Details</h2>
                            <hr />
                            <div className="customer-table-container">
                                <table className="customer-table">
                                    <thead>
                                        <tr>
                                            <th>Customer Name</th>
                                            <th>Customer Phone</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customers.length > 0 ? (
                                            customers.map((customer) => (
                                                <tr key={customer._id}>
                                                    <td>{customer.customer_name}</td>
                                                    <td>{customer.customer_phone}</td>
                                                    <td>
                                                        <button
                                                            className="icon-btn delete-btn"
                                                            onClick={() =>
                                                                handleDeleteCustomer(customer._id)
                                                            }
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: "center" }}>
                                                    No customers found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {activeTab === "saveditems" && (
                        <>
                            <h2>Saved Items</h2>
                            <hr />

                            <form
                                onSubmit={handleAddItem}
                                className="settings-form saved-item-form"
                            >
                                <label>Add New Item</label>
                                <div className="input-with-button">
                                    <input
                                        type="text"
                                        placeholder="Enter item name (e.g., Laptop, Mobile)"
                                        value={itemName}
                                        onChange={(e) => setItemName(e.target.value)}
                                        className="light-input"
                                    />
                                    <button type="submit" className="add-btn">
                                        <FaPlus /> Add
                                    </button>
                                </div>
                            </form>

                            <div className="saved-items-list-container">
                                <h4>Existing Items</h4>
                                {savedItems.length > 0 ? (
                                    <ul className="saved-items-list">
                                        {savedItems.map((item) => (
                                            <li key={item._id}>
                                                <span>{item.item_name}</span>
                                                <button
                                                    className="icon-btn delete-btn"
                                                    onClick={() => handleDeleteItem(item._id)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p
                                        style={{
                                            textAlign: "center",
                                            color: "#888",
                                            marginTop: "20px",
                                        }}
                                    >
                                        No saved items found.
                                    </p>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === "savedparts" && (
                        <>
                            <h2>Saved Parts</h2>
                            <hr />
                            <form
                                onSubmit={handleSavePart}
                                className="settings-form saved-item-form"
                            >
                                <label>
                                    {editingPartId ? "Edit Part" : "Add New Part"}
                                </label>
                                <div className="input-with-button">
                                    <input
                                        type="text"
                                        placeholder="Enter part name"
                                        value={partName}
                                        onChange={(e) => setPartName(e.target.value)}
                                        className="light-input"
                                        style={{ flex: 2 }}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Enter price"
                                        value={partPrice}
                                        onChange={(e) => setPartPrice(e.target.value)}
                                        className="light-input"
                                        style={{ flex: 1 }}
                                    />
                                    <button type="submit" className="add-btn">
                                        {editingPartId ? <FaSave /> : <FaPlus />}
                                        {editingPartId ? " Update" : " Save"}
                                    </button>
                                    {editingPartId && (
                                        <button
                                            type="button"
                                            className="cancel-btn"
                                            onClick={clearPartForm}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </form>
                            <div
                                className="customer-table-container"
                                style={{ marginTop: "30px" }}
                            >
                                <h4>Existing Parts</h4>
                                <table className="customer-table">
                                    <thead>
                                        <tr>
                                            <th>Part Name</th>
                                            <th>Part Price</th>
                                            <th style={{ width: "100px" }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {savedParts.length > 0 ? (
                                            savedParts.map((part) => (
                                                <tr key={part._id}>
                                                    <td>{part.part_name}</td>
                                                    <td>₹{part.part_price}</td>
                                                    <td>
                                                        <button
                                                            className="icon-btn"
                                                            onClick={() => handleEditPart(part)}
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button
                                                            className="icon-btn delete-btn"
                                                            onClick={() => handleDeletePart(part._id)}
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: "center" }}>
                                                    No saved parts found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {activeTab === "jobcard" && (
                        <>
                            <h2>Customise Jobcard fields</h2>
                            <hr />
                            <FieldConfig fields={fields} setFields={setFields} />
                            <br />
                            <button
                                onClick={saveConfig}
                                className="save-btn"
                                style={{ alignSelf: "flex-start" }}
                            >
                                Save Configuration
                            </button>
                        </>
                    )}

                    {activeTab === "subscription" && (
                        <>
                            <h2>Subscription Plans</h2>
                            <hr />

                            {isPlanExpired ? (
                                <div className="plan-status status-expired" style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.5rem', marginRight: '15px' }}>⚠️</span>
                                    <div>
                                        <strong>Your plan has expired.</strong> Some features may not be available.
                                        <br />
                                        Contact <strong>+91 9601613653</strong> for renewal.
                                    </div>
                                </div>
                            ) : (
                                <div className="plan-status status-active" style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1.5rem', marginRight: '15px' }}>✅</span>
                                    <div>
                                        <strong>Your plan is active.</strong>
                                        <br />
                                        It will expire on: <strong>{formattedValidityDate}</strong>
                                    </div>
                                </div>
                            )}

                            <h3
                                style={{
                                    marginTop: "30px",
                                    borderBottom: "1px solid #ddd",
                                    paddingBottom: "10px",
                                    width: "100%",
                                }}
                            >
                                Available Plans
                            </h3>
                            <div className="plans-container">
                                {plans.map((plan) => (
                                    <div key={plan.id} className="plan-card">
                                        <h3>{plan.title}</h3>
                                        <p className="plan-price">{plan.price}</p>
                                        <p className="plan-duration">{plan.duration}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content modal-grid">
                        <div className="modal-left">
                            <h3>
                                {editingMessageId ? "Edit Message" : "Create New Message"}
                            </h3>
                            <label>Message Name</label>
                            <input
                                type="text"
                                value={messageName}
                                onChange={(e) => setMessageName(e.target.value)}
                                className="light-input"
                            />
                            <label>Message Content</label>
                            <textarea
                                ref={customTextRef}
                                rows="7"
                                value={customText.replace(/\\n/g, "\n")}
                                onChange={(e) => setCustomText(e.target.value)}
                                className="light-input"
                                placeholder="Type your message or insert fields..."
                            />
                            <div className="preview-section">
                                <h4>Message Preview</h4>
                                <div className="preview-box">
                                    <pre>{customText.replace(/\\n/g, "\n")}</pre>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="update-btn" onClick={handleSaveMessage}>
                                    Save
                                </button>
                                <button
                                    className="cancel-btn"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingMessageId(null);
                                        setMessageName("");
                                        setCustomText("");
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
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

            {showConfigWarning && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: "600px" }}>
                        <h2 style={{ marginTop: 0, color: "#d9534f" }}>
                            ⚠️ Important: Read Before Editing Schema
                        </h2>
                        <p>
                            You are about to make changes to your core job card structure.
                            Please read these points carefully:
                        </p>
                        <ul style={{ paddingLeft: "20px", lineHeight: "1.6" }}>
                            <li>
                                <b>Mandatory Fields:</b> Core fields (like 'Job Number',
                                'Customer Name') are locked. They cannot be renamed or deleted
                                to ensure your app continues to work correctly.
                            </li>
                            <li style={{ marginTop: "10px" }}>
                                <b>Adding New Fields:</b> When you add a new field, all your{" "}
                                <strong>existing</strong> job cards will not have this field. It
                                will appear as empty or 'null' until you manually edit and save
                                those old job cards.
                            </li>
                            <li style={{ marginTop: "10px" }}>
                                <b>Deleting Fields:</b> When you delete a non-mandatory field,
                                the data for that field will be <strong>hidden</strong> from{" "}
                                <i>all</i> existing and new job cards.
                            </li>
                            <li style={{ marginTop: "10px" }}>
                                <b>Recommendation:</b> It is highly recommended to finalize your
                                schema and <strong>make changes infrequently</strong>.
                                Changing your structure often can lead to data inconsistencies.
                            </li>
                        </ul>
                        <div
                            className="modal-actions"
                            style={{ justifyContent: "flex-end", marginTop: "20px" }}
                        >
                            <button
                                className="update-btn"
                                onClick={() => setShowConfigWarning(false)}
                            >
                                I Understand, Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
