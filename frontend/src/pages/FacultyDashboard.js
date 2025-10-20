import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LogOut, Plus, QrCode, StopCircle } from 'lucide-react';

function FacultyDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [newSession, setNewSession] = useState({
    department_id: '',
    session_type: 'morning',
    session_date: new Date().toISOString().split('T')[0]
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [faceFile, setFaceFile] = useState(null);
  const [isFaceEnrolled, setIsFaceEnrolled] = useState(false);

  const token = localStorage.getItem('token');
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchData();
    checkFaceEnrollment();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionRes, deptRes] = await Promise.all([
        axios.get(`${API}/sessions`, config),
        axios.get(`${API}/departments`, config)
      ]);
      setSessions(sessionRes.data);
      setDepartments(deptRes.data);
      
      const active = sessionRes.data.find(s => s.is_active && s.faculty_id === user.id);
      setActiveSession(active);
    } catch (error) {
      toast.error('Failed to fetch data');
    }
  };

  const checkFaceEnrollment = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, config);
      setIsFaceEnrolled(!!response.data.face_embedding);
    } catch (error) {
      console.error('Failed to check face enrollment');
    }
  };

  const handleEnrollFace = async () => {
    if (!faceFile) {
      toast.error('Please select a face image');
      return;
    }

    const formData = new FormData();
    formData.append('file', faceFile);

    try {
      await axios.post(`${API}/face/enroll`, formData, config);
      toast.success('Face enrolled successfully!');
      setIsFaceEnrolled(true);
      setFaceFile(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Face enrollment failed');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    
    if (!isFaceEnrolled) {
      toast.error('Please enroll your face before starting a session');
      return;
    }

    try {
      await axios.post(`${API}/sessions`, newSession, config);
      toast.success('Session created successfully!');
      setNewSession({
        department_id: '',
        session_type: 'morning',
        session_date: new Date().toISOString().split('T')[0]
      });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create session');
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      await axios.put(`${API}/sessions/${sessionId}/end`, {}, config);
      toast.success('Session ended successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to end session');
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text" data-testid="faculty-dashboard-title">Faculty Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome, {user.name}</p>
          </div>
          <Button onClick={onLogout} variant="outline" data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {!isFaceEnrolled && (
          <Card className="mb-6 border-yellow-400 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-800">Face Enrollment Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-yellow-700 mb-4">Please enroll your face to start attendance sessions</p>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Upload Face Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    data-testid="face-upload-input"
                    onChange={(e) => setFaceFile(e.target.files[0])}
                  />
                </div>
                <Button onClick={handleEnrollFace} data-testid="enroll-face-btn">Enroll Face</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSession && (
          <Card className="mb-6 border-green-400 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800">Active Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="space-y-2">
                    <p><span className="font-semibold">Session Type:</span> <span className="session-badge badge-morning">{activeSession.session_type}</span></p>
                    <p><span className="font-semibold">Date:</span> {activeSession.session_date}</p>
                    <p><span className="font-semibold">Started:</span> {new Date(activeSession.start_time).toLocaleTimeString()}</p>
                  </div>
                  <Button 
                    onClick={() => handleEndSession(activeSession.id)} 
                    variant="destructive" 
                    className="mt-4"
                    data-testid="end-session-btn"
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    End Session
                  </Button>
                </div>
                {activeSession.qr_code && (
                  <div className="qr-container">
                    <p className="font-semibold">Scan QR to Mark Attendance</p>
                    <img src={activeSession.qr_code} alt="QR Code" className="w-64 h-64" data-testid="session-qr-code" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Sessions</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="create-session-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Session</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <div>
                    <Label>Department</Label>
                    <select
                      className="input-field"
                      data-testid="session-department-select"
                      value={newSession.department_id}
                      onChange={(e) => setNewSession({...newSession, department_id: e.target.value})}
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Session Type</Label>
                    <Select onValueChange={(value) => setNewSession({...newSession, session_type: value})} defaultValue="morning">
                      <SelectTrigger data-testid="session-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Session Date</Label>
                    <Input
                      type="date"
                      data-testid="session-date-input"
                      value={newSession.session_date}
                      onChange={(e) => setNewSession({...newSession, session_date: e.target.value})}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" data-testid="create-session-submit">Create Session</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="p-4 bg-gray-50 rounded-lg" data-testid={`session-item-${session.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">Session Date: {session.session_date}</p>
                      <p className="text-sm text-gray-600">Type: <span className={`session-badge ${session.session_type === 'morning' ? 'badge-morning' : 'badge-afternoon'}`}>{session.session_type}</span></p>
                      <p className="text-sm text-gray-600">Started: {new Date(session.start_time).toLocaleString()}</p>
                      {session.end_time && (
                        <p className="text-sm text-gray-600">Ended: {new Date(session.end_time).toLocaleString()}</p>
                      )}
                    </div>
                    <span className={`session-badge ${session.is_active ? 'badge-active' : 'badge-inactive'}`}>
                      {session.is_active ? 'Active' : 'Ended'}
                    </span>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-gray-500 text-center py-8">No sessions yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default FacultyDashboard;
