import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LogOut, Plus, Users, BookOpen, GraduationCap, TrendingUp } from 'lucide-react';

function CollegeDashboard({ user, onLogout }) {
  const [departments, setDepartments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [newDepartment, setNewDepartment] = useState({ name: '', college_id: user.college_id });
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);

  const token = localStorage.getItem('token');
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [deptRes, facultyRes, studentRes, sessionRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/departments?college_id=${user.college_id}`, config),
        axios.get(`${API}/users?role=faculty`, config),
        axios.get(`${API}/users?role=student`, config),
        axios.get(`${API}/sessions`, config),
        axios.get(`${API}/attendance/analytics`, config)
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

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/departments`, newDepartment, config);
      toast.success('Department created successfully!');
      setNewDepartment({ name: '', college_id: user.college_id });
      setIsDeptDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create department');
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

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text" data-testid="college-dashboard-title">College Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome, {user.name}</p>
          </div>
          <Button onClick={onLogout} variant="outline" data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600" data-testid="departments-count">{departments.length}</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-purple-600" />
                Faculty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600" data-testid="faculty-count">{faculty.length}</p>
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
                <TrendingUp className="w-5 h-5 text-orange-600" />
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600" data-testid="sessions-count">{sessions.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="departments" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="departments" data-testid="departments-tab">Departments</TabsTrigger>
            <TabsTrigger value="faculty" data-testid="faculty-tab">Faculty</TabsTrigger>
            <TabsTrigger value="students" data-testid="students-tab">Students</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Departments</CardTitle>
                <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="add-department-btn">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Department</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateDepartment} className="space-y-4">
                      <div>
                        <Label>Department Name</Label>
                        <Input
                          data-testid="department-name-input"
                          value={newDepartment.name}
                          onChange={(e) => setNewDepartment({...newDepartment, name: e.target.value})}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" data-testid="create-department-submit">Create Department</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {departments.map((dept) => (
                    <div key={dept.id} className="p-4 bg-gray-50 rounded-lg" data-testid={`department-item-${dept.id}`}>
                      <p className="font-semibold text-lg">{dept.name}</p>
                    </div>
                  ))}
                  {departments.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No departments yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="faculty">
            <Card>
              <CardHeader>
                <CardTitle>Faculty Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {faculty.map((f) => (
                    <div key={f.id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center" data-testid={`faculty-item-${f.id}`}>
                      <div>
                        <p className="font-semibold">{f.name}</p>
                        <p className="text-sm text-gray-600">{f.email}</p>
                      </div>
                      <div className="flex gap-2">
                        {f.is_active ? (
                          <Button size="sm" variant="destructive" onClick={() => handleSuspendUser(f.id)} data-testid={`suspend-faculty-${f.id}`}>
                            Suspend
                          </Button>
                        ) : (
                          <Button size="sm" variant="default" onClick={() => handleActivateUser(f.id)} data-testid={`activate-faculty-${f.id}`}>
                            Activate
                          </Button>
                        )}
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
                <CardTitle>Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {students.map((s) => (
                    <div key={s.id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center" data-testid={`student-item-${s.id}`}>
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-sm text-gray-600">{s.email}</p>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {s.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  ))}
                  {students.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No students yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Analytics</CardTitle>
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
                        <p className="text-sm text-gray-600">Avg Attendance</p>
                        <p className="text-2xl font-bold text-purple-600" data-testid="avg-attendance">
                          {analytics.average_attendance_per_session.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    
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

export default CollegeDashboard;
