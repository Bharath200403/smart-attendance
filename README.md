# Smart Attendance System

This is a web application for managing student attendance, built with a React frontend and a Python (FastAPI) backend.

## Features

*   **Role-Based Access Control**: Different dashboards and permissions for Students, Faculty, Department Admins, College Admins, and University Admins.
*   **User Authentication**: Secure login for all user roles.
*   **Attendance Tracking**:
    *   Faculty can create and manage attendance sessions.
    *   Students can mark their attendance using QR codes.
    *   (Mock) Face recognition for attendance verification.
*   **Admin Dashboards**:
    *   University Admins can manage colleges.
    *   College Admins can manage departments and users.
    *   Department Admins can assign faculty to subjects.
*   **Attendance Analytics**: View attendance records and statistics.

## Tech Stack

*   **Frontend**:
    *   React
    *   React Router for navigation
    *   Axios for API communication
    *   Tailwind CSS for styling
    *   Radix UI for accessible components
*   **Backend**:
    *   FastAPI for the REST API
    *   MongoDB as the database (using `motor`)
    *   JWT for user authentication
    *   Uvicorn as the ASGI server

## Getting Started

### Prerequisites

*   Node.js and yarn/npm
*   Python 3.7+ and pip
*   MongoDB instance

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Bharath200403/smart-attendance.git
    cd smart-attendance/backend
    ```

2.  **Create a virtual environment and install dependencies:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    pip install -r requirements.txt
    ```

3.  **Configure environment variables:**
    Create a `.env` file in the `backend` directory and add the following:
    ```
    MONGO_URL=<your_mongodb_connection_string>
    DB_NAME=smart_attendance
    JWT_SECRET_KEY=<your_jwt_secret>
    CORS_ORIGINS=http://localhost:3000
    ```

4.  **Run the backend server:**
    ```bash
    uvicorn server:app --reload
    ```
    The API will be available at `http://localhost:8000`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../frontend
    ```

2.  **Install dependencies:**
    ```bash
    yarn install
    # or npm install
    ```

3.  **Start the development server:**
    ```bash
    yarn start
    # or npm start
    ```
    The application will be running at `http://localhost:3000`.