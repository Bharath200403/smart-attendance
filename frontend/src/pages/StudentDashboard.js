import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LogOut, Camera, QrCode, CheckCircle2 } from 'lucide-react';

function StudentDashboard({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [faceFile, setFaceFile] = useState(null);
  const [isFaceEnrolled, setIsFaceEnrolled] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [qrToken, setQrToken] = useState('');

  const token = localStorage.getItem('token');
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchData();
    checkFaceEnrollment();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionRes, attendanceRes] = await Promise.all([
        axios.get(`${API}/sessions`, config),
        axios.get(`${API}/attendance/records`, config)
      ]);
      
      // Only show active sessions
      const activeSessions = sessionRes.data.filter(s => s.is_active);
      setSessions(activeSessions);
      setMyAttendance(attendanceRes.data);
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

  const handleMarkAttendanceQR = async (sessionId) => {
    if (!qrToken) {
      toast.error('Please scan QR code or enter token');
      return;
    }

    try {
      await axios.post(`${API}/attendance/mark`, {
        session_id: sessionId,
        method: 'qr',
        qr_token: qrToken
      }, config);
      toast.success('Attendance marked successfully!');
      setQrToken('');
      setSelectedSession(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark attendance');
    }
  };

  const handleMarkAttendanceFace = async (sessionId) => {
    if (!faceFile) {
      toast.error('Please select a face image');
      return;
    }

    const formData = new FormData();
    formData.append('file', faceFile);

    try {
      // First verify face
      const verifyResponse = await axios.post(`${API}/face/verify`, formData, config);
      
      if (verifyResponse.data.verified) {
        // Then mark attendance
        await axios.post(`${API}/attendance/mark`, {
          session_id: sessionId,
          method: 'face'
        }, config);
        toast.success('Attendance marked successfully!');
        setFaceFile(null);
        setSelectedSession(null);
        fetchData();
      } else {
        toast.error('Face verification failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark attendance');
    }
  };

  const isAttendanceMarked = (sessionId) => {
    return myAttendance.some(a => a.session_id === sessionId);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text" data-testid="student-dashboard-title">Student Dashboard</h1>
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
              <p className="text-yellow-700 mb-4">Enroll your face to mark attendance using face recognition</p>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Upload Face Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    data-testid="student-face-upload-input"
                    onChange={(e) => setFaceFile(e.target.files[0])}
                  />
                </div>
                <Button onClick={handleEnrollFace} data-testid="student-enroll-face-btn">Enroll Face</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                My Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600" data-testid="attendance-count">{myAttendance.length}</p>
              <p className="text-sm text-gray-600 mt-1">Sessions attended</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-6 h-6 text-blue-600" />
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600" data-testid="active-sessions-count">{sessions.length}</p>
              <p className="text-sm text-gray-600 mt-1">Sessions available</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mark" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="mark" data-testid="mark-attendance-tab">Mark Attendance</TabsTrigger>
            <TabsTrigger value="history" data-testid="attendance-history-tab">My Attendance History</TabsTrigger>
          </TabsList>

          <TabsContent value="mark">
            <div className="attendance-grid">
              {sessions.map((session) => {
                const isMarked = isAttendanceMarked(session.id);
                return (
                  <Card key={session.id} className={isMarked ? 'border-green-400 bg-green-50' : ''} data-testid={`session-card-${session.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Session: {session.session_date}
                        {isMarked && (
                          <span className="ml-3 text-sm session-badge badge-active">Marked</span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <p className="text-sm"><span className="font-semibold">Type:</span> <span className={`session-badge ${session.session_type === 'morning' ? 'badge-morning' : 'badge-afternoon'}`}>{session.session_type}</span></p>
                        <p className="text-sm"><span className="font-semibold">Started:</span> {new Date(session.start_time).toLocaleTimeString()}</p>
                        
                        {!isMarked ? (
                          selectedSession === session.id ? (
                            <div className="space-y-3 mt-4">
                              <div>
                                <Label>Method 1: Scan QR Code</Label>
                                <div className="flex gap-2 mt-2">
                                  <Input
                                    placeholder="Enter QR token or scan"
                                    data-testid={`qr-token-input-${session.id}`}
                                    value={qrToken}
                                    onChange={(e) => setQrToken(e.target.value)}
                                  />
                                  <Button onClick={() => handleMarkAttendanceQR(session.id)} data-testid={`mark-qr-btn-${session.id}`}>
                                    <QrCode className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              {isFaceEnrolled && (
                                <div>
                                  <Label>Method 2: Face Recognition</Label>
                                  <div className="flex gap-2 mt-2">
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      data-testid={`face-input-${session.id}`}
                                      onChange={(e) => setFaceFile(e.target.files[0])}
                                    />
                                    <Button onClick={() => handleMarkAttendanceFace(session.id)} data-testid={`mark-face-btn-${session.id}`}>
                                      <Camera className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                              
                              <Button variant="outline" onClick={() => setSelectedSession(null)} className="w-full">Cancel</Button>
                            </div>
                          ) : (
                            <Button onClick={() => setSelectedSession(session.id)} className="w-full mt-4" data-testid={`select-session-btn-${session.id}`}>
                              Mark Attendance
                            </Button>
                          )
                        ) : (
                          <div className="bg-green-100 text-green-800 p-3 rounded-lg text-center mt-4">
                            Attendance already marked
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {sessions.length === 0 && (
                <div className="col-span-full">
                  <Card>
                    <CardContent className="py-12">
                      <p className="text-gray-500 text-center">No active sessions available</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>My Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {myAttendance.map((record) => (
                    <div key={record.id} className="p-4 bg-gray-50 rounded-lg" data-testid={`attendance-record-${record.id}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Session ID: {record.session_id.substring(0, 8)}...</p>
                          <p className="text-sm text-gray-600">Marked: {new Date(record.marked_at).toLocaleString()}</p>
                          <p className="text-sm text-gray-600">Method: <span className="session-badge badge-active">{record.method}</span></p>
                        </div>
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  ))}
                  {myAttendance.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No attendance records yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default StudentDashboard;
