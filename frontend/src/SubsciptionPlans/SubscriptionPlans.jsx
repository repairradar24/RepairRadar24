import React from "react";
import "./subscriptionplans.css"; // ✅ styles

export default function SubscriptionPlans() {
  const plans = [
    { id: "monthly", title: "Monthly Plan", price: "₹100", duration: "per month" },
    { id: "yearly", title: "Yearly Plan", price: "₹1000", duration: "per year" },
  ];

  return (
    <div className="subscription-page">
      <h2 className="subscription-title">Our Subscription Plans</h2>
      <div className="plans-container">
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card">
            <h3>{plan.title}</h3>
            <p className="plan-price">{plan.price}</p>
            <p className="plan-duration">{plan.duration}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
