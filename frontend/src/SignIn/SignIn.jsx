import './signin.css';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig.js';
import "bootstrap/dist/css/bootstrap.min.css";

export default function SignIn() {
    const navigate = useNavigate();
    const [isSignUp, setIsSignUp] = useState(false);
    const [signInData, setSignInData] = useState({ email: "", password: "" });
    const [signUpData, setSignUpData] = useState({ name: "", email: "", password: "" });
    const [error, setError] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
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
            await api.post("/api/signin", signInData).then((resp) => {
                if (resp.status === 204) {
                    alert("Account not approved by owner. Contact 9601613653");
                    return;
                }
                if (resp.status === 200) { 
                    alert("Welcome "+resp.data.user.name);
                    localStorage.setItem("token", resp.data.token);
                    navigate("https://google.com");
                }
            }); 
        } catch (err) {
            setError(err.response?.data?.message || "Sign in failed.");
            // if (err.response?.status === 400) {
            //     alert("Email and password are required.");
            // }
            if (err.response?.status === 401) {
                alert("Incorrect password");
            }
            else if (err.response?.status === 404) {
                alert("No user found with this email.");
            }
        }
    };

    const handleSignUpSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await api.post("/api/signup", signUpData).then((resp) => {
                if (resp.status == 201) {
                    alert(resp.data.message);
                }
            });
            setIsSignUp(false);
        } catch (err) {
            alert(err);
            setError(err.response?.data?.message || "Sign up failed.");
        }
    };

    return (
        <div className="signin-page">
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
