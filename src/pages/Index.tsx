import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ImageUpload';
import { NutritionResults } from '@/components/NutritionResults';
import { useToast } from '@/hooks/use-toast';
import { Zap, Brain, Smartphone, ArrowRight, History, LogOut, User, Loader2, Calculator } from 'lucide-react';
import heroMeal from '@/assets/hero-meal.jpg';
import { supabase } from '@/integrations/supabase/client';

interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface NutritionData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodItems?: FoodItem[];
}

const Index = () => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToHistory, setSavedToHistory] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleImageSelect = async (file: File) => {
    setSelectedImage(file);
    setNutritionData(null);
    setSavedToHistory(false);
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('https://994e306e3e25.ngrok-free.app/webhook-test/ai-meal', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        throw new Error(`Failed to analyze image: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

      // Normalize API response to expected array format
      const normalizedArray = Array.isArray(data)
        ? data
        : (data && typeof data === 'object' && 'output' in data)
          ? [data]
          : null;

      // Handle async/queued workflow message
      if (!normalizedArray) {
        if (data && typeof data === 'object' && 'message' in data) {
          const msg = String((data as any).message || '');
          console.warn('API message:', msg);
          if (msg.toLowerCase().includes('workflow')) {
            throw new Error('Analysis is still processing. Please try again in a moment.');
          }
          throw new Error(`Unexpected API message: ${msg}`);
        }
        throw new Error('Unexpected API response structure.');
      }

      const result = normalizedArray[0]?.output;
      console.log('Parsed result:', result);

      // Validate required fields
      if (!result || result.status !== 'success') {
        throw new Error('Invalid response: status is not success.');
      }
      if (!result.total || typeof result.total.calories !== 'number' || typeof result.total.protein !== 'number' || typeof result.total.carbs !== 'number' || typeof result.total.fat !== 'number') {
        throw new Error('Invalid response format - missing total fields (calories, protein, carbs, fat).');
      }
      if (!Array.isArray(result.food)) {
        throw new Error('Invalid response format - food must be an array.');
      }

      setNutritionData({
        calories: result.total.calories,
        protein: result.total.protein,
        carbs: result.total.carbs,
        fat: result.total.fat,
        foodItems: result.food
      });

      toast({
        title: "Analysis Complete!",
        description: "Your meal's nutrition has been analyzed successfully.",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setNutritionData(null);
    setIsAnalyzing(false);
    setSavedToHistory(false);
  };

  const handleNewAnalysis = () => {
    handleClear();
  };

  const handleSaveToHistory = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your meal history.",
      });
      navigate('/auth');
      return;
    }

    if (!selectedImage || !nutritionData) return;

    setIsSaving(true);
    try {
      await saveMealAnalysis(selectedImage, nutritionData);
      setSavedToHistory(true);
      toast({
        title: "Saved to History!",
        description: "Your meal analysis has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save to history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveMealAnalysis = async (imageFile: File, nutrition: NutritionData) => {
    try {
      // Upload image to storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('meal-images')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('meal-images')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('meal_analyses')
        .insert([{
          user_id: user.id,
          image_url: publicUrl,
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
          food_items: nutrition.foodItems as any || [],
        }]);

      if (dbError) throw dbError;
    } catch (error: any) {
      console.error('Error saving meal analysis:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been signed out successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-primary">Hill Calories AI</h2>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/calculator')}
                className="hidden sm:flex"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Calculator
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/calculator')}
                className="sm:hidden"
              >
                <Calculator className="h-4 w-4" />
              </Button>
            {user ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/history')}
                    className="hidden sm:flex"
                >
                  <History className="mr-2 h-4 w-4" />
                  History
                </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/history')}
                    className="sm:hidden"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                    className="hidden sm:flex"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="sm:hidden"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
              </>
            ) : (
                <>
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/auth')}
                    className="hidden sm:flex"
              >
                <User className="mr-2 h-4 w-4" />
                Sign In
              </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate('/auth')}
                    className="sm:hidden"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 to-purple-50 py-16 sm:py-20 md:py-24 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
            {/* Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  Start Knowing What's In Your Food
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
                  Every Meal Tells A{' '}
                  <span className="text-green-500">Story</span>
                </h1>
                <p className="text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl">
                  Discover the hidden nutrition in every bite. Our AI-powered analysis reveals 
                  calories, macros, and health insights from a simple photo of your meal.
                </p>
              </div>

              <div className="space-y-4">
                <Button 
                  size="lg" 
                  className="bg-green-500 hover:bg-green-600 text-white shadow-lg text-lg px-8 py-4 h-auto font-semibold rounded-xl"
                  onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <Zap className="mr-2 h-5 w-5" />
                  Reveal My Meal's Secrets
                </Button>
                <p className="text-sm text-gray-500">
                  No credit card required. Cancel anytime.
                </p>
              </div>
            </div>

            {/* App Mockup */}
            <div className="relative order-first lg:order-last">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-auto">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-500">
                    <Zap className="h-4 w-4" />
                    <span className="text-sm font-medium">Snap your meal to get started</span>
                  </div>
                  
                  <div className="bg-gray-100 rounded-xl h-48 flex items-center justify-center">
                    <Zap className="h-12 w-12 text-green-400" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Analyze Ingredients</span>
                      <div className="w-8 h-0.5 bg-green-500"></div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">Total Calories</span>
                      <span className="text-2xl font-bold text-green-500">524</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-purple-100 rounded-lg p-2 text-center">
                        <div className="text-sm font-semibold text-purple-700">20g</div>
                        <div className="text-xs text-purple-600">Protein</div>
                      </div>
                      <div className="bg-green-100 rounded-lg p-2 text-center">
                        <div className="text-sm font-semibold text-green-700">60g</div>
                        <div className="text-xs text-green-600">Carbs</div>
                      </div>
                      <div className="bg-gray-100 rounded-lg p-2 text-center">
                        <div className="text-sm font-semibold text-gray-700">15g</div>
                        <div className="text-xs text-gray-600">Fat</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Low Carb</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Keto Friendly</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Vegan</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">4.9</div>
              <div className="flex items-center justify-center gap-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Zap key={i} className="h-4 w-4 text-green-500 fill-current" />
                ))}
              </div>
              <div className="text-sm text-gray-600">Avg. Star Rating</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">500K+</div>
              <div className="text-sm text-gray-600">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">1M+</div>
              <div className="text-sm text-gray-600">Meals Scanned</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">99.2%</div>
              <div className="text-sm text-gray-600">AI Accuracy</div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-8">
            <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
              App Store Rating
            </Button>
            <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
              Play Store Rating
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
              Simple Steps
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How The Magic Happens
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our advanced AI technology analyzes your meal photos in seconds, 
              providing detailed nutrition insights you can trust.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-500 mb-2">01</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Capture The Moment</h3>
              <p className="text-gray-600">
                Simply snap a photo of your meal. Our AI works with any lighting or angle.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-500 mb-2">02</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI Chef Analysis</h3>
              <p className="text-gray-600">
                Our advanced AI identifies ingredients and calculates precise nutrition data.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-500 mb-2">03</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Instant Insights</h3>
              <p className="text-gray-600">
                Get detailed nutrition breakdown, health recommendations, and dietary insights.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12 md:mb-16 animate-fade-in">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">
              How It Works
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Advanced AI technology analyzes your meal photos to provide accurate nutritional insights
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: <Smartphone className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
                title: "Snap a Photo",
                description: "Use your phone camera or upload an existing image of your meal"
              },
              {
                icon: <Brain className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
                title: "AI Analysis",
                description: "Our advanced AI identifies ingredients and calculates nutritional content"
              },
              {
                icon: <Zap className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8" />,
                title: "Instant Results",
                description: "Get detailed macronutrient breakdown in seconds, not minutes"
              }
            ].map((feature, index) => (
              <div key={index} className="text-center space-y-3 sm:space-y-4 animate-slide-up px-4">
                <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section id="upload-section" className="py-20 sm:py-24 md:py-28 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          {!nutritionData ? (
            <div className="space-y-12">
              <div className="text-center">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                  Try It Now - Upload Your Meal
                </h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Experience the power of AI nutrition analysis. Upload a photo and get instant insights.
                </p>
              </div>

              <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-2xl mx-auto">
                <div className="text-center space-y-8">
                  <div className="flex items-center justify-center gap-3 text-green-500 mb-6">
                    <Zap className="h-8 w-8" />
                    <span className="text-xl font-semibold">Snap Your Meal</span>
                  </div>
                  
                  <ImageUpload
                    onImageSelect={handleImageSelect}
                    isAnalyzing={isAnalyzing}
                    selectedImage={selectedImage}
                    onClear={handleClear}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              <NutritionResults data={nutritionData} />
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {user && !savedToHistory && (
                  <Button
                    onClick={handleSaveToHistory}
                    size="lg"
                    disabled={isSaving}
                    className="w-full sm:w-auto bg-primary hover:bg-primary-hover shadow-medium"
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <History className="mr-2 h-4 w-4" />
                    Save to History
                  </Button>
                )}
                {savedToHistory && user && (
                  <Button
                    onClick={() => navigate('/history')}
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto shadow-medium"
                  >
                    <History className="mr-2 h-4 w-4" />
                    View History
                  </Button>
                )}
                <Button
                  onClick={handleNewAnalysis}
                  size="lg"
                  variant={savedToHistory ? "default" : "outline"}
                  className="w-full sm:w-auto shadow-medium"
                >
                  Analyze Another Meal
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
              What Our Users Say
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Real Stories From Real Food Lovers
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              See how Hill Calories AI is helping people make better food choices every day.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="text-2xl font-bold text-gray-900 mb-4">
                "This app changed how I think about food completely. The accuracy is incredible!"
              </div>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Zap key={i} className="h-4 w-4 text-green-500 fill-current" />
                ))}
              </div>
              <Button variant="ghost" size="sm" className="text-green-600 p-0 h-auto">
                Read Full Story <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-green-700">SC</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Sarah Chen</div>
                  <div className="text-sm text-gray-600">Nutritionist, NYC</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="text-2xl font-bold text-gray-900 mb-4">
                "Finally, a nutrition app that actually works. The AI is spot-on every time."
              </div>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Zap key={i} className="h-4 w-4 text-green-500 fill-current" />
                ))}
              </div>
              <Button variant="ghost" size="sm" className="text-green-600 p-0 h-auto">
                Read Full Story <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-purple-700">MR</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Marcus Rodriguez</div>
                  <div className="text-sm text-gray-600">Fitness Coach, LA</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="text-2xl font-bold text-gray-900 mb-4">
                "I've tried every nutrition app out there. This one is in a league of its own."
              </div>
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Zap key={i} className="h-4 w-4 text-green-500 fill-current" />
                ))}
              </div>
              <Button variant="ghost" size="sm" className="text-green-600 p-0 h-auto">
                Read Full Story <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-green-700">EN</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Elena Nakamura</div>
                  <div className="text-sm text-gray-600">Chef, Tokyo</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-gray-600 mb-4">Join 500K+ users who love Hill Calories AI</p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
                Leave a Review
              </Button>
              <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
                Become a Beta Tester
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-green-50 to-purple-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-6">
              Ready to Transform Your Health?
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Stop Guessing. Start{' '}
              <span className="text-green-500">Knowing</span>.
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              Join thousands of users who are already making smarter food choices with AI-powered nutrition analysis.
            </p>
            <Button 
              size="lg" 
              className="bg-green-500 hover:bg-green-600 text-white shadow-lg text-lg px-8 py-4 h-auto font-semibold rounded-xl mb-4"
              onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Zap className="mr-2 h-5 w-5" />
              Start Your Food Journey
            </Button>
            <p className="text-sm text-gray-500 mb-8">
              Free forever plan - Choose one meal a day.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Privacy First</h3>
                <p className="text-sm text-gray-600">Your data stays secure and private</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">500K+ Users</h3>
                <p className="text-sm text-gray-600">Trusted by health enthusiasts worldwide</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Lightning Fast</h3>
                <p className="text-sm text-gray-600">Get results in seconds, not minutes</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg max-w-2xl mx-auto">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Built for nutritionists, chefs, and serious food lovers.
              </h3>
              <p className="text-gray-600">
                Whether you're a professional chef, nutritionist, or just someone who cares about what you eat, 
                Hill Calories AI provides the accuracy and insights you need to make informed decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">H</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Hill Calories AI</span>
              </div>
              <p className="text-gray-600 mb-4 max-w-md">
                Transform your relationship with food through AI-powered nutrition analysis. 
                Make informed decisions about what you eat, every single day.
              </p>
              <div className="flex gap-4">
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-green-600">
                  <Zap className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-green-600">
                  <Zap className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-green-600">
                  <Zap className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-green-600">
                  <Zap className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-green-600">Features</a></li>
                <li><a href="#" className="hover:text-green-600">Pricing</a></li>
                <li><a href="#" className="hover:text-green-600">API</a></li>
                <li><a href="#" className="hover:text-green-600">Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-green-600">About</a></li>
                <li><a href="#" className="hover:text-green-600">Blog</a></li>
                <li><a href="#" className="hover:text-green-600">Careers</a></li>
                <li><a href="#" className="hover:text-green-600">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-600">
              © 2024 Hill Calories AI. All rights reserved.
            </p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <a href="#" className="text-sm text-gray-600 hover:text-green-600">Privacy</a>
              <a href="#" className="text-sm text-gray-600 hover:text-green-600">Terms</a>
              <a href="#" className="text-sm text-gray-600 hover:text-green-600">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;