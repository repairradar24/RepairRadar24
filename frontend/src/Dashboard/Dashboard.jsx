import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../axiosConfig.js';

function Dashboard() {
    const [name, setName] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            alert("You are not logged in. Please sign in.");
            navigate('/signin'); // Redirect if no token
            return;
        }

        api.get('user/my-data', {
            method: 'GET',
            headers: {
                'authorization': `Bearer ${token}`
            }
        })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    navigate('/signin');
                    return null;
                }
                if (res.data && res.data.name) {
                    setName(res.data.name);
                }
            })
            .catch((err) => {
                console.log("Error fetching user data:", err);

                navigate('/')
            });
    }, [navigate]);

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '2rem',
            backgroundColor: '#f0f8ff'
        }}>
            <h1>Welcome, {name || 'User'}!</h1>
        </div>
    );
}

export default Dashboard;
