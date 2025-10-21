import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

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
  confidence?: number;
  foodItems?: FoodItem[];
}

interface NutritionResultsProps {
  data: NutritionData;
  className?: string;
}

export const NutritionResults: React.FC<NutritionResultsProps> = ({
  data,
  className
}) => {
  const { calories, protein, carbs, fat, confidence = 0.85 } = data;
  
  // Calculate percentages for macros (basic estimation)
  const totalMacros = protein * 4 + carbs * 4 + fat * 9;
  const proteinPercent = Math.round((protein * 4 / totalMacros) * 100);
  const carbsPercent = Math.round((carbs * 4 / totalMacros) * 100);
  const fatPercent = Math.round((fat * 9 / totalMacros) * 100);

  return (
    <div className={`space-y-4 sm:space-y-6 animate-slide-up ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Nutrition Analysis
          </h2>
          <Badge 
            variant="secondary" 
            className="bg-success/10 text-success border-success/20 text-xs sm:text-sm"
          >
            {Math.round(confidence * 100)}% confidence
          </Badge>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          AI-powered analysis of your meal
        </p>
      </div>

      {/* Calories Card */}
      <Card className="nutrition-card">
        <div className="text-center py-2 sm:py-4">
          <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gradient-primary mb-2">
            {calories}
          </div>
          <p className="text-base sm:text-lg font-medium text-foreground">Total Calories</p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Estimated energy content
          </p>
        </div>
      </Card>

      {/* Macronutrients Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Protein */}
        <Card className="nutrition-card">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-nutrition-protein"></div>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                {proteinPercent}%
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {protein}g
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Protein</div>
            </div>
            <Progress 
              value={proteinPercent} 
              className="h-1.5 sm:h-2"
              style={{
                '--progress-background': 'hsl(var(--nutrition-protein))'
              } as React.CSSProperties}
            />
          </div>
        </Card>

        {/* Carbohydrates */}
        <Card className="nutrition-card">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-nutrition-carbs"></div>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                {carbsPercent}%
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {carbs}g
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Carbs</div>
            </div>
            <Progress 
              value={carbsPercent} 
              className="h-1.5 sm:h-2"
              style={{
                '--progress-background': 'hsl(var(--nutrition-carbs))'
              } as React.CSSProperties}
            />
          </div>
        </Card>

        {/* Fat */}
        <Card className="nutrition-card">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-nutrition-fat"></div>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                {fatPercent}%
              </span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                {fat}g
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Fat</div>
            </div>
            <Progress 
              value={fatPercent} 
              className="h-1.5 sm:h-2"
              style={{
                '--progress-background': 'hsl(var(--nutrition-fat))'
              } as React.CSSProperties}
            />
          </div>
        </Card>
      </div>

      {/* Food Breakdown */}
      {data.foodItems && data.foodItems.length > 0 && (
        <Card className="nutrition-card">
          <div className="space-y-4">
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Food Breakdown</h3>
            <div className="space-y-3">
              {data.foodItems.map((item, index) => (
                <div
                  key={index}
                  className="p-3 sm:p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-foreground">{item.name}</h4>
                      <p className="text-sm text-muted-foreground">{item.quantity}</p>
                    </div>
                    <span className="text-lg font-bold text-primary">{item.calories} cal</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 rounded bg-nutrition-protein/10">
                      <p className="font-medium text-foreground">{item.protein}g</p>
                      <p className="text-xs text-muted-foreground">Protein</p>
                    </div>
                    <div className="text-center p-2 rounded bg-nutrition-carbs/10">
                      <p className="font-medium text-foreground">{item.carbs}g</p>
                      <p className="text-xs text-muted-foreground">Carbs</p>
                    </div>
                    <div className="text-center p-2 rounded bg-nutrition-fat/10">
                      <p className="font-medium text-foreground">{item.fat}g</p>
                      <p className="text-xs text-muted-foreground">Fat</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Footer Note */}
      <div className="text-center px-4">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Analysis based on visual recognition • Results are estimates
        </p>
      </div>
    </div>
  );
};