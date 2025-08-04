import './signin.css';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const SignIn = () => {
    return (
        <div className="signin-container">
            <h2>Sign In</h2>
            <form>
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input type="email" id="email" name="email" required />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input type="password" id="password" name="password" required />
                </div>
                <button type="submit">Sign In</button>
            </form>
        </div>
    );
}

export default SignIn;