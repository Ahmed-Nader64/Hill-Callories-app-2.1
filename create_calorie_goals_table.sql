-- Create calorie_goals table
CREATE TABLE IF NOT EXISTS calorie_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bmr DECIMAL(10,2) NOT NULL,
  tdee DECIMAL(10,2) NOT NULL,
  maintenance_calories DECIMAL(10,2) NOT NULL,
  weight_loss_calories DECIMAL(10,2) NOT NULL,
  weight_gain_calories DECIMAL(10,2) NOT NULL,
  age INTEGER NOT NULL,
  weight DECIMAL(10,2) NOT NULL,
  height DECIMAL(10,2) NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
  activity_level DECIMAL(3,2) NOT NULL,
  unit_system VARCHAR(10) NOT NULL CHECK (unit_system IN ('metric', 'imperial')),
  goal_type VARCHAR(20) NOT NULL DEFAULT 'maintenance' CHECK (goal_type IN ('maintenance', 'weight_loss', 'weight_gain')),
  -- Macronutrient goals
  protein_goal DECIMAL(10,2),
  carbs_goal DECIMAL(10,2),
  fat_goal DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_calorie_goals_user_id ON calorie_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_calorie_goals_created_at ON calorie_goals(created_at);

-- Enable RLS
ALTER TABLE calorie_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own calorie goals" ON calorie_goals
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own calorie goals" ON calorie_goals
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own calorie goals" ON calorie_goals
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own calorie goals" ON calorie_goals
  FOR DELETE USING (auth.uid()::text = user_id);
