import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './index.css';
import { createRoot } from 'react-dom/client'
import './index.css'
import SignIn from './SignIn/SignIn.jsx';
import Dashboard from './Dashboard/Dashboard.jsx';
import JobCardConfig from './JobCardConfig/JobCardConfig.jsx';
import CreateJobCard from './CreateJobCard/CreateJobCard.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/config" element={<JobCardConfig />} />
        <Route path="/create-job" element={<CreateJobCard />} />
      </Routes>
    </Router>
  </React.StrictMode>,
)
