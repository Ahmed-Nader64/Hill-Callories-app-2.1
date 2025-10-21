import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, TrendingUp, Loader2, Target, Calculator, AlertCircle, CheckCircle } from 'lucide-react';
import { format, startOfDay, startOfMonth, startOfYear, endOfDay, endOfMonth, endOfYear } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

interface MealAnalysis {
  id: string;
  image_url: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  food_items: Json;
  analyzed_at: string;
}

interface CalorieGoal {
  id: string;
  bmr: number;
  tdee: number;
  maintenance_calories: number;
  weight_loss_calories: number;
  weight_gain_calories: number;
  goal_type: string;
  protein_goal?: number | null;
  carbs_goal?: number | null;
  fat_goal?: number | null;
  created_at: string;
}

interface NutritionSummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
  dailyGoal?: number;
  goalType?: string;
  goalStatus?: 'under' | 'over' | 'met';
}

const History = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<MealAnalysis[]>([]);
  const [calorieGoals, setCalorieGoals] = useState<CalorieGoal[]>([]);
  const [currentGoal, setCurrentGoal] = useState<CalorieGoal | null>(null);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editedCalories, setEditedCalories] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showCustomGoal, setShowCustomGoal] = useState(false);
  const [customCalories, setCustomCalories] = useState('');
  const [isSavingCustomGoal, setIsSavingCustomGoal] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);
      await Promise.all([fetchMeals(), fetchCalorieGoals()]);
    } catch (error) {
      console.error('Error in checkUser:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('meal_analyses')
        .select('*')
        .order('analyzed_at', { ascending: false });

      if (error) {
        console.error('Error fetching meals:', error);
        throw error;
      }
      setMeals(data || []);
    } catch (error: any) {
      console.error('Fetch meals error:', error);
      setMeals([]); // Set empty array on error
      toast({
        title: "Error loading history",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchCalorieGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('calorie_goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching calorie goals:', error);
        throw error;
      }
          setCalorieGoals(data || []);
          
          // Set the most recent goal as current only if there are actual goals with valid calorie values
          if (data && data.length > 0 && data[0].id && data[0].maintenance_calories > 0) {
            setCurrentGoal(data[0]);
          } else {
            setCurrentGoal(null);
          }
    } catch (error: any) {
      console.error('Database fetch failed, trying localStorage:', error);
      // Fallback to localStorage
      try {
        const localGoals = JSON.parse(localStorage.getItem('calorie_goals') || '[]');
        setCalorieGoals(localGoals);
        
        if (localGoals.length > 0 && localGoals[0].id && localGoals[0].maintenance_calories > 0) {
          // Sort by created_at and get the most recent
          const sortedGoals = localGoals.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setCurrentGoal(sortedGoals[0]);
        } else {
          setCurrentGoal(null);
        }
      } catch (localError) {
        console.error('Error loading from localStorage:', localError);
        setCalorieGoals([]);
        setCurrentGoal(null);
      }
    }
  };

  const saveEditedCalorieGoal = async () => {
    if (!currentGoal || !editedCalories || isNaN(Number(editedCalories)) || Number(editedCalories) <= 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid calorie goal.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      const updatedGoal = {
        ...currentGoal,
        // Only update weight loss and weight gain, keep maintenance unchanged
        weight_loss_calories: Number(editedCalories),
        weight_gain_calories: Number(editedCalories),
        goal_type: 'custom', // Mark as custom since it's been edited
      };

      // Try to save to database first
      try {
        const { error } = await supabase
          .from('calorie_goals')
          .update({
            weight_loss_calories: Number(editedCalories),
            weight_gain_calories: Number(editedCalories),
            goal_type: 'custom',
          })
          .eq('id', currentGoal.id);

        if (error) {
          throw error;
        }
      } catch (dbError) {
        // Fallback to localStorage
        const localGoals = JSON.parse(localStorage.getItem('calorie_goals') || '[]');
        const updatedGoals = localGoals.map((goal: any) => 
          goal.id === currentGoal.id 
            ? updatedGoal
            : goal
        );
        localStorage.setItem('calorie_goals', JSON.stringify(updatedGoals));
      }

      setCurrentGoal(updatedGoal);
      setCalorieGoals(prev => prev.map(goal => goal.id === currentGoal.id ? updatedGoal : goal));
      setIsEditingGoal(false);
      setEditedCalories('');
      
      toast({
        title: "Goal Updated!",
        description: `Your calorie goal has been updated to ${editedCalories} calories.`,
      });
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update calorie goal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const saveCustomCalorieGoal = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your calorie goal.",
      });
      navigate('/auth');
      return;
    }

    if (!customCalories || isNaN(Number(customCalories)) || Number(customCalories) <= 0) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid calorie goal.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingCustomGoal(true);
    try {
      const goalData = {
        id: `custom_goal_${Date.now()}`,
        user_id: user.id,
        bmr: 0, // Not calculated for custom goals
        tdee: 0, // Not calculated for custom goals
        maintenance_calories: Number(customCalories),
        weight_loss_calories: Number(customCalories),
        weight_gain_calories: Number(customCalories),
        age: 0, // Not required for custom goals
        weight: 0, // Not required for custom goals
        height: 0, // Not required for custom goals
        gender: 'custom',
        activity_level: 0, // Not required for custom goals
        unit_system: 'custom',
        goal_type: 'custom',
        protein_goal: null,
        carbs_goal: null,
        fat_goal: null,
        created_at: new Date().toISOString()
      };

      // Try to save to database first
      try {
        const { data, error } = await supabase
          .from('calorie_goals')
          .insert([goalData])
          .select();

        if (error) {
          throw error;
        }
      } catch (dbError) {
        // Fallback to localStorage
        const existingGoals = JSON.parse(localStorage.getItem('calorie_goals') || '[]');
        existingGoals.push(goalData);
        localStorage.setItem('calorie_goals', JSON.stringify(existingGoals));
      }

      setCurrentGoal(goalData);
      setCalorieGoals(prev => [goalData, ...prev]);
      setShowCustomGoal(false);
      setCustomCalories('');
      
      toast({
        title: "Custom Goal Saved!",
        description: `Your custom calorie goal of ${customCalories} calories has been set.`,
      });
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save custom calorie goal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCustomGoal(false);
    }
  };

  const calculateSummary = useCallback((startDate: Date, endDate: Date): NutritionSummary => {
    const filteredMeals = meals.filter(meal => {
      const mealDate = new Date(meal.analyzed_at);
      return mealDate >= startDate && mealDate <= endDate;
    });

    const summary = filteredMeals.reduce(
      (acc, meal) => ({
        totalCalories: acc.totalCalories + Number(meal.calories),
        totalProtein: acc.totalProtein + Number(meal.protein),
        totalCarbs: acc.totalCarbs + Number(meal.carbs),
        totalFat: acc.totalFat + Number(meal.fat),
        mealCount: acc.mealCount + 1,
      }),
      { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, mealCount: 0 }
    );

    // Add goal information if available
    if (currentGoal) {
      const goalCalories = currentGoal.goal_type === 'maintenance' 
        ? currentGoal.maintenance_calories
        : currentGoal.goal_type === 'weight_loss'
        ? currentGoal.weight_loss_calories
        : currentGoal.weight_gain_calories;

      summary.dailyGoal = goalCalories;
      summary.goalType = currentGoal.goal_type;
      
      // Determine goal status
      if (summary.totalCalories < goalCalories * 0.9) {
        summary.goalStatus = 'under';
      } else if (summary.totalCalories > goalCalories * 1.1) {
        summary.goalStatus = 'over';
      } else {
        summary.goalStatus = 'met';
      }
    }

    return summary;
  }, [meals, currentGoal]);

  const now = new Date();
  const dailySummary = useMemo(() => calculateSummary(startOfDay(now), endOfDay(now)), [calculateSummary, now]);
  const monthlySummary = useMemo(() => calculateSummary(startOfMonth(now), endOfMonth(now)), [calculateSummary, now]);
  const yearlySummary = useMemo(() => calculateSummary(startOfYear(now), endOfYear(now)), [calculateSummary, now]);

  const SummaryCard = ({ title, summary, icon }: { title: string; summary: NutritionSummary; icon: React.ReactNode }) => (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      
      {/* Goal Status Banner */}
      {summary.dailyGoal && (
        <div className={`p-3 rounded-lg border ${
          summary.goalStatus === 'met' 
            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
            : summary.goalStatus === 'under'
            ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
            : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {summary.goalStatus === 'met' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {summary.goalStatus === 'met' 
                  ? 'Goal Met!'
                  : summary.goalStatus === 'under'
                  ? 'Under Goal'
                  : 'Over Goal'
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(summary.totalCalories)} / {Math.round(summary.dailyGoal)} calories
                {summary.goalType && ` (${summary.goalType.replace('_', ' ')})`}
              </p>
            </div>
            <Badge variant={summary.goalStatus === 'met' ? 'default' : 'secondary'}>
              {Math.round((summary.totalCalories / summary.dailyGoal) * 100)}%
            </Badge>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Meals</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold">{summary.mealCount}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Calories</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold">{Math.round(summary.totalCalories)}</p>
          {summary.dailyGoal && (
            <p className="text-xs text-muted-foreground">
              Goal: {Math.round(summary.dailyGoal)}
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Protein</p>
          <p className="text-base sm:text-lg md:text-xl font-semibold">{Math.round(summary.totalProtein)}g</p>
          {currentGoal?.protein_goal && (
            <p className="text-xs text-muted-foreground">
              Goal: {Math.round(currentGoal.protein_goal)}g
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Carbs</p>
          <p className="text-base sm:text-lg md:text-xl font-semibold">{Math.round(summary.totalCarbs)}g</p>
          {currentGoal?.carbs_goal && (
            <p className="text-xs text-muted-foreground">
              Goal: {Math.round(currentGoal.carbs_goal)}g
            </p>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Fat</p>
          <p className="text-base sm:text-lg md:text-xl font-semibold">{Math.round(summary.totalFat)}g</p>
          {currentGoal?.fat_goal && (
            <p className="text-xs text-muted-foreground">
              Goal: {Math.round(currentGoal.fat_goal)}g
            </p>
          )}
        </div>
      </div>

      {/* Nutrition Goals Progress */}
      {currentGoal && (currentGoal.protein_goal || currentGoal.carbs_goal || currentGoal.fat_goal) && (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg">
          <h4 className="font-medium text-foreground mb-3">Nutrition Progress</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentGoal.protein_goal && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-medium">
                    {Math.round(summary.totalProtein)}g / {Math.round(currentGoal.protein_goal)}g
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (summary.totalProtein / currentGoal.protein_goal) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round((summary.totalProtein / currentGoal.protein_goal) * 100)}% of goal
                </div>
              </div>
            )}

            {currentGoal.carbs_goal && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Carbs</span>
                  <span className="font-medium">
                    {Math.round(summary.totalCarbs)}g / {Math.round(currentGoal.carbs_goal)}g
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (summary.totalCarbs / currentGoal.carbs_goal) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round((summary.totalCarbs / currentGoal.carbs_goal) * 100)}% of goal
                </div>
              </div>
            )}

            {currentGoal.fat_goal && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fat</span>
                  <span className="font-medium">
                    {Math.round(summary.totalFat)}g / {Math.round(currentGoal.fat_goal)}g
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (summary.totalFat / currentGoal.fat_goal) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {Math.round((summary.totalFat / currentGoal.fat_goal) * 100)}% of goal
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analyzer
            </Button>
            <Button
              onClick={() => navigate('/calculator')}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <Calculator className="h-4 w-4" />
              Calorie Calculator
            </Button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Nutrition History</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Track your nutrition progress over time
          </p>
        </div>

            {/* Current Calorie Goal */}
            {currentGoal && currentGoal.id && currentGoal.maintenance_calories > 0 && (
              <Card className="p-6 mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Current Calorie Goal</h3>
                      <p className="text-sm text-muted-foreground">
                        {currentGoal.goal_type === 'custom' ? 'Custom' : currentGoal.goal_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
                        Set {format(new Date(currentGoal.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setIsEditingGoal(true);
                      setEditedCalories(currentGoal.maintenance_calories.toString());
                    }}
                    size="sm"
                    variant="outline"
                    className="border-primary/20 text-primary hover:bg-primary hover:text-white hover:border-primary"
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{Math.round(currentGoal.bmr)}</div>
                <div className="text-xs text-muted-foreground">BMR</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{Math.round(currentGoal.tdee)}</div>
                <div className="text-xs text-muted-foreground">TDEE</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{Math.round(currentGoal.maintenance_calories)}</div>
                <div className="text-xs text-muted-foreground">Maintenance</div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-lg">
                <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">
                  {currentGoal.goal_type === 'maintenance' 
                    ? Math.round(currentGoal.maintenance_calories)
                    : currentGoal.goal_type === 'weight_loss'
                    ? Math.round(currentGoal.weight_loss_calories)
                    : Math.round(currentGoal.weight_gain_calories)
                  }
                </div>
                <div className="text-xs text-muted-foreground">Target</div>
              </div>
            </div>

          </Card>
        )}

            {!currentGoal && (
              <Card className="p-6 mb-6 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-900 dark:text-yellow-100">No Calorie Goal Set</h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Set a calorie goal to track your progress against your daily targets.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => navigate('/calculator')}
                    size="sm"
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    Use Calculator
                  </Button>
                  <Button
                    onClick={() => setShowCustomGoal(true)}
                    size="sm"
                    variant="outline"
                    className="flex-1 border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white hover:border-yellow-600"
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Set Custom Goal
                  </Button>
                </div>
              </Card>
            )}

        {/* Set Nutrition Goals Section */}
        {currentGoal && (
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Set Your Nutrition Goals</h3>
                <p className="text-sm text-muted-foreground">
                  Set your daily targets for protein, carbs, and fat to track your nutrition progress
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="proteinGoal">Protein (g)</Label>
                <Input
                  id="proteinGoal"
                  type="number"
                  placeholder="e.g., 120"
                  value={currentGoal.protein_goal || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCurrentGoal(prev => prev ? { ...prev, protein_goal: value ? parseFloat(value) : null } : null);
                  }}
                  min="0"
                  step="0.1"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 0.8-1.2g per kg body weight
                </p>
              </div>

              <div>
                <Label htmlFor="carbsGoal">Carbs (g)</Label>
                <Input
                  id="carbsGoal"
                  type="number"
                  placeholder="e.g., 200"
                  value={currentGoal.carbs_goal || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCurrentGoal(prev => prev ? { ...prev, carbs_goal: value ? parseFloat(value) : null } : null);
                  }}
                  min="0"
                  step="0.1"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining calories after protein and fat
                </p>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <Label htmlFor="fatGoal">Fat (g)</Label>
                <Input
                  id="fatGoal"
                  type="number"
                  placeholder="e.g., 60"
                  value={currentGoal.fat_goal || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCurrentGoal(prev => prev ? { ...prev, fat_goal: value ? parseFloat(value) : null } : null);
                  }}
                  min="0"
                  step="0.1"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 20-35% of total calories
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                onClick={async () => {
                  if (!currentGoal) return;
                  
                  try {
                    const { error } = await supabase
                      .from('calorie_goals')
                      .update({
                        protein_goal: currentGoal.protein_goal,
                        carbs_goal: currentGoal.carbs_goal,
                        fat_goal: currentGoal.fat_goal
                      })
                      .eq('id', currentGoal.id);

                    if (error) throw error;

                    toast({
                      title: "Goals Updated!",
                      description: "Your nutrition goals have been saved successfully.",
                    });
                  } catch (error: any) {
                    // Fallback to localStorage
                    const localGoals = JSON.parse(localStorage.getItem('calorie_goals') || '[]');
                    const updatedGoals = localGoals.map((goal: any) => 
                      goal.id === currentGoal.id 
                        ? { ...goal, protein_goal: currentGoal.protein_goal, carbs_goal: currentGoal.carbs_goal, fat_goal: currentGoal.fat_goal }
                        : goal
                    );
                    localStorage.setItem('calorie_goals', JSON.stringify(updatedGoals));
                    
                    toast({
                      title: "Goals Updated!",
                      description: "Your nutrition goals have been saved successfully.",
                    });
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Save Goals
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentGoal(prev => prev ? { ...prev, protein_goal: null, carbs_goal: null, fat_goal: null } : null);
                }}
              >
                Clear All
              </Button>
            </div>
          </Card>
        )}

        {/* No Data Message */}
        {!loading && meals.length === 0 && (
          <Card className="p-8 text-center mb-6">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Meal History Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by analyzing your first meal to see your nutrition history here.
                </p>
                <Button
                  onClick={() => navigate('/')}
                  className="bg-primary hover:bg-primary-hover"
                >
                  Analyze Your First Meal
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-6">
            <SummaryCard
              title={`Today - ${format(now, 'MMM d, yyyy')}`}
              summary={dailySummary}
              icon={<Calendar className="h-5 w-5 text-primary" />}
            />
          </TabsContent>

          <TabsContent value="monthly" className="space-y-6">
            <SummaryCard
              title={`This Month - ${format(now, 'MMMM yyyy')}`}
              summary={monthlySummary}
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
            />
          </TabsContent>

          <TabsContent value="yearly" className="space-y-6">
            <SummaryCard
              title={`This Year - ${format(now, 'yyyy')}`}
              summary={yearlySummary}
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Recent Meals</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {meals.map((meal) => (
              <Card key={meal.id} className="overflow-hidden">
                <img
                  src={meal.image_url}
                  alt="Meal"
                  className="w-full h-48 object-cover"
                />
                <div className="p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(meal.analyzed_at), 'MMM d, yyyy • h:mm a')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Calories:</span>
                      <span className="ml-1 font-semibold">{Math.round(meal.calories)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Protein:</span>
                      <span className="ml-1 font-semibold">{Math.round(meal.protein)}g</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Carbs:</span>
                      <span className="ml-1 font-semibold">{Math.round(meal.carbs)}g</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fat:</span>
                      <span className="ml-1 font-semibold">{Math.round(meal.fat)}g</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {meals.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No meals analyzed yet. Start analyzing meals to see your history!
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Goal Modal */}
      {isEditingGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Edit Calorie Goal</h3>
                  <p className="text-sm text-muted-foreground">
                    Update your daily calorie target
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="editedCalories">Daily Calorie Goal</Label>
                  <Input
                    id="editedCalories"
                    type="number"
                    placeholder="e.g., 2000"
                    value={editedCalories}
                    onChange={(e) => setEditedCalories(e.target.value)}
                    min="1"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your target daily calorie intake
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={saveEditedCalorieGoal}
                    disabled={isSavingEdit || !editedCalories}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {isSavingEdit ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Target className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditingGoal(false);
                      setEditedCalories('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Custom Goal Modal */}
      {showCustomGoal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Set Custom Calorie Goal</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your daily calorie target
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="customCalories">Daily Calorie Goal</Label>
                  <Input
                    id="customCalories"
                    type="number"
                    placeholder="e.g., 2000"
                    value={customCalories}
                    onChange={(e) => setCustomCalories(e.target.value)}
                    min="1"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your target daily calorie intake
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={saveCustomCalorieGoal}
                    disabled={isSavingCustomGoal || !customCalories}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {isSavingCustomGoal ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Target className="mr-2 h-4 w-4" />
                    )}
                    Save Goal
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCustomGoal(false);
                      setCustomCalories('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default History;
