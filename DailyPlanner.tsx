import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  CheckCircle2, 
  Circle, 
  Dumbbell, 
  Coffee, 
  Briefcase, 
  Moon, 
  Sun, 
  Plus, 
  Trash2, 
  RefreshCw,
  Zap,
  Battery,
  BatteryCharging,
  BatteryFull
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query 
} from 'firebase/firestore';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Types ---
type TaskType = 'work' | 'health' | 'break' | 'routine';

interface Task {
  id: string;
  title: string;
  time: string;
  completed: boolean;
  type: TaskType;
  duration?: number; // in minutes
}

interface DayPlan {
  date: string;
  tasks: Task[];
  energyLevel: 'low' | 'medium' | 'high';
  workoutMode: boolean;
}

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const defaultTasks: Task[] = [
  { id: '1', time: '08:00', title: 'Wake up & Hydrate', completed: false, type: 'routine', duration: 30 },
  { id: '2', time: '09:00', title: 'Deep Work Session (Eat the Frog)', completed: false, type: 'work', duration: 90 },
  { id: '3', time: '10:30', title: 'Short Break', completed: false, type: 'break', duration: 15 },
  { id: '4', time: '12:30', title: 'Lunch', completed: false, type: 'break', duration: 60 },
  { id: '5', time: '14:00', title: 'Admin & Low Energy Tasks', completed: false, type: 'work', duration: 60 },
  { id: '6', time: '18:00', title: 'Wind Down', completed: false, type: 'routine', duration: 60 },
];

const workoutTasks: Task[] = [
  { id: 'w1', time: '07:30', title: 'Morning Jog / HIIT', completed: false, type: 'health', duration: 30 },
  { id: 'w2', time: '17:30', title: 'Gym Session', completed: false, type: 'health', duration: 60 },
];

const lightMovementTasks: Task[] = [
  { id: 'l1', time: '07:45', title: 'Light Stretching', completed: false, type: 'health', duration: 15 },
  { id: 'l2', time: '15:00', title: '10-min Walk', completed: false, type: 'health', duration: 10 },
];

