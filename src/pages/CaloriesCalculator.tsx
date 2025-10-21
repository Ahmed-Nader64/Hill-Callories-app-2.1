import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Target, Activity, Zap, ArrowLeft, Home, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalorieResults {
  bmr: number;
  tdee: number;
  maintenance: number;
  weightLoss: number;
  weightGain: number;
}

interface UserInputs {
  age: string;
  weight: string;
  height: string;
  gender: 'male' | 'female';
  activityLevel: string;
  unit: 'metric' | 'imperial';
}

const activityLevels = [
  { value: '1.2', label: 'Sedentary (little or no exercise)' },
  { value: '1.375', label: 'Lightly active (light exercise 1-3 days/week)' },
  { value: '1.55', label: 'Moderately active (moderate exercise 3-5 days/week)' },
  { value: '1.725', label: 'Very active (hard exercise 6-7 days/week)' },
  { value: '1.9', label: 'Extra active (very hard exercise & physical job)' }
];

const CaloriesCalculatorPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [inputs, setInputs] = useState<UserInputs>({
    age: '',
    weight: '',
    height: '',
    gender: 'male',
    activityLevel: '1.55',
    unit: 'metric'
  });

  const [results, setResults] = useState<CalorieResults | null>(null);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedGoal, setSavedGoal] = useState<string | null>(null);

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Test database connection
    testDatabaseConnection();

    return () => subscription.unsubscribe();
  }, []);

  const testDatabaseConnection = async () => {
    try {
      console.log('Testing database connection...');
      
      // First, let's check if the table exists by trying to query it
      const { data, error } = await supabase
        .from('calorie_goals')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('calorie_goals table error:', error);
        
        // If the table doesn't exist, let's check what tables are available
        console.log('Checking available tables...');
        const { data: mealData, error: mealError } = await supabase
          .from('meal_analyses')
          .select('id')
          .limit(1);
        
        if (mealError) {
          console.error('meal_analyses table error:', mealError);
        } else {
          console.log('meal_analyses table exists, but calorie_goals does not');
        }
      } else {
        console.log('calorie_goals table exists and connection successful');
      }
    } catch (error) {
      console.error('Database test error:', error);
    }
  };

  const calculateBMR = (age: number, weight: number, height: number, gender: 'male' | 'female'): number => {
    // Using Mifflin-St Jeor Equation (more accurate than Harris-Benedict)
    if (gender === 'male') {
      return (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      return (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }
  };


  const calculateCalories = () => {
    const age = parseInt(inputs.age);
    const weight = parseFloat(inputs.weight);
    const height = parseFloat(inputs.height);
    const activityMultiplier = parseFloat(inputs.activityLevel);

    if (!age || !weight || !height || age < 1 || weight < 1 || height < 1) {
      return;
    }

    // Convert to metric if needed
    let weightKg = weight;
    let heightCm = height;

    if (inputs.unit === 'imperial') {
      weightKg = weight * 0.453592; // pounds to kg
      heightCm = height * 2.54; // inches to cm
    }

    const bmr = calculateBMR(age, weightKg, heightCm, inputs.gender);
    const tdee = bmr * activityMultiplier;

    setResults({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      maintenance: Math.round(tdee),
      weightLoss: Math.round(tdee - 500), // 500 calorie deficit for 1 lb/week loss
      weightGain: Math.round(tdee + 500)  // 500 calorie surplus for 1 lb/week gain
    });
    setIsCalculated(true);
  };

  const handleInputChange = (field: keyof UserInputs, value: string) => {
    setInputs(prev => ({ ...prev, [field]: value }));
    setIsCalculated(false);
  };

  const resetCalculator = () => {
    setInputs({
      age: '',
      weight: '',
      height: '',
      gender: 'male',
      activityLevel: '1.55',
      unit: 'metric'
    });
    setResults(null);
    setIsCalculated(false);
    setSavedGoal(null);
  };

  const saveCalorieGoal = async (goalType: 'maintenance' | 'weight_loss' | 'weight_gain') => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your calorie goals.",
      });
      navigate('/auth');
      return;
    }

    if (!results) return;

    setIsSaving(true);
    try {
      const goalData = {
        id: `goal_${Date.now()}`,
        user_id: user.id,
        bmr: results.bmr,
        tdee: results.tdee,
        maintenance_calories: results.maintenance,
        weight_loss_calories: results.weightLoss,
        weight_gain_calories: results.weightGain,
        age: parseInt(inputs.age),
        weight: parseFloat(inputs.weight),
        height: parseFloat(inputs.height),
        gender: inputs.gender,
        activity_level: parseFloat(inputs.activityLevel),
        unit_system: inputs.unit,
        goal_type: goalType,
        protein_goal: null,
        carbs_goal: null,
        fat_goal: null,
        created_at: new Date().toISOString()
      };

      console.log('Saving calorie goal:', goalData);

      // Try to save to database first
      try {
        const { data, error } = await supabase
          .from('calorie_goals')
          .insert([goalData])
          .select();

        console.log('Database save result:', { data, error });

        if (error) {
          console.warn('Database save failed, falling back to localStorage:', error);
          throw error;
        }

        console.log('Successfully saved to database');
      } catch (dbError) {
        console.log('Database not available, saving to localStorage');
        
        // Fallback to localStorage
        const existingGoals = JSON.parse(localStorage.getItem('calorie_goals') || '[]');
        existingGoals.push(goalData);
        localStorage.setItem('calorie_goals', JSON.stringify(existingGoals));
        
        console.log('Saved to localStorage:', goalData);
      }

      setSavedGoal(goalType);
      toast({
        title: "Goal Saved!",
        description: `Your ${goalType.replace('_', ' ')} goal has been saved successfully.`,
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save calorie goal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = inputs.age && inputs.weight && inputs.height;

  return (
    <div className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <h2 className="text-lg sm:text-xl font-bold text-primary">Calorie Calculator</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8 sm:py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          {/* Page Header */}
          <div className="text-center mb-8 sm:mb-12 animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">
                Daily Calorie Calculator
              </h1>
            </div>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Calculate your personalized daily calorie needs based on your age, weight, height, and activity level
            </p>
          </div>

          <div className="space-y-6">
            {/* Calculator Form */}
            <Card className="p-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Personal Information</h3>
                  <p className="text-sm text-muted-foreground">Enter your details to get accurate calculations</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="25"
                      value={inputs.age}
                      onChange={(e) => handleInputChange('age', e.target.value)}
                      min="1"
                      max="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={inputs.gender} onValueChange={(value: 'male' | 'female') => handleInputChange('gender', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="unit">Unit System</Label>
                    <Select value={inputs.unit} onValueChange={(value: 'metric' | 'imperial') => handleInputChange('unit', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric (kg, cm)</SelectItem>
                        <SelectItem value="imperial">Imperial (lbs, inches)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Physical Measurements */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="weight">
                      Weight ({inputs.unit === 'metric' ? 'kg' : 'lbs'})
                    </Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder={inputs.unit === 'metric' ? '70' : '154'}
                      value={inputs.weight}
                      onChange={(e) => handleInputChange('weight', e.target.value)}
                      min="1"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="height">
                      Height ({inputs.unit === 'metric' ? 'cm' : 'inches'})
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder={inputs.unit === 'metric' ? '175' : '69'}
                      value={inputs.height}
                      onChange={(e) => handleInputChange('height', e.target.value)}
                      min="1"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="activity">Activity Level</Label>
                    <Select value={inputs.activityLevel} onValueChange={(value) => handleInputChange('activityLevel', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activityLevels.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
              </div>
            </div>
          </div>


          <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <Button
                  onClick={calculateCalories}
                  disabled={!isFormValid}
                  className="flex-1 bg-primary hover:bg-primary-hover"
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate Calories
                </Button>
                <Button
                  onClick={resetCalculator}
                  variant="outline"
                  className="flex-1"
                >
                  Reset
                </Button>
              </div>
            </Card>

            {/* Results */}
            {results && (
              <Card className="p-6 animate-scale-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Your Daily Calorie Needs</h3>
                    <p className="text-sm text-muted-foreground">Based on Mifflin-St Jeor equation</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{results.bmr}</div>
                    <div className="text-sm text-muted-foreground">BMR (Basal Metabolic Rate)</div>
                    <div className="text-xs text-muted-foreground mt-1">Calories at rest</div>
                  </div>

                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">{results.tdee}</div>
                    <div className="text-sm text-muted-foreground">TDEE (Total Daily Energy Expenditure)</div>
                    <div className="text-xs text-muted-foreground mt-1">Calories with activity</div>
                  </div>

                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{results.maintenance}</div>
                    <div className="text-sm text-muted-foreground">Maintenance</div>
                    <div className="text-xs text-muted-foreground mt-1">Maintain current weight</div>
                  </div>

                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{results.weightLoss}</div>
                    <div className="text-sm text-muted-foreground">Weight Loss</div>
                    <div className="text-xs text-muted-foreground mt-1">~1 lb/week loss</div>
                  </div>

                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{results.weightGain}</div>
                    <div className="text-sm text-muted-foreground">Weight Gain</div>
                    <div className="text-xs text-muted-foreground mt-1">~1 lb/week gain</div>
                  </div>

                  <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                    <div className="text-lg font-semibold text-primary">💡</div>
                    <div className="text-sm text-foreground font-medium">Pro Tip</div>
                    <div className="text-xs text-muted-foreground mt-1">Start with maintenance calories and adjust gradually</div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">How to Use These Numbers</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• <strong>BMR:</strong> Calories your body needs at complete rest</li>
                    <li>• <strong>TDEE:</strong> Total calories including your daily activities</li>
                    <li>• <strong>Weight Loss:</strong> Create a 500-calorie daily deficit for safe weight loss</li>
                    <li>• <strong>Weight Gain:</strong> Add 500 calories daily for healthy weight gain</li>
                  </ul>
                </div>

                {/* Save Goals Section */}
                {user && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-900 dark:text-green-100 mb-3">Save Your Goal</h4>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-4">
                      Save your calorie goal to track it in your history and compare with your meal analysis.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() => saveCalorieGoal('maintenance')}
                        disabled={isSaving || savedGoal === 'maintenance'}
                        variant={savedGoal === 'maintenance' ? 'secondary' : 'default'}
                        size="sm"
                        className="flex-1"
                      >
                        {isSaving && savedGoal !== 'maintenance' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {savedGoal === 'maintenance' ? 'Saved' : 'Save Maintenance Goal'}
                      </Button>
                      <Button
                        onClick={() => saveCalorieGoal('weight_loss')}
                        disabled={isSaving || savedGoal === 'weight_loss'}
                        variant={savedGoal === 'weight_loss' ? 'secondary' : 'default'}
                        size="sm"
                        className="flex-1"
                      >
                        {isSaving && savedGoal !== 'weight_loss' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {savedGoal === 'weight_loss' ? 'Saved' : 'Save Weight Loss Goal'}
                      </Button>
                      <Button
                        onClick={() => saveCalorieGoal('weight_gain')}
                        disabled={isSaving || savedGoal === 'weight_gain'}
                        variant={savedGoal === 'weight_gain' ? 'secondary' : 'default'}
                        size="sm"
                        className="flex-1"
                      >
                        {isSaving && savedGoal !== 'weight_gain' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {savedGoal === 'weight_gain' ? 'Saved' : 'Save Weight Gain Goal'}
                      </Button>
                    </div>
                    {savedGoal && (
                      <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                        ✓ Goal saved! You can view it in your history page.
                      </p>
                    )}
                  </div>
                )}

                {!user && (
                  <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Sign In to Save Goals</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                      Sign in to save your calorie goals and track them alongside your meal analysis.
                    </p>
                    <Button
                      onClick={() => navigate('/auth')}
                      size="sm"
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      Sign In
                    </Button>
                  </div>
                )}

                {/* Debug Information */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-950/20 rounded-lg border border-gray-200 dark:border-gray-800">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Debug Information</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    If saving fails, the app will automatically fall back to localStorage storage.
                    Check the browser console for detailed error messages.
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Database table: calorie_goals | User: {user ? 'Signed in' : 'Not signed in'}
                  </p>
                </div>
              </Card>
            )}

            {/* Additional Information */}
            <Card className="p-6 bg-muted/30">
              <h3 className="text-lg font-semibold text-foreground mb-4">About This Calculator</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This calculator uses the <strong>Mifflin-St Jeor equation</strong>, which is considered one of the most accurate methods for estimating Basal Metabolic Rate (BMR). The equation takes into account your age, weight, height, and gender to calculate the number of calories your body needs at rest.
                </p>
                <p>
                  Your Total Daily Energy Expenditure (TDEE) is calculated by multiplying your BMR by an activity factor that reflects your daily exercise and activity level. This gives you the total number of calories you burn in a day.
                </p>
                <p>
                  <strong>Remember:</strong> These are estimates and individual results may vary. For best results, track your progress and adjust your calorie intake based on your goals and how your body responds.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CaloriesCalculatorPage;
