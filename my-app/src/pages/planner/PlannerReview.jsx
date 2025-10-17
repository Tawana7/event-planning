// PlannerReview.jsx - Updated with Improved Flow and Specific Class Names
import React, { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Star, Calendar, MapPin } from "lucide-react";
import "./PlannerReview.css";
import PlannerReviewVendor from "./ReviewComponents/PlannerReviewVendor.jsx";
import BASE_URL from "../../apiConfig";

export default function PlannerReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [vendorsByEvent, setVendorsByEvent] = useState({});
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [filter, setFilter] = useState("all"); // all, past, upcoming
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("events"); // events, reviews

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchEventsAndVendors();
        fetchPlannerReviews();
      }
    });
    
    return unsubscribe;
  }, []);

  const fetchEventsAndVendors = async () => {
    setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken(true);

      // Fetch all planner's events
      const eventsResponse = await fetch(
        `${BASE_URL}/planner/me/events`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!eventsResponse.ok) {
        throw new Error("Failed to fetch events");
      }

      const eventsData = await eventsResponse.json();
      const formattedEvents = (eventsData.events || []).map((event) => {
        const eventDate = event.date?._seconds
          ? new Date(event.date._seconds * 1000)
          : event.date
          ? new Date(event.date)
          : null;

        return {
          ...event,
          date: eventDate,
          isPast: eventDate ? eventDate < new Date() : false,
        };
      });

      setEvents(formattedEvents);

      // Fetch vendors and services for each event
      const vendorsMap = {};
      for (const event of formattedEvents) {
        try {
          // Get services for this event
          const servicesResponse = await fetch(
            `${BASE_URL}/planner/${event.id}/services`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (servicesResponse.ok) {
            const servicesData = await servicesResponse.json();
            const services = servicesData.services || [];

            // Group services by vendor
            const vendorServicesMap = {};
            services.forEach((service) => {
              if (!vendorServicesMap[service.vendorId]) {
                vendorServicesMap[service.vendorId] = {
                  vendorId: service.vendorId,
                  vendorName: service.vendorName,
                  services: [],
                };
              }
              vendorServicesMap[service.vendorId].services.push(
                service
              );
            });

            vendorsMap[event.id] = Object.values(vendorServicesMap);
          }
        } catch (err) {
          console.error(
            `Error fetching vendors for event ${event.id}:`,
            err
          );
          vendorsMap[event.id] = [];
        }
      }

      setVendorsByEvent(vendorsMap);
    } catch (err) {
      console.error("Error fetching events and vendors:", err);
      alert("Failed to load events and vendors");
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch planner's reviews
  const fetchPlannerReviews = async () => {
    setReviewsLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken(true);

      const response = await fetch(`${BASE_URL}/planner/my-reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      } else {
        console.error("Failed to fetch reviews");
      }
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleReviewVendor = (vendor, event) => {
    setSelectedVendor({
      ...vendor,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.date,
    });
    setShowReviewModal(true);
  };

  const handleReviewSubmitted = () => {
    setShowReviewModal(false);
    setSelectedVendor(null);
    alert("Thank you for your review!");
    fetchPlannerReviews();
  };

  const filteredEvents = events.filter((event) => {
    if (filter === "past") return event.isPast;
    if (filter === "upcoming") return !event.isPast;
    return true;
  });

  const formatDate = (date) => {
    if (!date) return "Date not set";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format review date
  const formatReviewDate = (timestamp) => {
    if (!timestamp) return "";
    
    let date;
    if (timestamp._seconds) {
      date = new Date(timestamp._seconds * 1000);
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Render star rating
  const renderRating = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if(i <= rating){
        stars.push(<Star/>);
      }
    }
    return <div className="planner-reviews-review-rating">{stars}</div>;
  };

  if (loading) {
    return (
      <section className="planner-reviews-loading">
        <section className="planner-reviews-spinner"></section>
        <p>Loading your events and vendors...</p>
      </section>
    );
  }

  return (
    <section className="planner-reviews-container">
      <header className="planner-reviews-header">
        <h1>Review Vendors</h1>
        <p>Share your experience with vendors from your events</p>
      </header>

      {/* Navigation Tabs */}
      <div className="planner-reviews-filter">
        <button
          className={`planner-reviews-filter-btn ${activeTab === "events" ? "active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          My Events
        </button>
        <button
          className={`planner-reviews-filter-btn ${activeTab === "reviews" ? "active" : ""}`}
          onClick={() => setActiveTab("reviews")}
        >
          My Reviews ({reviews.length})
        </button>
      </div>

      {/* Events Tab Content */}
      {activeTab === "events" && (
        <>
          <section className="planner-reviews-filter">
            <button
              className={`planner-reviews-filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All Events
            </button>
            <button
              className={`planner-reviews-filter-btn ${filter === "past" ? "active" : ""}`}
              onClick={() => setFilter("past")}
            >
              Past Events
            </button>
            <button
              className={`planner-reviews-filter-btn ${filter === "upcoming" ? "active" : ""}`}
              onClick={() => setFilter("upcoming")}
            >
              Upcoming Events
            </button>
          </section>

          <section className="planner-reviews-section-header">
            <h2>Events to Review</h2>
            <span className="planner-reviews-section-badge">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
            </span>
          </section>

          <section className="planner-reviews-events-list">
            {filteredEvents.length === 0 ? (
              <section className="planner-reviews-no-events">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                  />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <h3>No events found</h3>
                <p>
                  {filter === "past"
                    ? "You don't have any past events yet"
                    : filter === "upcoming"
                    ? "You don't have any upcoming events"
                    : "You haven't created any events yet"}
                </p>
              </section>
            ) : (
              filteredEvents.map((event) => {
                const eventVendors = vendorsByEvent[event.id] || [];

                return (
                  <section key={event.id} className="planner-reviews-event-card">
                    <section className="planner-reviews-event-header">
                      <section className="planner-reviews-event-info">
                        <h2>{event.name}</h2>
                        <p className="planner-reviews-event-date">
                          <Calendar size={14} />
                          {formatDate(event.date)}
                        </p>
                        <p className="planner-reviews-event-location">
                          <MapPin size={14} />
                          {event.location ||
                            "Location not set"}
                        </p>
                      </section>
                      <span
                        className={`planner-reviews-event-status ${event.isPast ? "past" : "upcoming"}`}
                      >
                        {event.isPast
                          ? "Past Event"
                          : "Upcoming Event"}
                      </span>
                    </section>

                    <section className="planner-reviews-vendors-section">
                      {eventVendors.length === 0 ? (
                        <p className="planner-reviews-no-vendors">
                          No vendors for this event
                        </p>
                      ) : (
                        <section className="planner-reviews-vendors-grid">
                          {eventVendors.map((vendor) => (
                            <section
                              key={vendor.vendorId}
                              className="planner-reviews-vendor-card"
                            >
                              <section className="planner-reviews-vendor-header">
                                <h4>
                                  {vendor.vendorName}
                                </h4>
                                <span className="planner-reviews-services-count">
                                  {
                                    vendor.services
                                      .length
                                  }{" "}
                                  service
                                  {vendor.services
                                    .length !== 1
                                    ? "s"
                                    : ""}
                                </span>
                              </section>

                              <section className="planner-reviews-vendor-services">
                                {vendor.services.map(
                                  (service) => (
                                    <section
                                      key={
                                        service.id
                                      }
                                      className="planner-reviews-service-item"
                                    >
                                      <span className="planner-reviews-service-name">
                                        {
                                          service.serviceName
                                        }
                                      </span>
                                      <span
                                        className={`planner-reviews-service-status ${service.status}`}
                                      >
                                        {
                                          service.status
                                        }
                                      </span>
                                    </section>
                                  )
                                )}
                              </section>

                              <button
                                className="planner-reviews-vendor-btn"
                                onClick={() => handleReviewVendor(vendor, event)}
                              >
                                <Star/>
                                Write Review
                              </button>
                            </section>
                          ))}
                        </section>
                      )}
                    </section>
                  </section>
                );
              })
            )}
          </section>
        </>
      )}

      {/* Reviews Tab Content */}
      {activeTab === "reviews" && (
        <section className="planner-reviews-user-reviews">
          <section className="planner-reviews-section-header">
            <h2>My Reviews</h2>
            <span className="planner-reviews-section-badge">
              {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </span>
          </section>
          
          {reviewsLoading ? (
            <section className="planner-reviews-loading">
              <section className="planner-reviews-spinner"></section>
              <p>Loading your reviews...</p>
            </section>
          ) : reviews.length === 0 ? (
            <section className="planner-reviews-empty-reviews">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <h3>No reviews yet</h3>
              <p>You haven't written any reviews yet. Start by reviewing vendors from your past events.</p>
            </section>
          ) : (
            <section className="planner-reviews-list">
              {reviews.map((review) => (
                <section key={review.id} className="planner-reviews-review-card">
                  <section className="planner-reviews-review-header">
                    <h3 className="planner-reviews-review-vendor-name">{review.serviceName || "Vendor"}</h3>
                    {renderRating(review.rating || 0)}
                  </section>
                  <p className="planner-reviews-review-text">
                    {review.review || "No review text provided."}
                  </p>
                  <p className="planner-reviews-review-date">
                    {formatReviewDate(review.createdAt || review.timeOfReview)}
                  </p>
                </section>
              ))}
            </section>
          )}
        </section>
      )}

      {showReviewModal && selectedVendor && (
        <PlannerReviewVendor
          vendorId={selectedVendor.vendorId}
          vendorName={selectedVendor.vendorName}
          eventId={selectedVendor.eventId}
          serviceName={
            selectedVendor.services[0]?.serviceName ||
            "Multiple Services"
          }
          onClose={() => {
            setShowReviewModal(false);
            setSelectedVendor(null);
          }}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
    </section>
  );
}