import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LogOut, Users, GraduationCap, Calendar, TrendingUp, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';

function DepartmentDashboard({ user, onLogout }) {
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');

  const token = localStorage.getItem('token');
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedSection]);

  const fetchData = async () => {
    try {
      const yearParam = selectedYear !== 'all' ? `&year=${selectedYear}` : '';
      const sectionParam = selectedSection !== 'all' ? `&section=${selectedSection}` : '';
      
      const [deptRes, facultyRes, studentRes, sessionRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/departments`, config),
        axios.get(`${API}/users?role=faculty&department_id=${user.department_id}`, config),
        axios.get(`${API}/users?role=student&department_id=${user.department_id}${yearParam}${sectionParam}`, config),
        axios.get(`${API}/sessions?department_id=${user.department_id}${yearParam}${sectionParam}`, config),
        axios.get(`${API}/attendance/analytics?department_id=${user.department_id}${yearParam}${sectionParam}`, config)
      ]);
      
      setDepartments(deptRes.data);
      setFaculty(facultyRes.data);
      setStudents(studentRes.data);
      setSessions(sessionRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    }
  };

  const handleSuspendUser = async (userId) => {
    try {
      await axios.put(`${API}/users/${userId}/suspend`, {}, config);
      toast.success('User suspended successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to suspend user');
    }
  };

  const handleActivateUser = async (userId) => {
    try {
      await axios.put(`${API}/users/${userId}/activate`, {}, config);
      toast.success('User activated successfully!');
      fetchData();
    } catch (error) {
      toast.error('Failed to activate user');
    }
  };

  const currentDept = departments.find(d => d.id === user.department_id);
  const availableYears = currentDept?.years || ['1st', '2nd', '3rd', '4th'];
  const availableSections = currentDept?.sections || ['A', 'B', 'C'];

  // Calculate faculty performance
  const facultyPerformance = faculty.map(f => {
    const facultySessions = sessions.filter(s => s.faculty_id === f.id);
    return {
      ...f,
      sessionCount: facultySessions.length,
      activeSession: facultySessions.find(s => s.is_active)
    };
  });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text" data-testid="department-dashboard-title">Department Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome, {user.name}</p>
            {currentDept && <p className="text-sm text-gray-500">Department: {currentDept.name}</p>}
          </div>
          <Button onClick={onLogout} variant="outline" data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Filter by Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger data-testid="year-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year} Year</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Filter by Section</Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger data-testid="section-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {availableSections.map(section => (
                      <SelectItem key={section} value={section}>Section {section}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={fetchData} data-testid="apply-filter-btn">Apply Filters</Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-blue-600" />
                Faculty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600" data-testid="faculty-count">{faculty.length}</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="w-5 h-5 text-green-600" />
                Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600" data-testid="students-count">{students.length}</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5 text-purple-600" />
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600" data-testid="sessions-count">{sessions.length}</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                Avg Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600" data-testid="avg-attendance">
                {analytics?.average_attendance_per_session?.toFixed(1) || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="faculty" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="faculty" data-testid="faculty-tab">Faculty Management</TabsTrigger>
            <TabsTrigger value="students" data-testid="students-tab">Student Management</TabsTrigger>
            <TabsTrigger value="sessions" data-testid="sessions-tab">Sessions</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="faculty">
            <Card>
              <CardHeader>
                <CardTitle>Faculty Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {facultyPerformance.map((f) => (
                    <div key={f.id} className="p-4 bg-gray-50 rounded-lg" data-testid={`faculty-item-${f.id}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{f.name}</p>
                          <p className="text-sm text-gray-600">{f.email}</p>
                          {f.subject && <p className="text-sm text-blue-600">Subject: {f.subject}</p>}
                          <div className="flex gap-4 mt-2">
                            <span className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                              Sessions: {f.sessionCount}
                            </span>
                            {f.activeSession && (
                              <span className="text-xs px-3 py-1 bg-green-100 text-green-800 rounded-full">
                                Active Session
                              </span>
                            )}
                            <span className={`text-xs px-3 py-1 rounded-full ${f.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {f.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {f.is_active ? (
                            <Button size="sm" variant="destructive" onClick={() => handleSuspendUser(f.id)} data-testid={`suspend-faculty-${f.id}`}>
                              Suspend
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => handleActivateUser(f.id)} data-testid={`activate-faculty-${f.id}`}>
                              Activate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {faculty.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No faculty members yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle>Student List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {students.map((s) => {
                    const studentAttendance = analytics?.student_stats?.[s.id] || 0;
                    const attendancePercentage = analytics?.total_sessions > 0 
                      ? ((studentAttendance / analytics.total_sessions) * 100).toFixed(1)
                      : 0;
                    const isLowAttendance = parseFloat(attendancePercentage) < 75;

                    return (
                      <div key={s.id} className={`p-4 rounded-lg ${isLowAttendance ? 'bg-red-50 border-2 border-red-200' : 'bg-gray-50'}`} data-testid={`student-item-${s.id}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="font-semibold text-lg">{s.name}</p>
                            <p className="text-sm text-gray-600">{s.email}</p>
                            <div className="flex gap-4 mt-2">
                              <span className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                                {s.year} Year - Section {s.section}
                              </span>
                              <span className={`text-xs px-3 py-1 rounded-full ${
                                isLowAttendance ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                                Attendance: {attendancePercentage}% ({studentAttendance}/{analytics?.total_sessions || 0})
                              </span>
                              {isLowAttendance && (
                                <span className="text-xs px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                                  ⚠️ Low Attendance Alert
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {s.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No students found for selected filters</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>Department Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions.map((session) => {
                    const sessionFaculty = faculty.find(f => f.id === session.faculty_id);
                    return (
                      <div key={session.id} className="p-4 bg-gray-50 rounded-lg" data-testid={`session-item-${session.id}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">Session Date: {session.session_date}</p>
                            <p className="text-sm text-gray-600">Faculty: {sessionFaculty?.name || 'Unknown'}</p>
                            {session.subject && <p className="text-sm text-gray-600">Subject: {session.subject}</p>}
                            <p className="text-sm text-gray-600">
                              Type: <span className={`session-badge ${session.session_type === 'morning' ? 'badge-morning' : 'badge-afternoon'}`}>
                                {session.session_type}
                              </span>
                            </p>
                            {session.year && session.section && (
                              <p className="text-sm text-gray-600">Class: {session.year} Year - Section {session.section}</p>
                            )}
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
                    );
                  })}
                  {sessions.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No sessions found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Department Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics ? (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-600">Total Sessions</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="total-sessions">{analytics.total_sessions}</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-gray-600">Total Attendance</p>
                        <p className="text-2xl font-bold text-green-600" data-testid="total-attendance">{analytics.total_attendance}</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm text-gray-600">Average Attendance</p>
                        <p className="text-2xl font-bold text-purple-600" data-testid="analytics-avg-attendance">
                          {analytics.average_attendance_per_session.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    {analytics.low_attendance_students && analytics.low_attendance_students.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3 text-red-600">⚠️ Students with Low Attendance (&lt;75%)</h3>
                        <div className="space-y-2">
                          {analytics.low_attendance_students.map((student, idx) => (
                            <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200" data-testid={`low-attendance-student-${idx}`}>
                              <p className="font-semibold">{student.name}</p>
                              <p className="text-sm text-red-700">
                                Attendance: {student.attendance}/{analytics.total_sessions} ({student.percentage}%)
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="font-semibold mb-3">AI Insights</h3>
                      <div className="space-y-2">
                        {analytics.insights.map((insight, idx) => (
                          <div key={idx} className={`p-3 rounded-lg ${
                            insight.type === 'success' ? 'bg-green-50 text-green-800' :
                            insight.type === 'warning' ? 'bg-yellow-50 text-yellow-800' :
                            'bg-blue-50 text-blue-800'
                          }`} data-testid={`insight-${idx}`}>
                            {insight.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Loading analytics...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default DepartmentDashboard;
