import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { LogOut, Plus, Building2, School } from 'lucide-react';

function UniversityDashboard({ user, onLogout }) {
  const [universities, setUniversities] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [newUniversity, setNewUniversity] = useState({ name: '', address: '' });
  const [newCollege, setNewCollege] = useState({ name: '', university_id: '' });
  const [isUniDialogOpen, setIsUniDialogOpen] = useState(false);
  const [isCollegeDialogOpen, setIsCollegeDialogOpen] = useState(false);

  const token = localStorage.getItem('token');
  const config = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uniRes, collegeRes] = await Promise.all([
        axios.get(`${API}/universities`, config),
        axios.get(`${API}/colleges`, config)
      ]);
      setUniversities(uniRes.data);
      setColleges(collegeRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    }
  };

  const handleCreateUniversity = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/universities`, newUniversity, config);
      toast.success('University created successfully!');
      setNewUniversity({ name: '', address: '' });
      setIsUniDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create university');
    }
  };

  const handleCreateCollege = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/colleges`, newCollege, config);
      toast.success('College created successfully!');
      setNewCollege({ name: '', university_id: '' });
      setIsCollegeDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to create college');
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text" data-testid="dashboard-title">University Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome, {user.name}</p>
          </div>
          <Button onClick={onLogout} variant="outline" data-testid="logout-btn">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" />
                Universities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600" data-testid="universities-count">{universities.length}</p>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="w-6 h-6 text-purple-600" />
                Colleges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600" data-testid="colleges-count">{colleges.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Universities</CardTitle>
              <Dialog open={isUniDialogOpen} onOpenChange={setIsUniDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="add-university-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add University
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New University</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateUniversity} className="space-y-4">
                    <div>
                      <Label>University Name</Label>
                      <Input
                        data-testid="university-name-input"
                        value={newUniversity.name}
                        onChange={(e) => setNewUniversity({...newUniversity, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input
                        data-testid="university-address-input"
                        value={newUniversity.address}
                        onChange={(e) => setNewUniversity({...newUniversity, address: e.target.value})}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" data-testid="create-university-submit">Create University</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {universities.map((uni) => (
                  <div key={uni.id} className="p-3 bg-gray-50 rounded-lg" data-testid={`university-item-${uni.id}`}>
                    <p className="font-semibold">{uni.name}</p>
                    <p className="text-sm text-gray-600">{uni.address}</p>
                  </div>
                ))}
                {universities.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No universities yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Colleges</CardTitle>
              <Dialog open={isCollegeDialogOpen} onOpenChange={setIsCollegeDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="add-college-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add College
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New College</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateCollege} className="space-y-4">
                    <div>
                      <Label>College Name</Label>
                      <Input
                        data-testid="college-name-input"
                        value={newCollege.name}
                        onChange={(e) => setNewCollege({...newCollege, name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>University</Label>
                      <select
                        data-testid="college-university-select"
                        className="input-field"
                        value={newCollege.university_id}
                        onChange={(e) => setNewCollege({...newCollege, university_id: e.target.value})}
                        required
                      >
                        <option value="">Select University</option>
                        {universities.map((uni) => (
                          <option key={uni.id} value={uni.id}>{uni.name}</option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" className="w-full" data-testid="create-college-submit">Create College</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {colleges.map((college) => (
                  <div key={college.id} className="p-3 bg-gray-50 rounded-lg" data-testid={`college-item-${college.id}`}>
                    <p className="font-semibold">{college.name}</p>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      {college.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                ))}
                {colleges.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No colleges yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default UniversityDashboard;
