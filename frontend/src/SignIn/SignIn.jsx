import './signin.css';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig.js';
import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
            { name: "Unique Id", key: "item_unique_id", type: "text", mandatory: true, options: [], fields: [] },
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

// 🔹 Cookie helpers
const setCookie = (name, value, days) => {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = "expires=" + date.toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/`;
};

const getCookie = (name) => {
    const decodedCookie = decodeURIComponent(document.cookie || "");
    const ca = decodedCookie.split(";");
    const cookieName = name + "=";
    for (let c of ca) {
        c = c.trim();
        if (c.indexOf(cookieName) === 0) {
            return c.substring(cookieName.length, c.length);
        }
    }
    return "";
};

export default function SignIn() {
    const navigate = useNavigate();

    // 🔹 Initialize email from cookie; password left empty
    const [signInData, setSignInData] = useState(() => ({
        email: getCookie("rememberEmail") || "",
        password: "",
    }));

    const [isSignUp, setIsSignUp] = useState(false);
    const [signUpData, setSignUpData] = useState({ name: "", email: "", password: "" });
    const [error, setError] = useState("");

    useEffect(() => {
        const token = sessionStorage.getItem("token");
        console.log("Token:", token);

        // if (token) navigate("/dashboard");
    }, [navigate]);

    const handleSignInChange = (e) => {
        setSignInData({ ...signInData, [e.target.name]: e.target.value });
    };

    const handleSignUpChange = (e) => {
        setSignUpData({ ...signUpData, [e.target.name]: e.target.value });
    };

    const handleSignInSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            await api.post("/api/signin", signInData).then(async (resp) => {
                if (resp.status === 204) {
                    toast.warn("Account not approved by owner. Contact 9601613653");
                    return;
                }

                if (resp.status === 200) {
                    toast.success("Welcome " + resp.data.user.name);
                    sessionStorage.setItem("token", resp.data.token);
                    sessionStorage.setItem("userName", resp.data.user.name);
                    sessionStorage.setItem("isPlanExpired", resp.data.isPlanExpired);
                    sessionStorage.setItem("planValidity", resp.data.planValidity);

                    const token = resp.data.token;

                    // 🔹 Store email in long-lived cookie (1 year)
                    setCookie("rememberEmail", signInData.email, 365);

                    if (!resp.data.schemaConfigured) {
                        try {
                            await api.post(
                                "/user/save-config",
                                { schema: defaultConfig },
                                { headers: { authorization: `Bearer ${token}` } }
                            );

                            navigate("/dashboard");
                        } catch (configErr) {
                            console.error("Failed to save default config:", configErr);
                            const configErrorMessage =
                                "Sign in successful, but failed to save default settings. Please contact support.";
                            setError(configErrorMessage);
                            toast.error(configErrorMessage);
                        }
                    } else {
                        navigate("/dashboard");
                    }
                }
            });
        } catch (err) {
            let errorMessage = "Sign in failed.";
            if (err.response?.status === 401) {
                errorMessage = "Incorrect password";
            } else if (err.response?.status === 404) {
                errorMessage = "No user found with this email.";
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }

            setError(errorMessage);
            toast.error(errorMessage);
        }
    };

    const handleSignUpSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            await api.post("/api/signup", signUpData).then((resp) => {
                if (resp.status === 201) {
                    toast.success(resp.data.message);
                }
            });
            setIsSignUp(false);
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Sign up failed.";
            setError(errorMessage);
            toast.error(errorMessage);
        }
    };

    return (
        <div className="signin-page">
            <ToastContainer position="top-right" autoClose={5000} />

            <div className="signin-card shadow">
                <h1 className="site-title">RepairRadar</h1>
                <h3 className="text-center mb-4">{isSignUp ? "Create Account" : "Sign In"}</h3>

                {error && <div className="alert alert-danger">{error}</div>}

                {isSignUp ? (
                    <form onSubmit={handleSignUpSubmit}>
                        <div className="mb-3">
                            <label className="form-label">Name</label>
                            <input
                                type="text"
                                className="form-control"
                                name="name"
                                value={signUpData.name}
                                onChange={handleSignUpChange}
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-control"
                                name="email"
                                value={signUpData.email}
                                onChange={handleSignUpChange}
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-control"
                                name="password"
                                value={signUpData.password}
                                onChange={handleSignUpChange}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-gradient w-100">
                            Sign Up
                        </button>

                        <p className="text-center mt-3">
                            Already have an account?{" "}
                            <button type="button" className="btn btn-link p-0" onClick={() => setIsSignUp(false)}>
                                Sign In
                            </button>
                        </p>
                    </form>
                ) : (
                    <form onSubmit={handleSignInSubmit}>
                        <div className="mb-3">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-control"
                                name="email"
                                value={signInData.email}
                                onChange={handleSignInChange}
                                required
                            />
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-control"
                                name="password"
                                value={signInData.password}
                                onChange={handleSignInChange}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-gradient w-100">
                            Sign In
                        </button>

                        <p className="text-center mt-3">
                            Don’t have an account?{" "}
                            <button type="button" className="btn btn-link p-0" onClick={() => setIsSignUp(true)}>
                                Create New Account
                            </button>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