// --- Main Component ---
export default function DailyPlanner() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [activeTimer, setActiveTimer] = useState<string | null>(null); // Task ID
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth failed", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching / Sync
  useEffect(() => {
    if (!user) return;

    const today = getTodayDateString();
    const planRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_plans', today);

    const unsubscribe = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        setPlan(docSnap.data() as DayPlan);
      } else {
        // Initialize default plan if none exists
        const initialPlan: DayPlan = {
          date: today,
          tasks: defaultTasks,
          energyLevel: 'medium',
          workoutMode: false,
        };
        setDoc(planRef, initialPlan); // Optimistic set
        setPlan(initialPlan);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Timer Logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      // Optional: Sound or notification here
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isTimerRunning]);

  // --- Handlers ---

  const updatePlan = async (newPlan: DayPlan) => {
    setPlan(newPlan); // Optimistic update
    if (!user) return;
    const planRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_plans', newPlan.date);
    await setDoc(planRef, newPlan);
  };

  const toggleTask = (taskId: string) => {
    if (!plan) return;
    const updatedTasks = plan.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    updatePlan({ ...plan, tasks: updatedTasks });
  };

  const deleteTask = (taskId: string) => {
    if (!plan) return;
    const updatedTasks = plan.tasks.filter(t => t.id !== taskId);
    updatePlan({ ...plan, tasks: updatedTasks });
  };

  const addTask = () => {
    if (!plan) return;
    const newTask: Task = {
      id: generateId(),
      time: '12:00',
      title: 'New Goal',
      completed: false,
      type: 'work',
      duration: 30
    };
    updatePlan({ ...plan, tasks: [...plan.tasks, newTask] });
  };

  const handleEnergyChange = (level: 'low' | 'medium' | 'high') => {
    if (!plan) return;
    updatePlan({ ...plan, energyLevel: level });
  };

  const toggleWorkoutMode = () => {
    if (!plan) return;
    const newMode = !plan.workoutMode;
    let newTasks = [...plan.tasks];

    // Remove existing health tasks generated by the system (keeping user custom ones is tricky, 
    // so for simplicity we remove known IDs or type 'health' if we want strict mode. 
    // Let's just filter out the specific ones we add to avoid deleting user custom health tasks)
    const healthIds = [...workoutTasks, ...lightMovementTasks].map(t => t.id);
    newTasks = newTasks.filter(t => !healthIds.includes(t.id));

    if (newMode) {
      // Add heavy workouts
      newTasks = [...newTasks, ...workoutTasks];
    } else {
      // Add light movement
      newTasks = [...newTasks, ...lightMovementTasks];
    }
    
    // Sort by time
    newTasks.sort((a, b) => a.time.localeCompare(b.time));

    updatePlan({ ...plan, workoutMode: newMode, tasks: newTasks });
  };

  const startTimer = (task: Task) => {
    if (activeTimer === task.id && isTimerRunning) {
      setIsTimerRunning(false);
    } else {
      setActiveTimer(task.id);
      setTimeLeft((task.duration || 25) * 60);
      setIsTimerRunning(true);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- Render Helpers ---

  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case 'work': return <Briefcase className="w-5 h-5 text-blue-500" />;
      case 'health': return <Dumbbell className="w-5 h-5 text-green-500" />;
      case 'break': return <Coffee className="w-5 h-5 text-orange-400" />;
      case 'routine': return <Sun className="w-5 h-5 text-purple-400" />;
      default: return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getCompletionPercentage = () => {
    if (!plan || plan.tasks.length === 0) return 0;
    const completed = plan.tasks.filter(t => t.completed).length;
    return Math.round((completed / plan.tasks.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-600 fill-current" />
              Focus & Flow
            </h1>
            <p className="text-xs text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
               <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Productivity</div>
               <div className="text-indigo-600 font-bold">{getCompletionPercentage()}%</div>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center relative overflow-hidden">
               <div 
                 className="absolute bottom-0 left-0 w-full bg-indigo-500 transition-all duration-500"
                 style={{ height: `${getCompletionPercentage()}%`, opacity: 0.2 }}
               />
               <span className="relative z-10 font-bold text-sm">{plan?.tasks.filter(t => t.completed).length}</span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* 1. Daily Setup Card */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-800">Start the Day</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Energy Level */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Current Energy Level</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => handleEnergyChange(level)}
                    className={`flex-1 flex items-center justify-center py-2 rounded-md text-sm font-medium transition-all ${
                      plan?.energyLevel === level 
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {level === 'low' && <Battery className="w-4 h-4 mr-1" />}
                    {level === 'medium' && <BatteryCharging className="w-4 h-4 mr-1" />}
                    {level === 'high' && <BatteryFull className="w-4 h-4 mr-1" />}
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Workout Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Physical Activity</label>
              <button
                onClick={toggleWorkoutMode}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                  plan?.workoutMode 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${plan?.workoutMode ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">{plan?.workoutMode ? "Let's work out!" : "Maybe later..."}</div>
                    <div className="text-xs opacity-75">{plan?.workoutMode ? "Gym/HIIT tasks added" : "Light stretching only"}</div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${plan?.workoutMode ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                   <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${plan?.workoutMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* 2. The Timeline */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Your Schedule</h2>
            <button onClick={addTask} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>

          <div className="space-y-3">
            {plan?.tasks.map((task, index) => (
              <div 
                key={task.id} 
                className={`group relative flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  task.completed 
                    ? 'bg-slate-50 border-slate-100 opacity-60' 
                    : 'bg-white border-slate-200 shadow-sm hover:border-indigo-200'
                }`}
              >
                {/* Time Column */}
                <div className="flex-shrink-0 w-16 pt-1">
                   <input 
                      type="time" 
                      value={task.time}
                      onChange={(e) => {
                        const newTasks = [...(plan?.tasks || [])];
                        newTasks[index].time = e.target.value;
                        newTasks.sort((a, b) => a.time.localeCompare(b.time));
                        updatePlan({ ...plan!, tasks: newTasks });
                      }}
                      className="bg-transparent text-sm font-semibold text-slate-500 focus:outline-none focus:text-indigo-600"
                   />
                </div>

                {/* Checkbox */}
                <button 
                  onClick={() => toggleTask(task.id)}
                  className="mt-1 flex-shrink-0 text-slate-300 hover:text-indigo-500 transition-colors"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50" />
                  ) : (
                    <Square className="w-6 h-6 rounded-md" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getTaskIcon(task.type)}
                    <input 
                      type="text"
                      value={task.title}
                      onChange={(e) => {
                        const newTasks = [...(plan?.tasks || [])];
                        newTasks[index].title = e.target.value;
                        updatePlan({ ...plan!, tasks: newTasks });
                      }}
                      className={`bg-transparent w-full font-medium focus:outline-none ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}
                    />
                  </div>
                  
                  {/* Action Bar */}
                  <div className={`flex items-center gap-4 mt-2 transition-all duration-300 ${task.completed ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}>
                    {/* Timer Button */}
                    <button 
                      onClick={() => startTimer(task)}
                      className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                        activeTimer === task.id && isTimerRunning 
                        ? 'bg-red-50 text-red-600 ring-1 ring-red-200' 
                        : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                      }`}
                    >
                       {activeTimer === task.id && isTimerRunning ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                       {activeTimer === task.id ? formatTime(timeLeft) : `${task.duration || 30}m focus`}
                    </button>
                  </div>
                </div>

                {/* Delete Button (Hover) */}
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {plan?.tasks.length === 0 && (
              <div className="text-center py-10 text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-300">
                No tasks for today. Add one above!
              </div>
            )}
          </div>
        </section>

        {/* 3. Anti-Laziness Stats */}
        <section className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
           <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl"></div>
           <div className="relative z-10">
             <h3 className="font-bold text-indigo-100 mb-4 flex items-center gap-2">
               <RefreshCw className="w-4 h-4" /> Daily Reflection
             </h3>
             <div className="grid grid-cols-2 gap-8">
               <div>
                 <div className="text-3xl font-bold mb-1">{getCompletionPercentage()}%</div>
                 <div className="text-xs text-indigo-300">Laziness Defeated</div>
               </div>
               <div>
                  <div className="text-3xl font-bold mb-1">
                    {plan?.tasks.filter(t => t.completed && t.type === 'health').length}
                  </div>
                  <div className="text-xs text-indigo-300">Healthy Actions</div>
               </div>
             </div>
             
             {getCompletionPercentage() === 100 && (
               <div className="mt-6 bg-white/10 rounded-lg p-3 text-sm text-indigo-100 text-center animate-pulse">
                 You are an absolute machine today!
               </div>
             )}
           </div>
        </section>

      </main>
    </div>
  );
}
