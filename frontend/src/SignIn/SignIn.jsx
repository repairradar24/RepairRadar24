import './signin.css';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import api from '../axiosConfig.js';

const SignIn = () => {
    useEffect(() => {
        api.get('/api/test').then(resp => {
            console.log(resp.data);
        })
    },[]);

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